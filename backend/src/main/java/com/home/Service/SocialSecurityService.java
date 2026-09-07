package com.home.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.SsBreakevenRequest;
import com.home.Domain.SsBreakevenResult;
import com.home.Domain.SsBreakevenResult.AgeBenefit;
import com.home.Domain.SsBreakevenResult.CumulativePoint;

/**
 * Social Security claiming math (2024 rules), with optional COLA, investment
 * return, and inflation.
 *
 * Benefit relative to the Full Retirement Age (FRA) amount:
 *  - Claiming EARLY reduces it 5/9 of 1% per month for the first 36 months
 *    before FRA, then 5/12 of 1% per month beyond that.
 *  - Claiming LATE adds delayed-retirement credits of 2/3 of 1% per month
 *    (8%/yr) up to age 70.
 *
 * Each year the benefit grows by the COLA. Benefits received stay invested at
 * the nominal investment return, so claiming sooner keeps more money
 * compounding (you redeem less from your portfolio). Accumulated values are
 * then deflated by inflation so everything reads in today's dollars.
 *
 * The breakeven is the age at which the later claim's accumulated value
 * overtakes the earlier one's. Inflation scales both strategies equally at any
 * given age, so it does not move the breakeven — only COLA and the return do.
 */
@Service
public class SocialSecurityService {

	private static final int MIN_CLAIM = 62;
	private static final int MAX_CLAIM = 70;
	private static final int MAX_AGE = 100; // horizon for detecting a breakeven

	public SsBreakevenResult breakeven(SsBreakevenRequest req) {
		int birthYear = req.birthYear() != null ? req.birthYear() : 1965;
		double pia = req.monthlyAtFra() != null && req.monthlyAtFra() > 0 ? req.monthlyAtFra() : 2000;
		int earlyAge = clampAge(req.earlyAge() != null ? req.earlyAge() : 62);
		int lateAge = clampAge(req.lateAge() != null ? req.lateAge() : 70);
		int lifeExpectancy = req.lifeExpectancy() != null ? req.lifeExpectancy() : 90;
		lifeExpectancy = Math.max(lateAge + 1, Math.min(MAX_AGE, lifeExpectancy));
		double annualReturn = nonNegative(req.investmentReturn());
		double cola = nonNegative(req.colaRate());
		double inflation = nonNegative(req.inflationRate());

		// Keep early <= late so the comparison is well defined.
		if (earlyAge > lateAge) {
			int t = earlyAge; earlyAge = lateAge; lateAge = t;
		}

		int fraMonths = fraMonths(birthYear);
		double earlyMonthly = benefitAt(earlyAge, fraMonths, pia);
		double lateMonthly = benefitAt(lateAge, fraMonths, pia);

		double monthlyReturn = annualReturn / 12.0;
		int startMonth = earlyAge * 12;
		int endMonth = MAX_AGE * 12;

		// Accumulated (invested, COLA-grown) nominal value of each benefit stream.
		double[] earlyValue = simulate(earlyAge, earlyMonthly, monthlyReturn, cola, startMonth, endMonth);
		double[] lateValue = simulate(lateAge, lateMonthly, monthlyReturn, cola, startMonth, endMonth);

		// Breakeven: first month at/after the later claim where its accumulated
		// value catches the earlier claim's. Deflation would scale both equally,
		// so the crossing is the same on nominal values — scan those.
		Double breakevenAge = null;
		String breakevenLabel = null;
		if (lateMonthly > earlyMonthly && lateAge > earlyAge) {
			for (int m = lateAge * 12; m <= endMonth; m++) {
				int idx = m - startMonth;
				if (lateValue[idx] >= earlyValue[idx]) {
					breakevenAge = m / 12.0;
					breakevenLabel = ageLabel(m);
					break;
				}
			}
		}

		// Full starting-benefit-by-claim-age table (today's dollars, pre-COLA).
		List<AgeBenefit> schedule = new ArrayList<>();
		for (int a = MIN_CLAIM; a <= MAX_CLAIM; a++) {
			schedule.add(new AgeBenefit(a, round(benefitAt(a, fraMonths, pia))));
		}

		// Year-by-year accumulated value for the chart, deflated to today's dollars.
		List<CumulativePoint> points = new ArrayList<>();
		for (int age = earlyAge; age <= lifeExpectancy; age++) {
			int idx = age * 12 - startMonth;
			double deflator = Math.pow(1 + inflation, age - earlyAge);
			points.add(new CumulativePoint(age,
				round(earlyValue[idx] / deflator),
				round(lateValue[idx] / deflator)));
		}

		int lifeIdx = lifeExpectancy * 12 - startMonth;
		double lifeDeflator = Math.pow(1 + inflation, lifeExpectancy - earlyAge);
		double cumEarly = round(earlyValue[lifeIdx] / lifeDeflator);
		double cumLate = round(lateValue[lifeIdx] / lifeDeflator);

		return new SsBreakevenResult(
			fraLabel(fraMonths),
			earlyAge, round(earlyMonthly),
			lateAge, round(lateMonthly),
			breakevenAge, breakevenLabel,
			cumEarly, cumLate,
			lifeExpectancy,
			cumLate > cumEarly,
			annualReturn,
			cola,
			inflation,
			inflation > 0,
			schedule,
			points
		);
	}

