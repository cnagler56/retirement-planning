package com.home.Domain;

import java.util.List;

/**
 * The computed output of a retirement projection, in today's (inflation-adjusted)
 * dollars. Models both phases: saving up to the retirement age, then drawing the
 * portfolio down through the planning horizon while Social Security offsets
 * spending. Immutable value type returned by ProjectionService — never persisted.
 *
 * @param points                year-by-year path from current age to planThroughAge
 * @param nestEgg               portfolio balance at the retirement age
 * @param yearsToRetirement     retirementAge - currentAge (0 if already there)
 * @param retirementAge         echoed back for convenience
 * @param totalContributions    sum of contributions made during accumulation
 * @param annualSpendingGoal    desired retirement income (today's dollars)
 * @param ssClaimAge            age Social Security is claimed (0 if none modeled)
 * @param ssAnnualIncome        annual Social Security benefit at the claim age
 * @param annualGapAtRetirement portfolio withdrawal needed the first year of
 *                              retirement (spending minus any SS then flowing)
 * @param moneyLastsToAge       age the portfolio is exhausted, or null if it
 *                              lasts through planThroughAge
 * @param planThroughAge        the planning horizon (life expectancy)
 * @param balanceAtEnd          portfolio balance at planThroughAge (0 if depleted)
 * @param fundedThroughGoal     whether the plan funds spending through the horizon
 * @param realReturn            the inflation-adjusted return used (decimal)
 */
public record ProjectionResult(
		List<ProjectionPoint> points,
		double nestEgg,
		int yearsToRetirement,
		int retirementAge,
		double totalContributions,
		double annualSpendingGoal,
		int ssClaimAge,
		double ssAnnualIncome,
		double annualGapAtRetirement,
		Integer moneyLastsToAge,
		int planThroughAge,
		double balanceAtEnd,
		boolean fundedThroughGoal,
		double realReturn) {

	/**
	 * A single year of the plan. During accumulation {@code contribution} is
	 * positive and {@code ssIncome}/{@code withdrawal} are 0; during retirement
	 * {@code withdrawal} is what the portfolio must cover after Social Security.
	 */
	public record ProjectionPoint(
			int age,
			double balance,
			double contribution,
			double ssIncome,
			double withdrawal,
			String phase) {}
}
