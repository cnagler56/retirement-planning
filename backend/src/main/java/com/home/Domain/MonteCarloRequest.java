package com.home.Domain;

/**
 * A Monte Carlo run of a retirement plan: the saved-profile inputs plus the
 * return volatility and how many random trials to simulate.
 *
 * @param profile    the plan inputs (ages, balances, contributions, spending, SS)
 * @param volatility standard deviation of the annual return (decimal, e.g. 0.12)
 * @param trials     number of random paths to simulate (capped server-side)
 */
public record MonteCarloRequest(
		RetirementProfile profile,
		Double volatility,
		Integer trials) {
}
