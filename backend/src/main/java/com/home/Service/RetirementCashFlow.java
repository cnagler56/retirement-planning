package com.home.Service;

import java.util.List;

import org.springframework.stereotype.Service;

import org.springframework.beans.factory.annotation.Autowired;

import com.home.Domain.ExpenseItem;
import com.home.Domain.IncomeStream;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;
import com.home.tax.LoanSchedule;
import com.home.tax.TaxConstants;
import com.home.tax.TaxConstants.Filing;

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
 *
 * Working years: when the profile has a paycheck (an income stream marked
 * "stops at retirement"), the years before retirement are real cash-flow years
 * too — the paycheck and other income against the same spending, with income
 * and payroll tax, the monthly contribution deferred pre-tax, and any surplus
 * saved. {@link Calc#workingYearPortfolioChange} gives that for the tax-free
 * projection and Monte Carlo; the ledger runs its own bucket-aware version.
 */
@Service
public class RetirementCashFlow {

	private final SocialSecurityService socialSecurity;
	private final FederalTaxService federal;

	@Autowired
	public RetirementCashFlow(SocialSecurityService socialSecurity, FederalTaxService federal) {
		this.socialSecurity = socialSecurity;
		this.federal = federal;
	}

	public RetirementCashFlow(SocialSecurityService socialSecurity) {
		this(socialSecurity, new FederalTaxService());
	}

	/**
	 * A profile's cash flow at a single age, all figures in today's dollars.
	 *
	 * <ul>
	 *   <li>{@code living} — the all-in budget minus healthcare and debt: the
	 *       itemized-plus-discretionary remainder shown as its own ledger column.</li>
	 *   <li>{@code taxableStreams} — the taxable subset of {@code streams}, for the
	 *       ledger's tax calculation.</li>
	 *   <li>{@code payrollTax} — FICA on paycheck streams (0 once retired).</li>
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
			double oneTimeNet,
			double payrollTax) {

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
				living, healthcare, ltc, loanPayment, loanBalance, oneTimeNetAt(age), payrollTaxAt(age));
		}

		/**
		 * How a working year changes the portfolio, before investment growth, for the
		 * models that don't track tax buckets (projection, Monte Carlo): income minus
		 * spending minus income and payroll tax. Positive = saved (this already includes
		 * the pre-tax monthly contribution, which is spent into the portfolio); negative
		 * = the paycheck fell short and savings covered it.
		 */
		public double workingYearPortfolioChange(int age) {
			AnnualCashFlow cf = at(age);
			double contribution = p.getMonthlyContribution() * 12;
			return -cf.netNeed() - workingYearIncomeTax(age, cf, contribution) - cf.payrollTax();
		}

		/** Federal + flat state income tax for a working year; the contribution is a pre-tax deferral. */
		private double workingYearIncomeTax(int age, AnnualCashFlow cf, double contribution) {
			int t = Math.max(0, age - p.getCurrentAge());
			double realScale = Math.pow(1 + p.getInflationRate(), -t);
			boolean widowed = SocialSecurityService.isWidowed(p, age);
			boolean married = !"SINGLE".equalsIgnoreCase(p.getFilingStatus());
			Filing filing = married && !widowed ? Filing.MARRIED_JOINT : Filing.SINGLE;
			int spouseAge = age + p.getSpouseAge() - p.getCurrentAge();
			int over65 = (age >= 65 ? 1 : 0) + (filing == Filing.MARRIED_JOINT && spouseAge >= 65 ? 1 : 0);
			double ordinary = Math.max(0, cf.taxableStreams() - contribution);
			var f = federal.compute(filing, over65, ordinary, cf.socialSecurity(), 0, realScale, TaxConstants.TAX_YEAR + t);
			double state = p.getStateTaxRate() * Math.max(0, f.taxableIncome() - f.taxableSocialSecurity());
			return f.totalTax() + state;
		}

		/** FICA on paycheck streams active at an age (each stream treated as one earner).
		 *  Each paycheck stops at its own owner's retirement age. */
		private double payrollTaxAt(int age) {
			if (p.getIncomeStreams() == null) return 0;
			double total = 0;
			for (IncomeStream s : p.getIncomeStreams()) {
				if (!s.isEndsAtRetirement() || !s.isTaxable() || paycheckEnded(s, age)) continue;
				total += TaxConstants.payrollTax(streamAt(s, age));
			}
			return total;
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
			double total = 0;
			for (var s : p.getIncomeStreams()) {
				if (taxableOnly && !s.isTaxable()) continue;
				total += streamAt(s, age);
			}
			return total;
		}

		/** One stream's today's-dollars income at a primary age. A paycheck stops at its
		 *  owner's retirement age (the spouse's own age for a spouse-owned paycheck),
		 *  whatever the stream's own end age says. */
		private double streamAt(IncomeStream s, int age) {
			if (s.isEndsAtRetirement() && paycheckEnded(s, age)) return 0;
			int currentAge = p.getCurrentAge();
			int ownerAge = s.isSpouseOwned() ? age + (p.getSpouseAge() - currentAge) : age;
			return s.realIncomeAt(ownerAge, age - currentAge, p.getInflationRate(), s.isEndsAtRetirement());
		}

		/** Whether a paycheck has stopped by a given primary age — at the spouse's own
		 *  retirement age for a spouse-owned paycheck (falling back to the household's),
		 *  otherwise the primary's. */
		private boolean paycheckEnded(IncomeStream s, int age) {
			if (s.isSpouseOwned()) {
				int spouseRet = p.getSpouseRetirementAge() > 0 ? p.getSpouseRetirementAge() : p.getRetirementAge();
				int spouseAge = age + (p.getSpouseAge() - p.getCurrentAge());
				return spouseAge >= spouseRet;
			}
			return age >= p.getRetirementAge();
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
