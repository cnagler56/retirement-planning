package com.home.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.ExpenseItem;
import com.home.Domain.LedgerResult;
import com.home.Domain.LedgerResult.LedgerRow;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;
import com.home.tax.FederalTaxService.FederalTax;
import com.home.tax.IrmaaTable;
import com.home.tax.RmdTable;
import com.home.tax.TaxConstants.Filing;

/**
 * A full retirement cash-flow ledger, in today's (inflation-adjusted) dollars.
 *
 * It first grows the current balances (plus contributions) to the retirement age
 * across three buckets — pre-tax, Roth, taxable — then, each year through the
 * horizon, plays out the real mechanics:
 *
 *  1. Required minimum distributions from the pre-tax account (age 73/75).
 *  2. Income that reduces the withdrawal need — Social Security, pension, streams.
 *  3. Expenses — itemized living costs, healthcare, and any long-term-care shock.
 *  4. Taxes — federal (with the Social Security worksheet, capital gains, NIIT),
 *     a flat state tax, and Medicare IRMAA — solved with a small gross-up loop so
 *     the withdrawal covers the tax it itself creates.
 *  5. Withdrawals to cover the gap, drawn taxable → pre-tax → Roth, then growth.
 *
 * Deterministic (expected return, not Monte Carlo). Simplifications: contributions
 * go to the pre-tax bucket; taxable-account withdrawals are treated as return of
 * capital (only its dividend yield is taxed); Social Security holds its real value.
 */
@Service
public class LedgerService {

	private final FederalTaxService federal;
	private final SocialSecurityService socialSecurity;

	public LedgerService(FederalTaxService federal, SocialSecurityService socialSecurity) {
		this.federal = federal;
		this.socialSecurity = socialSecurity;
	}

