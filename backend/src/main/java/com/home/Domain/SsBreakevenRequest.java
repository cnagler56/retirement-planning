package com.home.Domain;

/**
 * Inputs for the Social Security claiming breakeven calculator.
 *
 * @param birthYear         used to derive Full Retirement Age (FRA)
 * @param monthlyAtFra      the benefit at FRA (SSA's "primary insurance amount"),
 *                          in today's dollars
 * @param earlyAge          the earlier claiming age to compare (62–70)
 * @param lateAge           the later claiming age to compare (62–70)
 * @param lifeExpectancy    age to total accumulated value through (for the verdict)
 * @param investmentReturn  expected nominal annual return, as a decimal (0.05 = 5%).
 *                          Each benefit received stays invested at this rate — so
 *                          claiming sooner keeps more money compounding. 0 = off.
 * @param colaRate          annual Social Security cost-of-living adjustment, as a
 *                          decimal (0.025 = 2.5%). Grows the benefit each year.
 * @param inflationRate     annual inflation, as a decimal. Used to express all
 *                          results in today's dollars. Does not affect the
 *                          breakeven age (it scales both strategies equally).
 */
public record SsBreakevenRequest(
		Integer birthYear,
		Double monthlyAtFra,
		Integer earlyAge,
		Integer lateAge,
		Integer lifeExpectancy,
		Double investmentReturn,
		Double colaRate,
		Double inflationRate) {
}
