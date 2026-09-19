package com.home.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Service;

import com.home.Domain.MonteCarloRequest;
import com.home.Domain.MonteCarloResult;
import com.home.Domain.MonteCarloResult.Band;
import com.home.Domain.RetirementProfile;

/**
 * Monte Carlo simulation of the retirement drawdown. Instead of one fixed return,
 * each year draws a random return from a normal distribution (given mean and
 * volatility), so many trials reveal sequence-of-returns risk: the probability
 * the portfolio lasts through the horizon and the spread of outcomes.
 *
 * Runs in today's dollars (the drawn nominal return is deflated by inflation),
 * mirroring the deterministic projection's accumulation + Social-Security-offset
 * drawdown, but annually. A fixed seed keeps results stable as inputs are tuned.
 */
@Service
public class MonteCarloService {

	private static final int MAX_TRIALS = 5000;
	private static final long SEED = 12345L;

	private final RetirementCashFlow cashFlow;

	public MonteCarloService(RetirementCashFlow cashFlow) {
		this.cashFlow = cashFlow;
	}

	/** Net portfolio need by age (today's dollars), deterministic across trials so
	 *  it's computed once per run. Index is age; entries below the first drawdown
	 *  year are 0 and unused. */
	private double[] netNeedByAge(RetirementProfile p, int retirementAge, int planThrough) {
		RetirementCashFlow.Calc cash = cashFlow.forProfile(p, planThrough);
		double[] need = new double[planThrough + 1];
		for (int age = retirementAge + 1; age <= planThrough; age++) need[age] = cash.at(age).netNeed();
		return need;
	}

	public MonteCarloResult run(MonteCarloRequest req) {
		RetirementProfile p = req.profile();
		int trials = req.trials() != null && req.trials() > 0 ? Math.min(req.trials(), MAX_TRIALS) : 1000;
		double volatility = req.volatility() != null && req.volatility() >= 0 ? req.volatility() : 0.12;

		int currentAge = Math.max(0, p.getCurrentAge());
		int retirementAge = Math.max(currentAge, p.getRetirementAge());
		int planThrough = Math.max(retirementAge + 1, p.getPlanThroughAge() > 0 ? p.getPlanThroughAge() : 95);
		int years = planThrough - currentAge;

		double meanNominal = p.getAnnualReturnRate();
		double inflation = p.getInflationRate();
		double annualContribution = p.getMonthlyContribution() * 12;

		// Cash-flow needs are deterministic across trials, so compute them once.
		double[] netNeed = netNeedByAge(p, retirementAge, planThrough);

		Random random = new Random(SEED);
		int successes = 0;
		List<Integer> depletionAges = new ArrayList<>();
		// balancesByYear[y] holds every trial's balance at age currentAge+y.
		double[][] balancesByYear = new double[years + 1][trials];

		for (int trial = 0; trial < trials; trial++) {
			double balance = p.getStartingPortfolioTotal();
			boolean depleted = false;
			int depletionAge = -1;
			balancesByYear[0][trial] = balance;

			for (int y = 1; y <= years; y++) {
				int age = currentAge + y;
				double drawnNominal = meanNominal + volatility * random.nextGaussian();
				double realReturn = (1 + drawnNominal) / (1 + inflation) - 1;
				balance *= (1 + realReturn);

				if (age <= retirementAge) {
					balance += annualContribution;
				} else {
					balance -= netNeed[age]; // spending − guaranteed income; negative surplus reinvested
				}

				if (balance <= 0 && age > retirementAge) {
					balance = 0;
					if (!depleted) { depleted = true; depletionAge = age; }
				}
				balancesByYear[y][trial] = balance;
			}

			if (!depleted) successes++;
			else depletionAges.add(depletionAge);
		}

		// Percentile bands per year.
		List<Band> points = new ArrayList<>(years + 1);
		for (int y = 0; y <= years; y++) {
			double[] col = balancesByYear[y].clone();
			Arrays.sort(col);
			points.add(new Band(currentAge + y,
				round(percentile(col, 0.10)),
				round(percentile(col, 0.50)),
				round(percentile(col, 0.90))));
		}

		double[] ending = balancesByYear[years].clone();
		Arrays.sort(ending);
		Integer medianDepletion = null;
		if (!depletionAges.isEmpty() && depletionAges.size() * 2 >= trials) {
			int[] ages = depletionAges.stream().mapToInt(Integer::intValue).sorted().toArray();
			medianDepletion = ages[ages.length / 2];
		}

		return new MonteCarloResult(
			(double) successes / trials,
			trials,
			volatility,
			round(percentile(ending, 0.50)),
			round(percentile(ending, 0.10)),
			round(percentile(ending, 0.90)),
			medianDepletion,
			points
		);
	}

	/**
	 * Just the probability the plan lasts through the horizon — the same simulation
	 * as {@link #run} but without the percentile bands, so goal-seek can call it
	 * many times cheaply. Fixed seed keeps it deterministic for a given input.
	 */
	public double successProbability(RetirementProfile p, double volatility, int trials) {
		int currentAge = Math.max(0, p.getCurrentAge());
		int retirementAge = Math.max(currentAge, p.getRetirementAge());
		int planThrough = Math.max(retirementAge + 1, p.getPlanThroughAge() > 0 ? p.getPlanThroughAge() : 95);
		int years = planThrough - currentAge;
		double meanNominal = p.getAnnualReturnRate();
		double inflation = p.getInflationRate();
		double annualContribution = p.getMonthlyContribution() * 12;

		double[] netNeed = netNeedByAge(p, retirementAge, planThrough);

		Random random = new Random(SEED);
		int successes = 0;
		for (int trial = 0; trial < trials; trial++) {
			double balance = p.getStartingPortfolioTotal();
			boolean depleted = false;
			for (int y = 1; y <= years; y++) {
				int age = currentAge + y;
				double realReturn = (1 + (meanNominal + volatility * random.nextGaussian())) / (1 + inflation) - 1;
				balance *= (1 + realReturn);
				if (age <= retirementAge) {
					balance += annualContribution;
				} else {
					balance -= netNeed[age];
				}
				if (balance <= 0 && age > retirementAge) { balance = 0; depleted = true; }
			}
			if (!depleted) successes++;
		}
		return (double) successes / trials;
	}

	/** Linear-interpolated percentile of a pre-sorted array. */
	private double percentile(double[] sorted, double q) {
		if (sorted.length == 0) return 0;
		double idx = q * (sorted.length - 1);
		int lo = (int) Math.floor(idx);
		int hi = (int) Math.ceil(idx);
		if (lo == hi) return sorted[lo];
		return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
	}

	private static double round(double v) {
		return Math.round(v);
	}
}
