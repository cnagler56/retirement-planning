package com.home.tax;

/**
 * Affordable Care Act premium tax credit (marketplace subsidy) for pre-Medicare
 * coverage. A conversion raises MAGI, which raises your "expected contribution"
 * and shrinks the credit — a hidden marginal cost for early retirees, the pre-65
 * counterpart to IRMAA.
 *
 * Uses the enhanced (ARPA / Inflation Reduction Act) applicable-percentage
 * schedule in effect through 2025, which caps the required contribution at 8.5%
 * of income and removes the old 400%-of-poverty subsidy cliff. Federal Poverty
 * Level figures are inflation-indexed, so in a today's-dollars model they stay
 * constant (no real-terms erosion, unlike the SS/IRMAA/NIIT thresholds).
 *
 * Approximate 2024/2025 FPL for the 48 contiguous states — verify before relying.
 */
public final class AcaSubsidy {

	private AcaSubsidy() {}

	private static final double FPL_FIRST = 15_060;      // 1-person household
	private static final double FPL_ADDITIONAL = 5_380;  // per extra person

	/** Annual premium tax credit given MAGI, household size, and the benchmark plan cost. */
	public static double premiumTaxCredit(double magi, int householdSize, double benchmarkAnnual) {
		if (benchmarkAnnual <= 0) return 0;
		double fpl = FPL_FIRST + Math.max(0, householdSize - 1) * FPL_ADDITIONAL;
		double ratio = fpl > 0 ? magi / fpl : 0;
		double pct = applicablePercentage(ratio);
		double expectedContribution = Math.max(0, magi) * pct;
		return Math.max(0, benchmarkAnnual - expectedContribution);
	}

	/** Share of income you're expected to pay toward the benchmark plan, by FPL ratio. */
	private static double applicablePercentage(double ratio) {
		if (ratio <= 1.5) return 0.0;
		if (ratio <= 2.0) return interp(ratio, 1.5, 2.0, 0.0, 0.02);
		if (ratio <= 2.5) return interp(ratio, 2.0, 2.5, 0.02, 0.04);
		if (ratio <= 3.0) return interp(ratio, 2.5, 3.0, 0.04, 0.06);
		if (ratio <= 4.0) return interp(ratio, 3.0, 4.0, 0.06, 0.085);
		return 0.085; // enhanced rules: capped, no cliff
	}

	private static double interp(double x, double x0, double x1, double y0, double y1) {
		return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
	}
}
