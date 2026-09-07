package com.home.tax;

import com.home.tax.TaxConstants.Filing;

/**
 * Medicare IRMAA (Income-Related Monthly Adjustment Amount) surcharges — the
 * extra Part B + Part D premiums high-income beneficiaries pay, as a function of
 * MAGI. It's a cliff: crossing a tier by $1 adds the whole surcharge.
 *
 * Figures below are APPROXIMATE 2025 annual amounts per person (Part B + Part D
 * combined) and thresholds — verify against CMS before relying on the dollars.
 * IRMAA normally uses MAGI from two years prior; this model uses the current
 * year's MAGI as a simplification. Thresholds are NOT inflation-indexed, which
 * the caller models by scaling them down in real terms over time.
 */
public final class IrmaaTable {

	private IrmaaTable() {}

	// Upper MAGI bound of each surcharge-free/step tier and the annual per-person
	// surcharge that applies once you exceed the previous bound.
	private static final double[] SINGLE_UPPER = {106_000, 133_000, 167_000, 200_000, 500_000};
	private static final double[] MARRIED_UPPER = {212_000, 266_000, 334_000, 400_000, 750_000};
	// Annual per-person surcharge (Part B + Part D) for tiers 1..5.
	private static final double[] ANNUAL_SURCHARGE = {1_052, 2_644, 4_235, 5_826, 6_356};

	/**
	 * Annual IRMAA surcharge for the household.
	 *
	 * @param magi            modified AGI for the year
	 * @param peopleOnMedicare how many household members are 65+ (surcharge is per person)
	 * @param thresholdScale  multiply thresholds by this to model their lack of
	 *                        inflation indexing (1.0 = current year; &lt;1 shrinks them)
	 */
	public static double surcharge(Filing filing, double magi, int peopleOnMedicare, double thresholdScale) {
		if (peopleOnMedicare <= 0) return 0;
		double[] upper = filing == Filing.MARRIED_JOINT ? MARRIED_UPPER : SINGLE_UPPER;
		double perPerson = 0;
		for (int i = 0; i < upper.length; i++) {
			if (magi > upper[i] * thresholdScale) perPerson = ANNUAL_SURCHARGE[i];
			else break;
		}
		return perPerson * peopleOnMedicare;
	}
}
