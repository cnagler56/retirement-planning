package com.home.Domain;

import java.util.List;

/**
 * A full year-by-year retirement cash-flow ledger, in today's (inflation-adjusted)
 * dollars, from retirement age through the planning horizon.
 *
 * @param rows              one row per year
 * @param moneyLastsToAge   age the portfolio is exhausted, or null if it lasts
 * @param realReturn        the real (inflation-adjusted) return used
 * @param rmdStartAge       age RMDs begin (73 or 75)
 */
public record LedgerResult(
		List<LedgerRow> rows,
		Integer moneyLastsToAge,
		double realReturn,
		int rmdStartAge) {

	/**
	 * One year of the plan. Income sources and expenses are what happened that
	 * year; balances are end-of-year by account (today's dollars).
	 *
	 * @param age              age that year
	 * @param startBalance     total portfolio at the start of the year
	 * @param socialSecurity   Social Security income
	 * @param pension          pension income
	 * @param otherIncome      income streams (rental, annuity, inherited-land, …)
	 * @param rmd              required minimum distribution taken
	 * @param withdrawal       portfolio withdrawal beyond the RMD, to cover the gap
	 * @param livingExpenses   itemized living expenses (or the base spending goal)
	 * @param healthcare       healthcare + long-term-care costs
	 * @param federalTax       federal income tax
	 * @param stateTax         state income tax
	 * @param irmaa            Medicare IRMAA surcharge
	 * @param taxableSs        Social Security pulled into taxable income
	 * @param endTrad/Roth/Taxable  end-of-year balances by account
	 * @param endTotal         total end-of-year portfolio
	 * @param shortfall        true if the portfolio couldn't cover the year's needs
	 */
	public record LedgerRow(
			int age,
			double startBalance,
			double socialSecurity,
			double pension,
			double otherIncome,
			double rmd,
			double withdrawal,
			double livingExpenses,
			double healthcare,
			double loanPayment,
			double loanBalance,
			double federalTax,
			double stateTax,
			double irmaa,
			double taxableSs,
			double endTrad,
			double endRoth,
			double endTaxable,
			double endTotal,
			boolean shortfall) {}
}
