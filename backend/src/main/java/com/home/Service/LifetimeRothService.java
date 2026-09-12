package com.home.Service;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.LifetimeRothRequest;
import com.home.Domain.LifetimeRothResult;
import com.home.Domain.LifetimeRothResult.StrategyOutcome;
import com.home.Domain.LifetimeRothResult.YearPoint;
import com.home.tax.AcaSubsidy;
import com.home.tax.FederalTaxService;
import com.home.tax.FederalTaxService.FederalTax;
import com.home.tax.IrmaaTable;
import com.home.tax.RmdTable;
import com.home.tax.TaxConstants.Filing;

/**
 * Lifetime Roth conversion comparison. Runs two parallel year-by-year
 * simulations that are identical except for conversions:
 *
 *  - Baseline: no conversions. The pre-tax account grows and throws off ever-larger
 *    RMDs starting at 73/75, taxed on top of Social Security and (possibly) triggering
 *    IRMAA.
 *  - Conversion strategy: during a chosen window, convert enough each year to fill
 *    ordinary taxable income up to a target ceiling. Roth grows tax-free and future
 *    RMDs shrink.
 *
 * Modeled in today's dollars using the real return. Federal brackets and the
 * standard deduction are inflation-indexed (so constant in real terms); the Social
 * Security taxability and IRMAA thresholds are NOT indexed, so they are scaled down
 * over time — modeling how more households get caught each year.
 *
 * Simplifying assumptions (stated so results are read correctly): pension and Social
 * Security fund living expenses and are tax inputs only; the accounts are the nest
 * egg. RMDs not needed for spending are reinvested in the taxable account. All taxes
 * are paid from the taxable account (then Roth, then pre-tax if it runs dry). Ending
 * wealth values the remaining pre-tax balance at a terminal tax rate. Ignores the
 * IRMAA two-year lookback lag, the Roth 5-year rule, NIIT, AMT, and state-specific
 * rules beyond a flat rate.
 */
@Service
public class LifetimeRothService {

	private final FederalTaxService federal;

	public LifetimeRothService(FederalTaxService federal) {
		this.federal = federal;
	}

	public LifetimeRothResult analyze(LifetimeRothRequest req) {
		Filing filing = "SINGLE".equalsIgnoreCase(req.filingStatus()) ? Filing.SINGLE : Filing.MARRIED_JOINT;
		int currentAge = req.currentAge() != null ? req.currentAge() : 65;
		int birthYear = Year.now().getValue() - currentAge;
		int rmdStart = RmdTable.startAge(birthYear);

		StrategyOutcome baseline = simulate(req, filing, false);
		StrategyOutcome converted = simulate(req, filing, true);

		double taxSaved = baseline.lifetimeTaxTotal() - converted.lifetimeTaxTotal();
		double wealthAdvantage = converted.endingAfterTaxWealth() - baseline.endingAfterTaxWealth();

		return new LifetimeRothResult(
			rmdStart,
			baseline,
			converted,
			round(taxSaved),
			round(wealthAdvantage),
			wealthAdvantage > 0
		);
	}

