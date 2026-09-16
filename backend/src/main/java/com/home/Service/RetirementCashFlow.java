package com.home.Service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.ExpenseItem;
import com.home.Domain.RetirementProfile;
import com.home.tax.LoanSchedule;

/**
 * The single source of truth for a retirement year's cash flow, in today's
 * (inflation-adjusted) dollars.
 *
 * The projection, Monte Carlo, and ledger all need the same per-age picture —
 * guaranteed income (Social Security, pension, income streams) set against the
 * all-in spending need (living, healthcare, debt, and any long-term-care shock).
 * That logic used to be copy-pasted into all three services, which is how the
 * same expense bug came to be fixed three times. It now lives here once.
 *
 * The spending model: {@code desiredAnnualIncome} is the total expected need,
 * <em>all-in</em> — healthcare, debt payments, and any itemized expenses are
 * carve-outs within it, and the remainder is discretionary. So the goal is the
 * floor; spending only rises above it when those known costs exceed it. The LTC
 * shock is the one thing that adds on top of the all-in budget.
 *
 * Callers that model income tax (the ledger) add it on top of {@link
 * AnnualCashFlow#netNeed()}; callers that don't (projection, Monte Carlo) use
 * netNeed() directly, exactly as they did before.
 */
@Service
public class RetirementCashFlow {

	private final SocialSecurityService socialSecurity;

	public RetirementCashFlow(SocialSecurityService socialSecurity) {
		this.socialSecurity = socialSecurity;
	}

	/**
	 * A profile's cash flow at a single age, all figures in today's dollars.
	 *
	 * <ul>
	 *   <li>{@code living} — the all-in budget minus healthcare and debt: the
	 *       itemized-plus-discretionary remainder shown as its own ledger column.</li>
	 *   <li>{@code taxableStreams} — the taxable subset of {@code streams}, for the
	 *       ledger's tax calculation.</li>
	 * </ul>
	 */
	public record AnnualCashFlow(
			double socialSecurity,
			double pension,
			double streams,
			double taxableStreams,
			double living,
			double healthcare,
			double ltc,
			double loanPayment,
			double loanBalance,
			double oneTimeNet) {

		/** Total spending to fund this year (all-in budget plus the LTC shock). */
		public double allInSpending() {
			return living + healthcare + loanPayment + ltc;
		}

		/** Guaranteed income offsetting that spending. */
		public double guaranteedIncome() {
			return socialSecurity + pension + streams;
		}

		/**
		 * Portfolio cash the year needs before any income tax: spending − income, less
		 * any one-time cash flow (an inflow reduces the need — a surplus the caller
		 * reinvests; an outflow adds to it).
		 */
		public double netNeed() {
			return allInSpending() - guaranteedIncome() - oneTimeNet;
		}
	}

	/** Build a per-profile calculator; the loan amortization is computed once here. */
	public Calc forProfile(RetirementProfile p, int planThroughAge) {
		return new Calc(p, planThroughAge);
	}

	/** Stateful per-run calculator: holds the profile and its amortized loan schedule. */
	public class Calc {
		private final RetirementProfile p;
		private final LoanSchedule.Schedule loans;

		Calc(RetirementProfile p, int planThroughAge) {
			this.p = p;
			this.loans = LoanSchedule.compute(p.getLoans(), Math.max(0, p.getCurrentAge()),
				planThroughAge, p.getInflationRate());
		}

		public AnnualCashFlow at(int age) {
			double ss = socialSecurity.householdAnnualAt(p, age);
			double pension = age >= p.getRetirementAge() ? p.getAnnualPension() : 0;
			double streams = streamIncomeAt(age, false);
			double taxableStreams = streamIncomeAt(age, true);
			double healthcare = healthcareAt(age);
			double ltc = ltcAt(age);
			double loanPayment = loans.paymentAt(age);
			double loanBalance = loans.balanceAt(age);

			// After the first death the survivor may need less than the couple's goal.
			double goal = p.getDesiredAnnualIncome();
			if (SocialSecurityService.isWidowed(p, age)) goal *= p.getSurvivorSpendingFactor();
			double allIn = Math.max(goal, itemizedAt(age) + healthcare + loanPayment);
			double living = allIn - healthcare - loanPayment;
			return new AnnualCashFlow(ss, pension, streams, taxableStreams,
				living, healthcare, ltc, loanPayment, loanBalance, oneTimeNetAt(age));
		}

		/** Net signed one-time cash flow landing on an age (inflows − outflows). */
		private double oneTimeNetAt(int age) {
			List<com.home.Domain.OneTimeEvent> events = p.getOneTimeEvents();
			if (events == null) return 0;
			double total = 0;
			for (var e : events) total += e.netAt(age);
			return total;
		}

		/** Sum of itemized expenses active at an age (a carve-out within the goal). */
		private double itemizedAt(int age) {
			List<ExpenseItem> items = p.getExpenses();
			if (items == null) return 0;
			double total = 0;
			for (ExpenseItem e : items) total += e.realAmountAt(age, p.getCurrentAge(), p.getInflationRate());
			return total;
		}

		/** Today's-dollars income from streams active at an age; {@code taxableOnly}
		 *  restricts to taxable streams. A spouse-owned stream's ages are the spouse's,
		 *  translated onto the primary timeline. */
		private double streamIncomeAt(int age, boolean taxableOnly) {
			if (p.getIncomeStreams() == null) return 0;
			int currentAge = p.getCurrentAge();
			int spouseOffset = p.getSpouseAge() - currentAge; // spouse age = primary age + offset
			double total = 0;
			for (var s : p.getIncomeStreams()) {
				if (taxableOnly && !s.isTaxable()) continue;
				int ownerAge = s.isSpouseOwned() ? age + spouseOffset : age;
				total += s.realIncomeAt(ownerAge, age - currentAge, p.getInflationRate());
			}
			return total;
		}

		/** Today's-dollars healthcare at a retirement-year age; grows in real terms
		 *  because healthcare inflation typically outpaces general inflation. */
		private double healthcareAt(int age) {
			if (age < p.getRetirementAge() || p.getAnnualHealthcareCost() <= 0) return 0;
			double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
			return p.getAnnualHealthcareCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
		}

		/** Today's-dollars long-term-care cost during the LTC window (0 otherwise). */
		private double ltcAt(int age) {
			if (!p.isLtcEnabled() || p.getLtcAnnualCost() <= 0) return 0;
			int start = p.getLtcStartAge();
			if (age < start || age >= start + Math.max(1, p.getLtcYears())) return 0;
			double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
			return p.getLtcAnnualCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
		}

		/** The amortized loan schedule (payment/balance by age), exposed for callers. */
		public LoanSchedule.Schedule loans() {
			return loans;
		}
	}
}
