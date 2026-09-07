package com.home.Domain;

import java.util.List;

/**
 * Output of the Social Security breakeven calculator.
 *
 * @param fraLabel          human FRA, e.g. "67" or "66 and 8 mo"
 * @param earlyAge          the earlier claim age compared
 * @param earlyMonthly      monthly benefit if claimed at earlyAge
 * @param lateAge           the later claim age compared
 * @param lateMonthly       monthly benefit if claimed at lateAge
 * @param breakevenAge      age (decimal years) where the later claim's cumulative
 *                          total overtakes the earlier one; null if it never does
 * @param breakevenLabel    that age as "82 yrs 4 mo", or null
 * @param cumulativeEarlyAtLife  total collected by lifeExpectancy claiming early
 * @param cumulativeLateAtLife   total collected by lifeExpectancy claiming late
 * @param lifeExpectancy    the horizon used for the two totals above
 * @param delayingWins      whether the later claim wins by lifeExpectancy
 * @param investmentReturn  the nominal return applied (decimal); 0 = off
 * @param colaRate          the annual COLA applied to benefits (decimal)
 * @param inflationRate     the inflation used to express values in today's dollars
 * @param todaysDollars     whether the value figures are inflation-adjusted (real)
 * @param schedule          starting monthly benefit for every claim age 62–70
 * @param points            year-by-year accumulated value for both strategies
 */
public record SsBreakevenResult(
		String fraLabel,
		int earlyAge,
		double earlyMonthly,
		int lateAge,
		double lateMonthly,
		Double breakevenAge,
		String breakevenLabel,
		double cumulativeEarlyAtLife,
		double cumulativeLateAtLife,
		int lifeExpectancy,
		boolean delayingWins,
		double investmentReturn,
		double colaRate,
		double inflationRate,
		boolean todaysDollars,
		List<AgeBenefit> schedule,
		List<CumulativePoint> points) {

	/** Monthly benefit available if a person first claims at this age. */
	public record AgeBenefit(int age, double monthly) {}

	/**
	 * Accumulated value of benefits by a given age under each strategy — the
	 * running total grown at the expected investment return (plain sum if 0).
	 */
	public record CumulativePoint(int age, double early, double late) {}
}
