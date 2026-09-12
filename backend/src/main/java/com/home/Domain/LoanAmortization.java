package com.home.Domain;

import java.util.List;

/**
 * A full month-by-month amortization schedule for one loan (nominal dollars),
 * plus a payoff summary that compares the plan as entered against a baseline of
 * the same loan with no extra payments, increases, or refinance — so the effect
 * of those levers (interest saved, months saved) is visible.
 */
public record LoanAmortization(Summary summary, List<Row> rows) {

	/** One month of the schedule. Payment is scheduled principal+interest; extra is
	 *  additional principal (recurring + any lump sum) applied that month. */
	public record Row(
		int monthIndex,     // 1-based month from now
		int age,            // household (primary) age that month
		double payment,     // scheduled payment (principal + interest)
		double interest,    // interest portion
		double principal,   // scheduled principal portion
		double extra,       // extra principal applied this month
		double endingBalance
	) {}

	public record Summary(
		String label,
		double startingBalance,
		double annualRate,
		Integer payoffAge,        // null if not paid off within the horizon
		int payoffMonths,         // months until payoff (or horizon length if never)
		double totalInterest,
		double totalPaid,
		double baselineInterest,  // interest with no extras/increase/refi
		int baselineMonths,       // months to payoff in the baseline
		double interestSaved,     // baselineInterest - totalInterest
		int monthsSaved           // baselineMonths - payoffMonths
	) {}
}
