package com.home.Service;

import org.springframework.stereotype.Service;

import com.home.Domain.GoalSeekRequest;
import com.home.Domain.GoalSeekResult;
import com.home.Domain.GoalSeekResult.Lever;
import com.home.Domain.RetirementProfile;

/**
 * Solves a plan backwards: given a target Monte Carlo success rate, finds the
 * change to each lever (save more, retire later, spend less) that reaches it.
 *
 * Each lever moves success monotonically, so a binary search over
 * {@link MonteCarloService#successProbability} converges. The profile is mutated
 * in place during a search and restored afterward (single request, single thread).
 */
@Service
public class GoalSeekService {

	private static final double MAX_MONTHLY_ADD = 50_000; // ceiling for "save more"
	private static final int MAX_RETIRE_AGE = 80;
	private static final int ITERS = 34;

	private final MonteCarloService monteCarlo;

	public GoalSeekService(MonteCarloService monteCarlo) {
		this.monteCarlo = monteCarlo;
	}

	public GoalSeekResult solve(GoalSeekRequest req) {
		RetirementProfile p = req.profile();
		double volatility = req.volatility() != null && req.volatility() >= 0 ? req.volatility() : 0.12;
		double target = req.targetSuccess() != null ? clamp(req.targetSuccess(), 0.01, 0.999) : 0.90;
		int trials = req.trials() != null && req.trials() > 0 ? Math.min(req.trials(), 2000) : 500;

		double current = success(p, volatility, trials);

		return new GoalSeekResult(
			round4(current), round4(target),
			solveContribution(p, volatility, trials, target, current),
			solveRetirementAge(p, volatility, trials, target, current),
			solveSpending(p, volatility, trials, target, current)
		);
	}

	private double success(RetirementProfile p, double vol, int trials) {
		return monteCarlo.successProbability(p, vol, trials);
	}

	/** How much monthly saving reaches the target (success rises with contributions). */
	private Lever solveContribution(RetirementProfile p, double vol, int trials, double target, double current) {
		double orig = p.getMonthlyContribution();
		if (current >= target) return met(orig);
		try {
			double hi = orig + MAX_MONTHLY_ADD;
			p.setMonthlyContribution(hi);
			if (success(p, vol, trials) < target) return unreachable(orig);
			double lo = orig;
			for (int i = 0; i < ITERS; i++) {
				double mid = (lo + hi) / 2;
				p.setMonthlyContribution(mid);
				if (success(p, vol, trials) >= target) hi = mid; else lo = mid;
			}
			return reachable(orig, round(hi), round(hi - orig));
		} finally {
			p.setMonthlyContribution(orig);
		}
	}

	/** The earliest retirement age that reaches the target (success rises if you retire later). */
	private Lever solveRetirementAge(RetirementProfile p, double vol, int trials, double target, double current) {
		int orig = p.getRetirementAge();
		if (current >= target) return met(orig);
		int max = Math.min(MAX_RETIRE_AGE, Math.max(orig + 1, p.getPlanThroughAge() - 1));
		try {
			for (int age = orig + 1; age <= max; age++) {
				p.setRetirementAge(age);
				if (success(p, vol, trials) >= target) return reachable(orig, age, age - orig);
			}
			return unreachable(orig);
		} finally {
			p.setRetirementAge(orig);
		}
	}

	/** The highest spending level that still reaches the target (success falls as you spend more). */
	private Lever solveSpending(RetirementProfile p, double vol, int trials, double target, double current) {
		double orig = p.getDesiredAnnualIncome();
		if (current >= target) return met(orig);
		try {
			p.setDesiredAnnualIncome(0);
			if (success(p, vol, trials) < target) return unreachable(orig); // even $0 spending can't (rare)
			double lo = 0, hi = orig; // find the largest spending with success >= target
			for (int i = 0; i < ITERS; i++) {
				double mid = (lo + hi) / 2;
				p.setDesiredAnnualIncome(mid);
				if (success(p, vol, trials) >= target) lo = mid; else hi = mid;
			}
			return reachable(orig, round(lo), round(orig - lo));
		} finally {
			p.setDesiredAnnualIncome(orig);
		}
	}

	private static Lever met(double v) { return new Lever(true, true, round(v), round(v), 0); }
	private static Lever unreachable(double v) { return new Lever(false, false, round(v), round(v), 0); }
	private static Lever reachable(double cur, double needed, double delta) {
		return new Lever(false, true, round(cur), needed, delta);
	}

	private static double clamp(double v, double lo, double hi) { return Math.max(lo, Math.min(hi, v)); }
	private static double round(double v) { return Math.round(v); }
	private static double round4(double v) { return Math.round(v * 10000.0) / 10000.0; }
}