	private StrategyOutcome simulate(LifetimeRothRequest req, Filing filing, boolean doConvert) {
		int currentAge = req.currentAge() != null ? req.currentAge() : 65;
		int spouseAge0 = req.spouseAge() != null ? req.spouseAge() : currentAge;
		int planThrough = Math.max(currentAge, req.planThroughAge() != null ? req.planThroughAge() : 92);
		int birthYear = Year.now().getValue() - currentAge;

		double nominal = nn(req.investmentReturn(), 0.06);
		double inflation = nn(req.inflationRate(), 0.025);
		double realReturn = (1 + nominal) / (1 + inflation) - 1;

		double trad = nn(req.tradBalance(), 0);
		double roth = nn(req.rothBalance(), 0);
		double taxable = nn(req.taxableBalance(), 0);

		double pension = nn(req.annualPension(), 0);
		double ssBenefit = nn(req.annualSocialSecurity(), 0);
		int ssClaimAge = req.ssClaimAge() != null ? req.ssClaimAge() : 67;
		double yieldRate = nn(req.taxableYieldRate(), 0.02);
		double stateRate = nn(req.stateTaxRate(), 0);
		boolean stateTaxesSs = Boolean.TRUE.equals(req.stateTaxesSs());
		double terminalRate = nn(req.terminalTradRate(), 0.24);

		int convStart = req.convStartAge() != null ? req.convStartAge() : currentAge;
		int convEnd = req.convEndAge() != null ? req.convEndAge() : RmdTable.startAge(birthYear) - 1;
		double target = nn(req.targetTaxableIncome(), 0);
		double maxConv = nn(req.maxAnnualConversion(), 0); // 0 = uncapped

		int firstDeathAge = req.firstDeathAge() != null && req.firstDeathAge() > 0 ? req.firstDeathAge() : Integer.MAX_VALUE;
		double survivorSs = nn(req.survivorSocialSecurity(), ssBenefit);
		boolean acaCoverage = Boolean.TRUE.equals(req.acaCoverage());
		int acaHousehold = req.acaHouseholdSize() != null && req.acaHouseholdSize() > 0 ? req.acaHouseholdSize() : 2;
		double acaBenchmark = nn(req.acaBenchmarkAnnual(), 0);

		double lifetimeIncomeTax = 0, lifetimeIrmaa = 0, lifetimeAca = 0, totalConverted = 0;
		List<YearPoint> points = new ArrayList<>();

		for (int age = currentAge; age <= planThrough; age++) {
			int t = age - currentAge;
			double realScale = Math.pow(1 + inflation, -t); // non-indexed thresholds shrink in real terms
			int spouseAge = spouseAge0 + t;

			// After the first death the survivor files Single (the "widow's penalty").
			boolean widowed = filing == Filing.MARRIED_JOINT && age >= firstDeathAge;
			Filing effFiling = widowed ? Filing.SINGLE : filing;
			int over65 = widowed
				? (age >= 65 ? 1 : 0)
				: (age >= 65 ? 1 : 0) + (filing == Filing.MARRIED_JOINT && spouseAge >= 65 ? 1 : 0);
			int onMedicare = over65;

			double ss = widowed ? survivorSs : (age >= ssClaimAge ? ssBenefit : 0);
			double qualified = taxable * yieldRate;         // realized dividends
			double rmd = RmdTable.required(age, birthYear, trad);
			double streamIncome = streamIncomeAt(req.incomeStreams(), age, currentAge, inflation);

			double conversion = 0;
			if (doConvert && age >= convStart && age <= convEnd && target > 0 && trad - rmd > 0) {
				conversion = fillToTarget(effFiling, over65, pension + rmd + streamIncome, ss, qualified, realScale, target);
				conversion = Math.min(conversion, trad - rmd);
				if (maxConv > 0) conversion = Math.min(conversion, maxConv);
				conversion = Math.max(0, conversion);
			}

			double ordinary = pension + rmd + streamIncome + conversion;
			FederalTax f = federal.compute(effFiling, over65, ordinary, ss, qualified, realScale);

			double stateBase = Math.max(0, f.taxableIncome() - (stateTaxesSs ? 0 : f.taxableSocialSecurity()));
			double stateTax = stateRate * stateBase;
			double magi = f.agi();
			double irmaa = IrmaaTable.surcharge(effFiling, magi, onMedicare, realScale);

			// ACA premium subsidy for pre-Medicare years (a conversion erodes it).
			double aca = 0;
			if (acaCoverage && acaBenchmark > 0 && age < 65) {
				aca = AcaSubsidy.premiumTaxCredit(magi, widowed ? 1 : acaHousehold, acaBenchmark);
			}

			double totalTax = f.totalTax() + stateTax + irmaa;

			// Move money: RMD and conversion leave pre-tax; conversion → Roth; RMD is
			// reinvested in taxable; the ACA subsidy is premium money you keep invested;
			// all taxes paid from taxable (then Roth, then pre-tax).
			trad -= (rmd + conversion);
			roth += conversion;
			taxable += rmd + aca;
			double owed = totalTax;
			double fromTaxable = Math.min(taxable, owed);
			taxable -= fromTaxable; owed -= fromTaxable;
			if (owed > 0) { double fromRoth = Math.min(roth, owed); roth -= fromRoth; owed -= fromRoth; }
			if (owed > 0) { trad = Math.max(0, trad - owed); }

			lifetimeIncomeTax += f.totalTax() + stateTax;
			lifetimeIrmaa += irmaa;
			lifetimeAca += aca;
			totalConverted += conversion;

			// Grow to end of year.
			trad *= (1 + realReturn);
			roth *= (1 + realReturn);
			taxable *= (1 + realReturn);

			points.add(new YearPoint(age, round(trad), round(roth), round(taxable),
				round(rmd), round(conversion), round(ordinary), round(f.taxableSocialSecurity()),
				round(f.totalTax()), round(stateTax), round(irmaa), round(aca), round(magi), widowed));
		}

		double endingWealth = roth + taxable + trad * (1 - terminalRate);

		return new StrategyOutcome(
			round(lifetimeIncomeTax),
			round(lifetimeIrmaa),
			round(lifetimeAca),
			round(lifetimeIncomeTax + lifetimeIrmaa),
			round(totalConverted),
			round(endingWealth),
			round(trad),
			round(roth),
			round(taxable),
			points
		);
	}

	/**
	 * How much to convert to bring ordinary taxable income up to {@code target}.
	 * Solved by binary search on the conversion amount, because the relationship
	 * isn't 1:1 — the standard deduction absorbs the first dollars, and inside the
	 * Social Security torpedo each converted dollar raises taxable income by more
	 * than a dollar. Monotonic, so bisection converges cleanly.
	 */
	private double fillToTarget(Filing filing, int over65, double baseOrdinary,
			double ss, double qualified, double realScale, double target) {
		double oti0 = federal.compute(filing, over65, baseOrdinary, ss, qualified, realScale).ordinaryTaxableIncome();
		if (oti0 >= target) return 0;

		double lo = 0, hi = target + 200_000; // generous upper bound; capped by caller
		for (int i = 0; i < 40; i++) {
			double mid = (lo + hi) / 2;
			double oti = federal.compute(filing, over65, baseOrdinary + mid, ss, qualified, realScale)
				.ordinaryTaxableIncome();
			if (oti < target) lo = mid; else hi = mid;
		}
		return (lo + hi) / 2;
	}

	/** Today's-dollars income from all streams active at the given age. */
	private double streamIncomeAt(java.util.List<com.home.Domain.IncomeStream> streams,
			int age, int currentAge, double inflation) {
		if (streams == null) return 0;
		double total = 0;
		for (var s : streams) total += s.realIncomeAt(age, age - currentAge, inflation);
		return total;
	}

	private static double nn(Double v, double fallback) {
		return v != null && v >= 0 ? v : fallback;
	}

	private static double round(double v) {
		return Math.round(v);
	}
}