	/**
	 * Accumulated value of a benefit stream at the end of each month from
	 * {@code startMonth} to {@code endMonth}. Each month the balance grows at the
	 * monthly return, then (once claiming has begun) the benefit is added.
	 *
	 * COLAs accrue from age 62 for everyone regardless of when they claim, so the
	 * benefit is grown by the COLA for each full year since age 62 — meaning a
	 * delayed claim's higher base already carries those raises. This is what makes
	 * COLA favor delaying (it pulls the breakeven earlier). Nominal dollars.
	 */
	private double[] simulate(int claimAge, double baseMonthly, double monthlyReturn,
			double cola, int startMonth, int endMonth) {
		int claimMonth = claimAge * 12;
		int colaRefMonth = MIN_CLAIM * 12; // COLAs accrue from age 62
		double[] balance = new double[endMonth - startMonth + 1];
		double b = 0;
		for (int m = startMonth; m <= endMonth; m++) {
			b *= (1 + monthlyReturn);
			if (m >= claimMonth) {
				int yearsSince62 = (m - colaRefMonth) / 12;
				double monthly = baseMonthly * Math.pow(1 + cola, yearsSince62);
				b += monthly;
			}
			balance[m - startMonth] = b;
		}
		return balance;
	}

	/**
	 * Monthly benefit for a claim age, given birth year (for FRA) and the FRA
	 * benefit (PIA). Public so the retirement projection can fold Social Security
	 * income into its drawdown model.
	 */
	public double monthlyBenefit(int birthYear, double pia, int claimAge) {
		return benefitAt(clampAge(claimAge), fraMonths(birthYear), pia);
	}

	/** Monthly benefit if first claimed at {@code claimAge}, given FRA and PIA. */
	private double benefitAt(int claimAge, int fraMonths, double pia) {
		int claimMonths = claimAge * 12;
		if (claimMonths < fraMonths) {
			int early = fraMonths - claimMonths;
			int first = Math.min(36, early);
			int rest = Math.max(0, early - 36);
			double reduction = (first * (5.0 / 9.0) + rest * (5.0 / 12.0)) / 100.0;
			return pia * (1 - reduction);
		} else if (claimMonths > fraMonths) {
			int late = claimMonths - fraMonths;
			double increase = late * (2.0 / 3.0) / 100.0;
			return pia * (1 + increase);
		}
		return pia;
	}

	/** FRA in months from birth year (Social Security Amendments schedule). */
	private int fraMonths(int birthYear) {
		if (birthYear <= 1954) return 66 * 12;
		if (birthYear >= 1960) return 67 * 12;
		return 66 * 12 + (birthYear - 1954) * 2; // 1955..1959: +2 months per year
	}

	private String fraLabel(int fraMonths) {
		int years = fraMonths / 12;
		int months = fraMonths % 12;
		return months == 0 ? String.valueOf(years) : years + " and " + months + " mo";
	}

	private String ageLabel(double ageMonths) {
		int total = (int) Math.round(ageMonths);
		int years = total / 12;
		int months = total % 12;
		return months == 0 ? years + " yrs" : years + " yrs " + months + " mo";
	}

	private int clampAge(int age) {
		return Math.max(MIN_CLAIM, Math.min(MAX_CLAIM, age));
	}

	private static double nonNegative(Double v) {
		return v != null && v > 0 ? v : 0.0;
	}

	private static double round(double v) {
		return Math.round(v);
	}
}
