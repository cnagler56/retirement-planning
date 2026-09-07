package com.home.Domain;

import java.util.List;

/**
 * Result of the lifetime Roth comparison — a no-conversion baseline versus a
 * bracket-filling conversion strategy, in today's dollars.
 *
 * @param rmdStartAge         age RMDs begin for this person (73 or 75)
 * @param baseline            outcome with no conversions
 * @param converted           outcome running the conversion strategy
 * @param lifetimeTaxSaved    baseline lifetime tax − converted lifetime tax (incl. IRMAA)
 * @param endingWealthAdvantage converted ending after-tax wealth − baseline's
 * @param convertRecommended  whether the conversion strategy ends with more wealth
 */
public record LifetimeRothResult(
		int rmdStartAge,
		StrategyOutcome baseline,
		StrategyOutcome converted,
		double lifetimeTaxSaved,
		double endingWealthAdvantage,
		boolean convertRecommended) {

	/**
	 * One strategy's lifetime totals and year-by-year path.
	 *
	 * @param lifetimeIncomeTax   federal + state income tax over the whole plan
	 * @param lifetimeIrmaa       Medicare IRMAA surcharges over the whole plan
	 * @param lifetimeTaxTotal    income tax + IRMAA
	 * @param totalConverted      total dollars converted to Roth
	 * @param endingAfterTaxWealth after-tax value of all accounts at the horizon
	 * @param endingTrad/Roth/Taxable  ending balances by bucket
	 * @param points              year-by-year detail
	 */
	public record StrategyOutcome(
			double lifetimeIncomeTax,
			double lifetimeIrmaa,
			double lifetimeAcaSubsidy,
			double lifetimeTaxTotal,
			double totalConverted,
			double endingAfterTaxWealth,
			double endingTrad,
			double endingRoth,
			double endingTaxable,
			List<YearPoint> points) {}

	/**
	 * A single simulated year (today's dollars).
	 *
	 * @param age          age that year
	 * @param trad/roth/taxable  end-of-year balances
	 * @param rmd          required minimum distribution taken
	 * @param conversion   amount converted that year
	 * @param ordinaryIncome ordinary income (pension + RMD + conversion)
	 * @param taxableSs    Social Security pulled into taxable income
	 * @param federalTax   federal income tax
	 * @param stateTax     state income tax
	 * @param irmaa        Medicare IRMAA surcharge
	 * @param magi         modified AGI (drives IRMAA)
	 */
	public record YearPoint(
			int age,
			double trad,
			double roth,
			double taxable,
			double rmd,
			double conversion,
			double ordinaryIncome,
			double taxableSs,
			double federalTax,
			double stateTax,
			double irmaa,
			double acaSubsidy,
			double magi,
			boolean widowed) {}
}
