package com.home.Service;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.ProjectionResult;
import com.home.Domain.ProjectionResult.ProjectionPoint;
import com.home.Domain.RetirementProfile;

/**
 * Turns a {@link RetirementProfile} into a full-lifetime retirement projection,
 * in today's (inflation-adjusted) dollars.
 *
 * Two phases, simulated monthly:
 *  1. Accumulation (current age → retirement age): the portfolio grows at the
 *     real return and the monthly contribution is added.
 *  2. Retirement (retirement age → planning horizon): the portfolio keeps
 *     growing at the real return, Social Security income (starting at the claim
 *     age) offsets the spending goal, and the remaining gap is withdrawn. If
 *     Social Security exceeds spending, the surplus is reinvested.
 *
 * Everything is in today's dollars: the real return is
 * {@code (1 + nominal) / (1 + inflation) - 1}, the spending goal is a constant
 * real amount, and Social Security is assumed to hold its real value via COLA.
 *
 * A deterministic estimate, not advice — no taxes, fees, sequence-of-returns
 * risk, or a spending goal that changes with age are modeled yet.
 */
@Service
public class ProjectionService {

	private static final int MIN_CLAIM = 62;
	private static final int MAX_CLAIM = 70;

	private final SocialSecurityService socialSecurity;

	public ProjectionService(SocialSecurityService socialSecurity) {
		this.socialSecurity = socialSecurity;
	}

	public ProjectionResult compute(RetirementProfile p) {
		int currentAge = Math.max(0, p.getCurrentAge());
		int retirementAge = Math.max(currentAge, p.getRetirementAge());
		int planThroughAge = Math.max(retirementAge + 1, p.getPlanThroughAge() > 0 ? p.getPlanThroughAge() : 95);

		// Work in today's dollars via the real (inflation-adjusted) return.
		double realAnnual = (1 + p.getAnnualReturnRate()) / (1 + p.getInflationRate()) - 1;
		double realMonthly = Math.pow(1 + realAnnual, 1.0 / 12.0) - 1;

		double spendingGoal = p.getDesiredAnnualIncome();
		double spendMonthly = spendingGoal / 12.0;

		// Social Security, in today's dollars, from the claim age onward.
		int claimAge = p.getSsClaimAge();
		double ssMonthly = 0.0;
		if (p.getSsMonthlyAtFra() > 0 && claimAge >= MIN_CLAIM && claimAge <= MAX_CLAIM) {
			int birthYear = Year.now().getValue() - currentAge;
			ssMonthly = socialSecurity.monthlyBenefit(birthYear, p.getSsMonthlyAtFra(), claimAge);
		}
		double ssAnnual = ssMonthly * 12.0;

		double balance = p.getCurrentSavings();
		double contributionsTotal = 0.0;
		double nestEgg = balance;
		Integer moneyLastsToAge = null;

		List<ProjectionPoint> points = new ArrayList<>();
		points.add(new ProjectionPoint(currentAge, round(balance), 0, 0, 0,
			currentAge >= retirementAge ? "retirement" : "accumulation"));

		for (int age = currentAge; age < planThroughAge; age++) {
			double yearContribution = 0;
			double yearSs = 0;
			double yearWithdrawal = 0;

			for (int month = 0; month < 12; month++) {
				balance *= (1 + realMonthly);
				if (age < retirementAge) {
					balance += p.getMonthlyContribution();
					yearContribution += p.getMonthlyContribution();
					contributionsTotal += p.getMonthlyContribution();
				} else {
					double ss = age >= claimAge ? ssMonthly : 0.0;
					double withdrawal = spendMonthly - ss; // negative = SS surplus reinvested
					balance -= withdrawal;
					yearSs += ss;
					yearWithdrawal += Math.max(0, withdrawal);
					if (balance <= 0) {
						balance = 0;
						if (moneyLastsToAge == null) moneyLastsToAge = age + 1;
					}
				}
			}

			if (age + 1 == retirementAge) nestEgg = balance;

			String phase = (age + 1) <= retirementAge ? "accumulation" : "retirement";
			points.add(new ProjectionPoint(age + 1, round(balance),
				round(yearContribution), round(yearSs), round(yearWithdrawal), phase));
		}

		if (currentAge >= retirementAge) nestEgg = p.getCurrentSavings();

		double gapAtRetirement = spendingGoal - (retirementAge >= claimAge ? ssAnnual : 0);

		return new ProjectionResult(
			points,
			round(nestEgg),
			retirementAge - currentAge,
			retirementAge,
			round(contributionsTotal),
			round(spendingGoal),
			ssMonthly > 0 ? claimAge : 0,
			round(ssAnnual),
			round(Math.max(0, gapAtRetirement)),
			moneyLastsToAge,
			planThroughAge,
			round(balance),
			moneyLastsToAge == null,
			realAnnual
		);
	}

	/** Round to whole currency units — projections don't need sub-dollar noise. */
	private static double round(double v) {
		return Math.round(v);
	}
}
