package com.home.Domain;

/**
 * Inputs for the multi-year lifetime Roth conversion comparison. All dollar
 * amounts are in today's dollars.
 *
 * @param filingStatus        "SINGLE" or "MARRIED_JOINT"
 * @param currentAge          the primary filer's current age
 * @param spouseAge           spouse's current age (married-joint only)
 * @param planThroughAge      age to run the simulation to
 * @param tradBalance         pre-tax (Traditional IRA / 401k) balance
 * @param rothBalance         existing Roth balance
 * @param taxableBalance      taxable brokerage balance (pays taxes; holds reinvested RMDs)
 * @param annualPension       ordinary pension income per year (0 if none)
 * @param annualSocialSecurity gross Social Security per year once claimed
 * @param ssClaimAge          age Social Security begins
 * @param investmentReturn    expected nominal annual return (decimal)
 * @param inflationRate       expected annual inflation (decimal)
 * @param taxableYieldRate    fraction of the taxable balance realized as qualified
 *                            dividends each year (taxed; the rest is deferred growth)
 * @param stateTaxRate        flat state income-tax rate (decimal)
 * @param stateTaxesSs        whether the state taxes Social Security benefits
 * @param terminalTradRate    rate used to value any remaining pre-tax balance at the end
 * @param convStartAge        first age to convert (conversion strategy)
 * @param convEndAge          last age to convert
 * @param targetTaxableIncome fill ordinary taxable income up to this each conversion year
 * @param maxAnnualConversion optional cap on the yearly conversion (0 = no cap)
 * @param firstDeathAge       age (of the primary's timeline) at which the first spouse
 *                            dies; afterward the survivor files Single on nearly the same
 *                            income — the "widow's penalty" (0 = not modeled)
 * @param survivorSocialSecurity the survivor's continuing annual benefit (the larger of
 *                            the two) after the first death
 * @param acaCoverage         whether the household buys ACA marketplace insurance pre-65
 * @param acaHouseholdSize    household size for the Federal Poverty Level calculation
 * @param acaBenchmarkAnnual  annual cost of the benchmark (2nd-lowest silver) plan
 */
public record LifetimeRothRequest(
		String filingStatus,
		Integer currentAge,
		Integer spouseAge,
		Integer planThroughAge,
		Double tradBalance,
		Double rothBalance,
		Double taxableBalance,
		Double annualPension,
		Double annualSocialSecurity,
		Integer ssClaimAge,
		Double investmentReturn,
		Double inflationRate,
		Double taxableYieldRate,
		Double stateTaxRate,
		Boolean stateTaxesSs,
		Double terminalTradRate,
		Integer convStartAge,
		Integer convEndAge,
		Double targetTaxableIncome,
		Double maxAnnualConversion,
		Integer firstDeathAge,
		Double survivorSocialSecurity,
		Boolean acaCoverage,
		Integer acaHouseholdSize,
		Double acaBenchmarkAnnual,
		java.util.List<IncomeStream> incomeStreams) {
}
