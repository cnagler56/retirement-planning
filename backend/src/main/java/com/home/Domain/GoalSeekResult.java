package com.home.Domain;

/**
 * Goal-seek output: the plan's current success rate and, for each lever, the
 * value that reaches the target.
 */
public record GoalSeekResult(
		double currentSuccess,
		double target,
		Lever monthlyContribution,
		Lever retirementAge,
		Lever spending) {

	/**
	 * One lever's answer.
	 *
	 * @param alreadyMet   the plan already hits the target without changing this lever
	 * @param reachable    the target is achievable by moving this lever within sane bounds
	 * @param currentValue today's value of the lever
	 * @param neededValue  the value that reaches the target (equals currentValue if already met)
	 * @param delta        how much the lever must move (always ≥ 0; direction implied by the lever)
	 */
	public record Lever(
			boolean alreadyMet,
			boolean reachable,
			double currentValue,
			double neededValue,
			double delta) {}
}
