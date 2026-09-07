package com.home.Domain;

import java.util.List;

/**
 * Output of the Roth conversion analyzer — after-tax ending wealth of converting
 * now vs. leaving the money in the Traditional account, on equal footing.
 *
 * @param conversionTax         tax due now on the conversion (amount × current rate)
 * @param rothStartValue        dollars that actually land in the Roth after any tax
 * @param convertEndValue       after-tax value at the horizon if you convert
 * @param noConvertEndValue     after-tax value at the horizon if you don't
 * @param advantage             convertEndValue − noConvertEndValue (negative = don't)
 * @param convertWins           whether converting comes out ahead
 * @param breakevenRetirementRate future tax rate at which the two strategies tie
 * @param taxPaidFrom           echoed: "OUTSIDE" or "CONVERSION"
 * @param years                 the horizon used
 * @param points                year-by-year after-tax value of each strategy
 */
public record RothConversionResult(
		double conversionTax,
		double rothStartValue,
		double convertEndValue,
		double noConvertEndValue,
		double advantage,
		boolean convertWins,
		double breakevenRetirementRate,
		String taxPaidFrom,
		int years,
		List<Point> points) {

	/** After-tax value of each strategy at a given year. */
	public record Point(int year, double convert, double noConvert) {}
}
