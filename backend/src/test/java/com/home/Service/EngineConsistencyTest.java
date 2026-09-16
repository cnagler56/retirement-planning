package com.home.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.home.Domain.Loan;
import com.home.Domain.MonteCarloRequest;
import com.home.Domain.ProjectionResult;
import com.home.Domain.RetirementProfile;

/**
 * Guards that the projection and both Monte Carlo code paths, now that they share
 * {@link RetirementCashFlow}, actually agree. The lean {@code successProbability}
 * loop used to compute its own spend and silently omitted loan payments — this
 * pins it to the full {@code run} loop so that class of drift can't return.
 */
class EngineConsistencyTest {

	private final SocialSecurityService ss = new SocialSecurityService();
	private final RetirementCashFlow cashFlow = new RetirementCashFlow(ss);
	private final ProjectionService projection = new ProjectionService(ss, cashFlow);
	private final MonteCarloService monteCarlo = new MonteCarloService(cashFlow);

	private RetirementProfile profile(double savings, double spending, boolean withLoan) {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setRetirementAge(65);
		p.setPlanThroughAge(95);
		p.setCurrentSavings(savings);
		p.setDesiredAnnualIncome(spending);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.06);
		if (withLoan) {
			Loan l = new Loan();
			l.setLabel("Mortgage");
			l.setBalance(300_000);
			l.setAnnualRate(0.05);
			l.setMonthlyPayment(2_500);
			l.setStartAge(0);
			p.setLoans(List.of(l));
		}
		return p;
	}

	/** The full run and the lean success-probability path must return the same number. */
	@Test
	void monteCarloRunAndLeanPathAgree() {
		// A loan is present precisely because the lean path used to ignore it.
		RetirementProfile p = profile(600_000, 150_000, true);
		double fromRun = monteCarlo.run(new MonteCarloRequest(p, 0.0, 500)).successProbability();
		double fromLean = monteCarlo.successProbability(p, 0.0, 500);
		assertEquals(fromRun, fromLean, 0.0, "run() and successProbability() must model identical drawdown");
	}

	@Test
	void fundedPlanAgreesAcrossProjectionAndMonteCarlo() {
		RetirementProfile p = profile(3_000_000, 100_000, false);
		ProjectionResult proj = projection.compute(p);
		double success = monteCarlo.successProbability(p, 0.0, 500); // 0 volatility → deterministic

		assertTrue(proj.fundedThroughGoal(), "a $3M/$100k plan should be funded");
		assertEquals(1.0, success, 0.0, "deterministic Monte Carlo should agree the plan never depletes");
	}

	@Test
	void underfundedPlanAgreesAcrossProjectionAndMonteCarlo() {
		RetirementProfile p = profile(200_000, 150_000, true);
		ProjectionResult proj = projection.compute(p);
		double success = monteCarlo.successProbability(p, 0.0, 500);

		assertFalse(proj.fundedThroughGoal(), "a $200k/$150k plan with a mortgage should run out");
		assertEquals(0.0, success, 0.0, "deterministic Monte Carlo should agree it always depletes");
	}
}
