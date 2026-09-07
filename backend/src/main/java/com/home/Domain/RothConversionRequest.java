package com.home.Domain;

/**
 * Inputs for the Roth conversion analyzer.
 *
 * @param conversionAmount       pre-tax Traditional dollars to convert
 * @param currentMarginalRate    marginal tax rate paid on the conversion now (decimal)
 * @param retirementMarginalRate marginal rate you'd otherwise pay withdrawing later (decimal)
 * @param annualReturn           expected annual investment return (decimal)
 * @param years                  years until the money would be withdrawn
 * @param taxPaidFrom            "OUTSIDE" (pay the tax from taxable savings) or
 *                               "CONVERSION" (withhold the tax from the amount converted)
 * @param taxableDragRate        share of the taxable account's return lost to tax each
 *                               year (decimal); only matters when paying from outside
 */
public record RothConversionRequest(
		Double conversionAmount,
		Double currentMarginalRate,
		Double retirementMarginalRate,
		Double annualReturn,
		Integer years,
		String taxPaidFrom,
		Double taxableDragRate) {
}
