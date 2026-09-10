package com.home.Domain;

/**
 * Annual household Medicare cost, broken into components (today's dollars).
 *
 * @param partB        Part B premiums
 * @param supplement   Medigap or Medicare Advantage premiums
 * @param partD        Part D premiums
 * @param outOfPocket  expected out-of-pocket spending
 * @param irmaa        IRMAA high-income surcharge (Part B + Part D)
 * @param total        sum of the above — use as the plan's annual healthcare cost
 * @param peopleOnMedicare echoed back
 */
public record MedicareEstimateResult(
		double partB,
		double supplement,
		double partD,
		double outOfPocket,
		double irmaa,
		double total,
		int peopleOnMedicare) {
}
