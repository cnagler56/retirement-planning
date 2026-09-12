package com.home.tax;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.home.Domain.Loan;
import com.home.Domain.LoanAmortization;

/**
 * Amortizes a household's loans month by month, honoring extra payments, one-time
 * lump sums, an annual payment increase, and a future refinance. The monthly
 * simulation is shared: {@link #compute} rolls it up into per-year figures for the
 * projection / Monte Carlo / ledger, while {@link #amortize} returns the full
 * month-by-month schedule plus a payoff summary (with a no-extras baseline) for
 * the Loans page.
 *
 * Payments and balances are nominal (fixed-dollar) and are reported that way — a
 * fixed loan payment stays constant year over year, matching the statement and the
 * amortization schedule, rather than being deflated into the plan's real dollars.
 */
public final class LoanSchedule {

	private LoanSchedule() {}

	/**
	 * @param paymentByAge nominal loan cash outflow in each year (scheduled + extra),
	 *                     indexed by (age - currentAge)
	 * @param balanceByAge nominal remaining balance at the end of each year, same index
	 */
	public record Schedule(double[] paymentByAge, double[] balanceByAge, int currentAge) {
		public double paymentAt(int age) {
			int i = age - currentAge;
			return i >= 0 && i < paymentByAge.length ? paymentByAge[i] : 0;
		}
		public double balanceAt(int age) {
			int i = age - currentAge;
			return i >= 0 && i < balanceByAge.length ? balanceByAge[i] : 0;
		}
	}

	/** Per-year real rollup across all loans, for the projection/ledger. */
	public static Schedule compute(List<Loan> loans, int currentAge, int maxAge, double inflation) {
		int n = Math.max(0, maxAge - currentAge) + 1;
		double[] payment = new double[n];
		double[] balance = new double[n];
		if (loans == null) return new Schedule(payment, balance, currentAge);

		for (Loan loan : loans) {
			List<LoanAmortization.Row> rows = amortizeMonths(loan, currentAge, maxAge);
			if (rows.isEmpty()) continue;

			// Cash outflow per year and end-of-year balance, keyed by age.
			double[] yearOut = new double[n];
			double[] yearEndBal = new double[n];
			boolean[] seen = new boolean[n];
			for (LoanAmortization.Row r : rows) {
				int i = r.age() - currentAge;
				if (i < 0 || i >= n) continue;
				yearOut[i] += r.payment() + r.extra();
				yearEndBal[i] = r.endingBalance(); // last month wins
				seen[i] = true;
			}
			for (int i = 0; i < n; i++) {
				// Loan payments and balances are nominal-fixed and shown as such —
				// a fixed mortgage payment stays constant, matching the statement and
				// the amortization schedule (not deflated to real dollars).
				payment[i] += yearOut[i];
				if (seen[i]) balance[i] += Math.max(0, yearEndBal[i]);
			}
		}
		return new Schedule(payment, balance, currentAge);
	}

	/** Full monthly schedule + payoff summary for a single loan (nominal dollars). */
	public static LoanAmortization amortize(Loan loan, int currentAge, int maxAge) {
		List<LoanAmortization.Row> rows = amortizeMonths(loan, currentAge, maxAge);

		double totalInterest = 0, totalPaid = 0;
		for (LoanAmortization.Row r : rows) {
			totalInterest += r.interest();
			totalPaid += r.payment() + r.extra();
		}
		boolean paidOff = !rows.isEmpty() && rows.get(rows.size() - 1).endingBalance() <= 0.5;
		Integer payoffAge = paidOff ? rows.get(rows.size() - 1).age() : null;
		int payoffMonths = rows.size();

		// Baseline: same loan with no extras, increase, or refinance.
		Loan base = new Loan();
		base.setLabel(loan.getLabel());
		base.setBalance(loan.getBalance());
		base.setAnnualRate(loan.getAnnualRate());
		base.setMonthlyPayment(loan.getMonthlyPayment());
		base.setStartAge(loan.getStartAge());
		List<LoanAmortization.Row> baseRows = amortizeMonths(base, currentAge, maxAge);
		double baselineInterest = 0;
		for (LoanAmortization.Row r : baseRows) baselineInterest += r.interest();
		int baselineMonths = baseRows.size();

		LoanAmortization.Summary summary = new LoanAmortization.Summary(
			loan.getLabel(),
			round(loan.getBalance()),
			loan.getAnnualRate(),
			payoffAge,
			payoffMonths,
			round(totalInterest),
			round(totalPaid),
			round(baselineInterest),
			baselineMonths,
			round(baselineInterest - totalInterest),
			baselineMonths - payoffMonths
		);
		return new LoanAmortization(summary, rows);
	}