	public LedgerResult compute(RetirementProfile p) {
		int currentAge = Math.max(0, p.getCurrentAge());
		int retirementAge = Math.max(currentAge, p.getRetirementAge());
		int planThrough = Math.max(retirementAge, p.getPlanThroughAge() > 0 ? p.getPlanThroughAge() : 95);
		int birthYear = p.getBirthYear();
		int rmdStart = RmdTable.startAge(birthYear);

		double inflation = p.getInflationRate();
		double realReturn = (1 + p.getAnnualReturnRate()) / (1 + inflation) - 1;
		double yieldRate = 0.02; // taxable dividends as a share of the taxable balance

		Filing filing = "SINGLE".equalsIgnoreCase(p.getFilingStatus()) ? Filing.SINGLE : Filing.MARRIED_JOINT;
		boolean married = filing == Filing.MARRIED_JOINT;
		int spouseAgeOffset = p.getSpouseAge() - currentAge; // spouse age = primary age + offset
		double stateRate = p.getStateTaxRate();

		// Social Security (today's dollars) from the claim age onward.
		double ssAnnual = 0;
		int claimAge = p.getSsClaimAge();
		if (p.getSsMonthlyAtFra() > 0 && claimAge >= 62) {
			ssAnnual = socialSecurity.monthlyBenefit(birthYear, p.getSsMonthlyAtFra(), claimAge) * 12;
		}

		// Grow current balances (plus contributions to pre-tax) up to retirement.
		double trad = Math.max(0, p.getTradBalance());
		double roth = Math.max(0, p.getRothBalance());
		double taxable = Math.max(0, p.getTaxableBalance());
		double annualContribution = p.getMonthlyContribution() * 12;
		for (int age = currentAge; age < retirementAge; age++) {
			trad = trad * (1 + realReturn) + annualContribution;
			roth *= (1 + realReturn);
			taxable *= (1 + realReturn);
		}

		List<LedgerRow> rows = new ArrayList<>();
		Integer moneyLastsToAge = null;

		for (int age = retirementAge; age <= planThrough; age++) {
			int t = age - currentAge;
			double realScale = Math.pow(1 + inflation, -t);
			int over65 = (age >= 65 ? 1 : 0) + (married && (age + spouseAgeOffset) >= 65 ? 1 : 0);
			int onMedicare = over65;

			double startBalance = trad + roth + taxable;
			double ss = age >= claimAge ? ssAnnual : 0;
			double pension = incomeAt(p, age, "pension");
			double streams = streamIncomeAt(p, age);
			double qualified = taxable * yieldRate;
			double living = livingExpensesAt(p, age);
			double health = healthcareAt(p, age) + ltcAt(p, age);
			double expenses = living + health;

			double rmd = RmdTable.required(age, birthYear, trad);

			// Gross-up loop: solve for the withdrawals that also cover their own tax.
			double tax = 0, fedTax = 0, stateTax = 0, irmaa = 0, taxableSs = 0;
			double wTaxable = 0, wTradExtra = 0, wRoth = 0;
			boolean shortfall = false;
			for (int iter = 0; iter < 6; iter++) {
				double need = expenses + tax - ss - pension - streams; // total portfolio cash needed
				double remaining = Math.max(0, need - rmd);              // beyond the forced RMD
				wTaxable = Math.min(taxable, remaining); remaining -= wTaxable;
				wTradExtra = Math.min(Math.max(0, trad - rmd), remaining); remaining -= wTradExtra;
				wRoth = Math.min(roth, remaining); remaining -= wRoth;
				shortfall = remaining > 1;

				double ordinary = pension + rmd + wTradExtra;
				FederalTax f = federal.compute(filing, over65, ordinary, ss, qualified, realScale);
				taxableSs = f.taxableSocialSecurity();
				fedTax = f.totalTax();
				stateTax = stateRate * Math.max(0, f.taxableIncome() - f.taxableSocialSecurity());
				irmaa = IrmaaTable.surcharge(filing, f.agi(), onMedicare, realScale);
				double newTax = fedTax + stateTax + irmaa;
				if (Math.abs(newTax - tax) < 1) { tax = newTax; break; }
				tax = newTax;
			}

			// Apply flows, then grow the remaining balances.
			trad = Math.max(0, trad - rmd - wTradExtra);
			taxable = Math.max(0, taxable - wTaxable);
			roth = Math.max(0, roth - wRoth);
			// RMD not needed for spending is parked in taxable.
			double rmdSurplus = Math.max(0, (rmd + wTaxable + wTradExtra + wRoth) - (expenses + tax - ss - pension - streams));
			taxable += Math.max(0, rmdSurplus);

			trad *= (1 + realReturn);
			roth *= (1 + realReturn);
			taxable *= (1 + realReturn);

			if (shortfall && moneyLastsToAge == null) moneyLastsToAge = age;

			double endTotal = trad + roth + taxable;
			rows.add(new LedgerRow(
				age, round(startBalance), round(ss), round(pension), round(streams),
				round(rmd), round(wTaxable + wTradExtra + wRoth),
				round(living), round(health),
				round(fedTax), round(stateTax), round(irmaa), round(taxableSs),
				round(trad), round(roth), round(taxable), round(endTotal), shortfall));
		}

		return new LedgerResult(rows, moneyLastsToAge, round4(realReturn), rmdStart);
	}

	/** Living expenses at an age: itemized expenses if any, else the base spending goal. */
	private double livingExpensesAt(RetirementProfile p, int age) {
		List<ExpenseItem> items = p.getExpenses();
		if (items == null || items.isEmpty()) return p.getDesiredAnnualIncome();
		double total = 0;
		for (ExpenseItem e : items) total += e.realAmountAt(age, p.getCurrentAge(), p.getInflationRate());
		return total;
	}

	private double streamIncomeAt(RetirementProfile p, int age) {
		if (p.getIncomeStreams() == null) return 0;
		double total = 0;
		for (var s : p.getIncomeStreams()) total += s.realIncomeAt(age, p.getCurrentAge(), p.getInflationRate());
		return total;
	}

	private double incomeAt(RetirementProfile p, int age, String kind) {
		// Pension flows from retirement onward (today's dollars).
		return age >= p.getRetirementAge() ? p.getAnnualPension() : 0;
	}

	private double healthcareAt(RetirementProfile p, int age) {
		if (age < p.getRetirementAge() || p.getAnnualHealthcareCost() <= 0) return 0;
		double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
		return p.getAnnualHealthcareCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
	}

	private double ltcAt(RetirementProfile p, int age) {
		if (!p.isLtcEnabled() || p.getLtcAnnualCost() <= 0) return 0;
		int start = p.getLtcStartAge();
		if (age < start || age >= start + Math.max(1, p.getLtcYears())) return 0;
		double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
		return p.getLtcAnnualCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
	}

	private static double round(double v) { return Math.round(v); }
	private static double round4(double v) { return Math.round(v * 10000.0) / 10000.0; }
}
