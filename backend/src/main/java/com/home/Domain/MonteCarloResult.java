package com.home.Domain;

import java.util.List;

/**
 * Monte Carlo outcome for a retirement plan.
 *
 * @param successProbability  share of trials whose portfolio lasts through the horizon
 * @param trials              number of trials run
 * @param volatility          the return volatility used
 * @param medianEndingBalance median ending balance across trials (today's dollars)
 * @param p10EndingBalance    10th-percentile ending balance (a poor-market outcome)
 * @param p90EndingBalance    90th-percentile ending balance (a strong-market outcome)
 * @param medianDepletionAge  median age money runs out among failing trials (null if
 *                            most trials succeed)
 * @param points              percentile balance bands by age (the outcome fan)
 */
public record MonteCarloResult(
		double successProbability,
		int trials,
		double volatility,
		double medianEndingBalance,
		double p10EndingBalance,
		double p90EndingBalance,
		Integer medianDepletionAge,
		List<Band> points) {

	/** Percentile balances at a given age across all trials. */
	public record Band(int age, double p10, double p50, double p90) {}
}
