package com.home.Domain;

import java.util.List;

/**
 * The true, tax-engine-computed cost of a Roth conversion this year.
 *
 * @param conversionAmount       the amount converted
 * @param taxBefore              total federal tax with no conversion
 * @param taxAfter               total federal tax with the conversion
 * @param conversionTax          the extra tax the conversion causes
 * @param effectiveMarginalRate  conversionTax / conversionAmount — the real rate,
 *                               which can exceed the nominal bracket
 * @param nominalTopBracket      the ordinary bracket the last converted dollar sits in
 * @param taxableSsBefore        taxable Social Security before the conversion
 * @param taxableSsAfter         taxable Social Security after the conversion
 * @param extraSsTaxed           additional SS pulled into taxable income (the torpedo)
 * @param agiBefore              AGI before / @param agiAfter AGI after
 * @param points                 marginal & cumulative rate as the conversion grows
 */
public record ConversionTaxResult(
		double conversionAmount,
		double taxBefore,
		double taxAfter,
		double conversionTax,
		double effectiveMarginalRate,
		double nominalTopBracket,
		double taxableSsBefore,
		double taxableSsAfter,
		double extraSsTaxed,
		double agiBefore,
		double agiAfter,
		List<RatePoint> points) {

	/**
	 * A point on the marginal-rate curve.
	 *
	 * @param amount        conversion amount at this point
	 * @param marginalRate  tax rate on the next slice of conversion here (the spike
	 *                      through the torpedo shows up as a hump above the bracket)
	 * @param cumulativeRate total extra tax so far / amount so far
	 */
	public record RatePoint(double amount, double marginalRate, double cumulativeRate) {}
}
