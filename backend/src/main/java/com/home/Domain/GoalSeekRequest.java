package com.home.Domain;

/**
 * Inputs for goal-seek: given a plan and a target success rate, solve for the
 * change to each lever that reaches it.
 *
 * @param profile       the plan inputs
 * @param volatility    return volatility for the Monte Carlo (decimal)
 * @param targetSuccess desired probability of the money lasting (e.g. 0.90)
 * @param trials        Monte Carlo trials per evaluation (default 500)
 */
public record GoalSeekRequest(
		RetirementProfile profile,
		Double volatility,
		Double targetSuccess,
		Integer trials) {
}
