package com.home.Domain;

/**
 * Inputs for the Medicare cost estimator — builds an annual healthcare-cost
 * figure from its real components.
 *
 * @param filingStatus       "SINGLE" or "MARRIED_JOINT" (for IRMAA thresholds)
 * @param magi               modified AGI that drives the IRMAA surcharge
 * @param peopleOnMedicare   how many household members are on Medicare (1–2)
 * @param coverage           "MEDIGAP" or "ADVANTAGE"
 * @param supplementMonthly  per-person monthly Medigap (or Advantage) premium
 * @param partDMonthly       per-person monthly Part D premium (often 0 on Advantage)
 * @param outOfPocketAnnual  per-person expected annual out-of-pocket spending
 */
public record MedicareEstimateRequest(
		String filingStatus,
		Double magi,
		Integer peopleOnMedicare,
		String coverage,
		Double supplementMonthly,
		Double partDMonthly,
		Double outOfPocketAnnual) {
}
