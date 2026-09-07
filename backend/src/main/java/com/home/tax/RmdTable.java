package com.home.tax;

import java.util.HashMap;
import java.util.Map;

/**
 * IRS Uniform Lifetime Table (effective 2022) for Required Minimum Distributions.
 * The RMD for a year is the prior year-end pre-tax balance divided by the divisor
 * for your age that year.
 *
 * RMDs begin at age 73 for people born 1951–1959 and age 75 for those born 1960+
 * (SECURE 2.0).
 */
public final class RmdTable {

	private RmdTable() {}

	private static final Map<Integer, Double> DIVISOR = new HashMap<>();
	static {
		double[] pairs = {
			72, 27.4, 73, 26.5, 74, 25.5, 75, 24.6, 76, 23.7, 77, 22.9, 78, 22.0,
			79, 21.1, 80, 20.2, 81, 19.4, 82, 18.5, 83, 17.7, 84, 16.8, 85, 16.0,
			86, 15.2, 87, 14.4, 88, 13.7, 89, 12.9, 90, 12.2, 91, 11.5, 92, 10.8,
			93, 10.1, 94, 9.5, 95, 8.9, 96, 8.4, 97, 7.8, 98, 7.3, 99, 6.8, 100, 6.4,
			101, 6.0, 102, 5.6, 103, 5.2, 104, 4.9, 105, 4.6, 106, 4.3, 107, 4.1,
			108, 3.9, 109, 3.7, 110, 3.5, 111, 3.4, 112, 3.3, 113, 3.1, 114, 3.0,
			115, 2.9, 116, 2.8, 117, 2.7, 118, 2.5, 119, 2.3, 120, 2.0,
		};
		for (int i = 0; i < pairs.length; i += 2) DIVISOR.put((int) pairs[i], pairs[i + 1]);
	}

	/** Age at which RMDs must begin, per SECURE 2.0. */
	public static int startAge(int birthYear) {
		return birthYear >= 1960 ? 75 : 73;
	}

	/** Divisor for a given age (clamped to the table's range). */
	public static double divisor(int age) {
		if (age < 72) return DIVISOR.get(72);
		if (age > 120) return DIVISOR.get(120);
		return DIVISOR.getOrDefault(age, DIVISOR.get(120));
	}

	/** The RMD for the year, given age and the pre-tax balance. */
	public static double required(int age, int birthYear, double preTaxBalance) {
		if (age < startAge(birthYear) || preTaxBalance <= 0) return 0;
		return preTaxBalance / divisor(age);
	}
}