	/**
	 * Month-by-month amortization of one loan (nominal), from the loan's start age
	 * until it is paid off or the horizon is reached. Applies, in order: an annual
	 * payment increase, a refinance (rate change and optional re-amortization), and
	 * extra principal — recurring monthly plus any one-time lump sums.
	 */
	private static List<LoanAmortization.Row> amortizeMonths(Loan loan, int currentAge, int maxAge) {
		List<LoanAmortization.Row> rows = new ArrayList<>();
		if (loan == null || loan.getBalance() <= 0 || loan.getMonthlyPayment() <= 0) return rows;

		double bal = loan.getBalance();
		int start = loan.getStartAge() > 0 ? loan.getStartAge() : currentAge;
		double mRate = loan.getAnnualRate() / 12.0;
		double payment = loan.getMonthlyPayment();
		double incPct = loan.getPaymentAnnualIncreasePct();
		double extraMonthly = Math.max(0, loan.getExtraMonthly());
		Map<Integer, Double> lumps = parseLumpSums(loan.getLumpSums());
		boolean refinanced = false;
		int pmtNumber = 0;

		for (int age = start; age <= maxAge && bal > 0.5; age++) {
			if (age > start && incPct != 0) payment *= (1 + incPct);

			if (!refinanced && loan.getRefinanceAge() > 0 && age >= loan.getRefinanceAge()) {
				mRate = loan.getRefinanceRate() / 12.0;
				if (loan.getRefinanceTermYears() > 0) {
					payment = amortizedPayment(bal, mRate, loan.getRefinanceTermYears() * 12);
				}
				refinanced = true;
			}

			double lumpThisYear = lumps.getOrDefault(age, 0.0);

			for (int m = 0; m < 12 && bal > 0.5; m++) {
				double interest = bal * mRate;
				double scheduled = Math.min(payment, bal + interest); // never overpay
				double principalPortion = scheduled - interest;
				double afterScheduled = Math.max(0, bal - principalPortion);

				double extra = extraMonthly;
				if (m == 0 && lumpThisYear > 0) extra += lumpThisYear;
				if (extra > afterScheduled) extra = afterScheduled; // don't pay past zero

				bal = afterScheduled - extra;
				if (bal < 0) bal = 0;

				rows.add(new LoanAmortization.Row(
					++pmtNumber, age,
					round(scheduled), round(interest), round(principalPortion), round(extra), round(bal)));
			}
		}
		return rows;
	}

	/** Standard mortgage payment to retire {@code bal} over {@code nMonths} at monthly {@code mRate}. */
	private static double amortizedPayment(double bal, double mRate, int nMonths) {
		if (nMonths <= 0) return bal;
		if (mRate <= 0) return bal / nMonths;
		return bal * mRate / (1 - Math.pow(1 + mRate, -nMonths));
	}

	/** Parse "age:amount;age:amount" (or comma-separated) into age → total lump sum. */
	private static Map<Integer, Double> parseLumpSums(String spec) {
		Map<Integer, Double> out = new HashMap<>();
		if (spec == null || spec.isBlank()) return out;
		for (String part : spec.split("[;,]")) {
			String s = part.trim();
			if (s.isEmpty()) continue;
			int colon = s.indexOf(':');
			if (colon <= 0) continue;
			try {
				int age = Integer.parseInt(s.substring(0, colon).trim());
				double amt = Double.parseDouble(s.substring(colon + 1).trim());
				if (amt > 0) out.merge(age, amt, Double::sum);
			} catch (NumberFormatException ignored) {
				// skip malformed entries
			}
		}
		return out;
	}

	private static double round(double v) { return Math.round(v); }
}
