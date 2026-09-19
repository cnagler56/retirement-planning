package com.home.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.LedgerResult;
import com.home.Domain.LedgerResult.LedgerRow;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;
import com.home.tax.FederalTaxService.FederalTax;
import com.home.tax.IrmaaTable;
import com.home.tax.RmdTable;
import com.home.tax.TaxConstants.Filing;
import com.home.tax.WithdrawalSequencer;
import com.home.tax.WithdrawalStrategy;

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
 * capital (only its dividend yield is taxed); Social Security holds its real value
 * unless its COLA is set below inflation, in which case the benefit erodes.
 */
@Service
public class LedgerService {

	private final FederalTaxService federal;
	private final RetirementCashFlow cashFlow;

	public LedgerService(FederalTaxService federal, RetirementCashFlow cashFlow) {
		this.federal = federal;
		this.cashFlow = cashFlow;
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
		WithdrawalStrategy strategy = WithdrawalStrategy.from(p.getWithdrawalStrategy());
		double taxEfficientTargetRate = p.getWithdrawalBracketPct() / 100.0; // e.g. 12 → 0.12

		// Grow current balances (plus contributions to pre-tax) up to retirement.
		double trad = Math.max(0, p.getTradBalance());
		double roth = Math.max(0, p.getRothBalance());
		double taxable = Math.max(0, p.getTaxableBalance());
		// Fall back to the single "Retirement Savings" total when the buckets aren't
		// itemized, so the ledger starts from the same portfolio the projection uses
		// instead of $0. Placed in the taxable bucket — the closest match to the
		// projection's untaxed blended drawdown (only its dividend yield is taxed).
		if (trad + roth + taxable <= 0 && p.getCurrentSavings() > 0) {
			taxable = p.getCurrentSavings();
		}
		double annualContribution = p.getMonthlyContribution() * 12;
		for (int age = currentAge; age < retirementAge; age++) {
			trad = trad * (1 + realReturn) + annualContribution;
			roth *= (1 + realReturn);
			taxable *= (1 + realReturn);
		}

		RetirementCashFlow.Calc cash = cashFlow.forProfile(p, planThrough);

		List<LedgerRow> rows = new ArrayList<>();
		Integer moneyLastsToAge = null;

		for (int age = retirementAge; age <= planThrough; age++) {
			int t = age - currentAge;
			double realScale = Math.pow(1 + inflation, -t);
			// After the first death the survivor files single with compressed brackets and
			// halved IRMAA thresholds — the widow's penalty — and one fewer person on Medicare.
			boolean widowed = SocialSecurityService.isWidowed(p, age);
			Filing yearFiling = widowed ? Filing.SINGLE : filing;
			int over65 = widowed
				? (age >= 65 ? 1 : 0)
				: (age >= 65 ? 1 : 0) + (married && (age + spouseAgeOffset) >= 65 ? 1 : 0);
			int onMedicare = over65;

			double startBalance = trad + roth + taxable;
			RetirementCashFlow.AnnualCashFlow cf = cash.at(age);
			double ss = cf.socialSecurity();
			double pension = cf.pension();
			double streams = cf.streams();
			double taxableStreams = cf.taxableStreams();
			double qualified = taxable * yieldRate;
			double loanPayment = cf.loanPayment();
			double loanBalance = cf.loanBalance();
			// The all-in budget breaks into the "living" column (discretionary + itemized),
			// healthcare, and debt; only the LTC shock adds on top.
			double living = cf.living();
			double health = cf.healthcare() + cf.ltc();
			double expenses = cf.allInSpending();
			double oneTime = cf.oneTimeNet(); // + inflow reduces the need, − outflow adds to it

			double rmd = RmdTable.required(age, birthYear, trad);

			// Gross-up loop: solve for the withdrawals that also cover their own tax.
			double tax = 0, fedTax = 0, stateTax = 0, irmaa = 0, taxableSs = 0;
			double wTaxable = 0, wTradExtra = 0, wRoth = 0;
			boolean shortfall = false;
			for (int iter = 0; iter < 6; iter++) {
				double need = expenses + tax - ss - pension - streams - oneTime; // total portfolio cash needed
				double remaining = Math.max(0, need - rmd);              // beyond the forced RMD
				// Tax-efficient fills pre-tax up to the target bracket; others ignore fillRoom.
				double fillRoom = strategy == WithdrawalStrategy.TAX_EFFICIENT
					? WithdrawalSequencer.bracketFillRoom(yearFiling, over65, pension + rmd + taxableStreams,
						taxEfficientTargetRate, realScale)
					: 0;
				WithdrawalSequencer.Draw draw = WithdrawalSequencer.source(
					strategy, remaining, taxable, Math.max(0, trad - rmd), roth, fillRoom);
				wTaxable = draw.fromTaxable();
				wTradExtra = draw.fromTradExtra();
				wRoth = draw.fromRoth();
				shortfall = draw.shortfall();

				double ordinary = pension + rmd + wTradExtra + taxableStreams;
				FederalTax f = federal.compute(yearFiling, over65, ordinary, ss, qualified, realScale);
				taxableSs = f.taxableSocialSecurity();
				fedTax = f.totalTax();
				stateTax = stateRate * Math.max(0, f.taxableIncome() - f.taxableSocialSecurity());
				irmaa = IrmaaTable.surcharge(yearFiling, f.agi(), onMedicare, realScale);
				double newTax = fedTax + stateTax + irmaa;
				if (Math.abs(newTax - tax) < 1) { tax = newTax; break; }
				tax = newTax;
			}

			// Apply flows, then grow the remaining balances.
			trad = Math.max(0, trad - rmd - wTradExtra);
			taxable = Math.max(0, taxable - wTaxable);
			roth = Math.max(0, roth - wRoth);
			// RMD not needed for spending is parked in taxable.
			double rmdSurplus = Math.max(0, (rmd + wTaxable + wTradExtra + wRoth) - (expenses + tax - ss - pension - streams - oneTime));
			taxable += Math.max(0, rmdSurplus);

			trad *= (1 + realReturn);
			roth *= (1 + realReturn);
			taxable *= (1 + realReturn);

			if (shortfall && moneyLastsToAge == null) moneyLastsToAge = age;

			double endTotal = trad + roth + taxable;
			rows.add(new LedgerRow(
				age, round(startBalance), round(ss), round(pension), round(streams),
				round(rmd), round(wTaxable + wTradExtra + wRoth), round(oneTime),
				round(living), round(health), round(loanPayment), round(loanBalance),
				round(fedTax), round(stateTax), round(irmaa), round(taxableSs),
				round(trad), round(roth), round(taxable), round(endTotal), shortfall));
		}

		return new LedgerResult(rows, moneyLastsToAge, round4(realReturn), rmdStart);
	}

	private static double round(double v) { return Math.round(v); }
	private static double round4(double v) { return Math.round(v * 10000.0) / 10000.0; }
}
