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
import com.home.tax.LoanSchedule;

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

	private final SocialSecurityService socialSecurity;

	public MonteCarloService(SocialSecurityService socialSecurity) {
		this.socialSecurity = socialSecurity;
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
		double spending = p.getDesiredAnnualIncome();

		// Social Security (today's dollars) from the claim age onward.
		double ssAnnual = 0;
		if (p.getSsMonthlyAtFra() > 0 && p.getSsClaimAge() >= 62) {
			ssAnnual = socialSecurity.monthlyBenefit(p.getBirthYear(), p.getSsMonthlyAtFra(), p.getSsClaimAge()) * 12;
		}
		int claimAge = p.getSsClaimAge();
		LoanSchedule.Schedule loans = LoanSchedule.compute(p.getLoans(), currentAge, planThrough, inflation);

		Random random = new Random(SEED);
		int successes = 0;
		List<Integer> depletionAges = new ArrayList<>();
		// balancesByYear[y] holds every trial's balance at age currentAge+y.
		double[][] balancesByYear = new double[years + 1][trials];

		for (int trial = 0; trial < trials; trial++) {
			double balance = p.getCurrentSavings();
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
					double ss = age >= claimAge ? ssAnnual : 0;
					double streams = streamIncomeAt(p, age);
					double health = healthcareAt(p, age) + ltcAt(p, age) + loans.paymentAt(age);
					balance -= (spending + health - ss - streams); // surplus is reinvested
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
		double spending = p.getDesiredAnnualIncome();

		double ssAnnual = 0;
		if (p.getSsMonthlyAtFra() > 0 && p.getSsClaimAge() >= 62) {
			ssAnnual = socialSecurity.monthlyBenefit(p.getBirthYear(), p.getSsMonthlyAtFra(), p.getSsClaimAge()) * 12;
		}
		int claimAge = p.getSsClaimAge();
		LoanSchedule.Schedule loans = LoanSchedule.compute(p.getLoans(), currentAge, planThrough, inflation);

		Random random = new Random(SEED);
		int successes = 0;
		for (int trial = 0; trial < trials; trial++) {
			double balance = p.getCurrentSavings();
			boolean depleted = false;
			for (int y = 1; y <= years; y++) {
				int age = currentAge + y;
				double realReturn = (1 + (meanNominal + volatility * random.nextGaussian())) / (1 + inflation) - 1;
				balance *= (1 + realReturn);
				if (age <= retirementAge) {
					balance += annualContribution;
				} else {
					double ss = age >= claimAge ? ssAnnual : 0;
					balance -= (spending + healthcareAt(p, age) + ltcAt(p, age) - ss - streamIncomeAt(p, age));
				}
				if (balance <= 0 && age > retirementAge) { balance = 0; depleted = true; }
			}
			if (!depleted) successes++;
		}
		return (double) successes / trials;
	}

	/** Today's-dollars income from all streams active at the given age. */
	private double streamIncomeAt(RetirementProfile p, int age) {
		if (p.getIncomeStreams() == null) return 0;
		double total = 0;
		for (var s : p.getIncomeStreams()) {
			total += s.realIncomeAt(age, p.getCurrentAge(), p.getInflationRate());
		}
		return total;
	}

	/** Today's-dollars healthcare cost at a retirement-year age (grows in real terms). */
	private double healthcareAt(RetirementProfile p, int age) {
		if (age < p.getRetirementAge() || p.getAnnualHealthcareCost() <= 0) return 0;
		double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
		return p.getAnnualHealthcareCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
	}

	/** Today's-dollars long-term-care cost during the LTC window (0 otherwise). */
	private double ltcAt(RetirementProfile p, int age) {
		if (!p.isLtcEnabled() || p.getLtcAnnualCost() <= 0) return 0;
		int start = p.getLtcStartAge();
		if (age < start || age >= start + Math.max(1, p.getLtcYears())) return 0;
		double realGrowth = (1 + p.getHealthcareInflationRate()) / (1 + p.getInflationRate());
		return p.getLtcAnnualCost() * Math.pow(realGrowth, Math.max(0, age - p.getCurrentAge()));
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
