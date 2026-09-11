package com.home.tax;

import java.util.List;

import com.home.Domain.Loan;

/**
 * Amortizes a household's loans month by month and rolls the result up into
 * per-year figures in today's (inflation-adjusted) dollars, so the projection,
 * Monte Carlo, and ledger can all treat loan payments as an expense and show the
 * remaining balance. Payments and balances are nominal-fixed, so they erode in
 * real terms — deflated here by inflation from the current age.
 */
public final class LoanSchedule {

	private LoanSchedule() {}

	/**
	 * @param paymentByAge real loan payment made in each year, indexed by (age - currentAge)
	 * @param balanceByAge real remaining balance at the end of each year, same index
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

	public static Schedule compute(List<Loan> loans, int currentAge, int maxAge, double inflation) {
		int n = Math.max(0, maxAge - currentAge) + 1;
		double[] payment = new double[n];
		double[] balance = new double[n];
		if (loans == null) return new Schedule(payment, balance, currentAge);

		for (Loan loan : loans) {
			if (loan.getBalance() <= 0 || loan.getMonthlyPayment() <= 0) continue;
			double bal = loan.getBalance();
			double mRate = loan.getAnnualRate() / 12.0;
			int start = loan.getStartAge() > 0 ? loan.getStartAge() : currentAge;

			for (int age = currentAge; age <= maxAge; age++) {
				int i = age - currentAge;
				double yearPaymentNominal = 0;
				if (age >= start && bal > 0.5) {
					for (int m = 0; m < 12 && bal > 0.5; m++) {
						double interest = bal * mRate;
						double pay = Math.min(loan.getMonthlyPayment(), bal + interest);
						bal = bal + interest - pay;
						yearPaymentNominal += pay;
						if (bal < 0) bal = 0;
					}
				}
				double deflator = Math.pow(1 + inflation, -(age - currentAge));
				payment[i] += yearPaymentNominal * deflator;
				balance[i] += Math.max(0, bal) * deflator;
			}
		}
		return new Schedule(payment, balance, currentAge);
	}
}
