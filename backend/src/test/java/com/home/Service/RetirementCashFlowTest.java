package com.home.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.home.Domain.ExpenseItem;
import com.home.Domain.IncomeStream;
import com.home.Domain.RetirementProfile;
import com.home.Service.RetirementCashFlow.AnnualCashFlow;

/**
 * Tests for the consolidated cash-flow model — the logic that used to be
 * copy-pasted across the projection, Monte Carlo, and ledger, and where the
 * "all-in budget" bugs lived. Plain unit tests: {@link SocialSecurityService}
 * has no dependencies, so no Spring context is needed.
 */
class RetirementCashFlowTest {

	private static final double EPS = 0.01;
	private final RetirementCashFlow cashFlow = new RetirementCashFlow(new SocialSecurityService());

	// ---- fixture ------------------------------------------------------------

	/** A 65-year-old, retired now, $150k all-in goal, no SS/streams/costs by default. */
	private RetirementProfile base() {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setRetirementAge(65);
		p.setPlanThroughAge(95);
		p.setDesiredAnnualIncome(150_000);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.06);
		return p;
	}

	private AnnualCashFlow at(RetirementProfile p, int age) {
		return cashFlow.forProfile(p, Math.max(age, p.getPlanThroughAge())).at(age);
	}

	// ---- the all-in expense model ------------------------------------------

	@Test
	void healthcareIsCarvedOutOfTheGoalNotAddedOnTop() {
		RetirementProfile p = base();
		p.setAnnualHealthcareCost(12_000);
		p.setHealthcareInflationRate(0.025); // equal to inflation → flat in real terms

		AnnualCashFlow cf = at(p, 65);
		assertEquals(150_000, cf.allInSpending(), EPS, "healthcare must not push spending above the all-in goal");
		assertEquals(12_000, cf.healthcare(), EPS);
		assertEquals(138_000, cf.living(), EPS, "living column = goal minus the healthcare carve-out");
	}

	@Test
	void debtIsCarvedOutOfTheGoalNotAddedOnTop() {
		RetirementProfile p = base();
		p.setLoans(List.of(loan(2_000))); // $2k/mo mortgage, active now
		AnnualCashFlow cf = at(p, 65);

		assertTrue(cf.loanPayment() > 0, "loan should be active");
		assertEquals(150_000, cf.allInSpending(), EPS, "debt must not push spending above the all-in goal");
		assertEquals(150_000 - cf.loanPayment(), cf.living(), EPS);
	}

	@Test
	void itemizedExpensesWithinTheGoalDoNotChangeTheTotal() {
		RetirementProfile p = base();
		p.setExpenses(List.of(expense("Property tax", 11_000), expense("Insurance", 8_000)));
		AnnualCashFlow cf = at(p, 65);
		// This is the exact bug that started the refactor: a small itemized list used
		// to REPLACE the goal ($19k spend). It must stay a carve-out within $150k.
		assertEquals(150_000, cf.allInSpending(), EPS);
	}

	@Test
	void itemizedExpensesAboveTheGoalRaiseSpending() {
		RetirementProfile p = base();
		p.setExpenses(List.of(expense("Villa", 200_000)));
		assertEquals(200_000, at(p, 65).allInSpending(), EPS, "goal is a floor; known costs above it win");
	}

	@Test
	void ltcShockAddsOnTopOfTheAllInBudget() {
		RetirementProfile p = base();
		p.setLtcEnabled(true);
		p.setLtcAnnualCost(100_000);
		p.setLtcStartAge(83);
		p.setLtcYears(3);
		p.setHealthcareInflationRate(0.025); // flat in real terms

		assertEquals(150_000, at(p, 82).allInSpending(), EPS, "no LTC before the window");
		assertEquals(250_000, at(p, 83).allInSpending(), EPS, "LTC is extraordinary — on top of the all-in goal");
	}

	// ---- income offsets -----------------------------------------------------

	@Test
	void netNeedFillsTheGapBetweenSpendingAndGuaranteedIncome() {
		RetirementProfile p = base();
		p.setSsMonthlyAtFra(3_500);
		p.setSsClaimAge(65);
		p.setIncomeStreams(List.of(stream("Rental", 25_000, /*inflationAdjusted*/ true)));

		AnnualCashFlow cf = at(p, 65);
		assertTrue(cf.socialSecurity() > 0, "SS should be claimed");
		assertEquals(25_000, cf.streams(), EPS);
		// The withdrawal the ledger/projection must fund: $150k − SS − $25k, and positive.
		assertEquals(150_000 - cf.socialSecurity() - 25_000, cf.netNeed(), EPS);
		assertTrue(cf.netNeed() > 0, "SS + a $25k stream should not cover a $150k budget");
	}

	@Test
	void pensionCountsAsGuaranteedIncomeFromRetirement() {
		RetirementProfile p = base();
		p.setAnnualPension(20_000);
		AnnualCashFlow cf = at(p, 65);
		assertEquals(20_000, cf.pension(), EPS);
		assertEquals(130_000, cf.netNeed(), EPS, "pension offsets the all-in spend");
	}

	@Test
	void inflationAdjustedStreamHoldsRealValueWhileNominalErodes() {
		RetirementProfile adj = base();
		adj.setIncomeStreams(List.of(stream("COLA rent", 30_000, true)));
		RetirementProfile nom = base();
		nom.setIncomeStreams(List.of(stream("Fixed rent", 30_000, false)));

		assertEquals(30_000, at(adj, 80).streams(), EPS, "inflation-adjusted holds its real value");
		assertTrue(at(nom, 80).streams() < 30_000 - 1, "fixed-nominal erodes in today's dollars");
	}

	@Test
	void householdSocialSecurityDropsToTheSurvivorBenefitAfterFirstDeath() {
		RetirementProfile p = base();
		p.setFilingStatus("MARRIED_JOINT");
		p.setSpouseBirthDate(LocalDate.now().minusYears(65));
		p.setSsMonthlyAtFra(3_000);
		p.setSsClaimAge(65);
		p.setSpouseSsMonthlyAtFra(1_500); // half the primary's, same reduction → 2:1 split
		p.setSpouseSsClaimAge(65);
		p.setFirstDeathAge(80);

		double before = at(p, 79).socialSecurity();
		double after = at(p, 80).socialSecurity();
		assertTrue(after < before, "losing a spouse's benefit must reduce household SS");
		// Survivor keeps the larger (2 parts of 3); the smaller benefit stops.
		assertEquals(before * 2.0 / 3.0, after, 0.5);
	}

	@Test
	void survivorSpendingFactorScalesTheGoalOnlyAfterFirstDeath() {
		RetirementProfile p = base();
		p.setFilingStatus("MARRIED_JOINT");
		p.setSpouseBirthDate(LocalDate.now().minusYears(65));
		p.setFirstDeathAge(80);
		p.setSurvivorSpendingFactor(0.8); // survivor needs 80% of the couple's budget

		assertEquals(150_000, at(p, 79).allInSpending(), EPS, "couple's full budget before the death");
		assertEquals(120_000, at(p, 80).allInSpending(), EPS, "survivor spends 80% after the death");
	}

	@Test
	void socialSecurityColaBelowInflationErodesTheBenefit() {
		RetirementProfile p = base();
		p.setSsMonthlyAtFra(3_000);
		p.setSsClaimAge(65);
		p.setSsColaRate(0.005); // COLA well below the 2.5% inflation assumption

		double atClaim = at(p, 65).socialSecurity();
		double later = at(p, 85).socialSecurity();
		assertTrue(later < atClaim - 1, "a COLA below inflation should erode SS in today's dollars");
	}

	@Test
	void oneTimeEventsAdjustNetNeedOnlyInTheirYear() {
		RetirementProfile p = base(); // $150k goal, no SS/streams → base need is $150k
		p.setOneTimeEvents(List.of(event("New car", 40_000, 68, false), event("Inheritance", 100_000, 70, true)));

		assertEquals(0, at(p, 66).oneTimeNet(), EPS);
		assertEquals(150_000, at(p, 66).netNeed(), EPS);

		assertEquals(-40_000, at(p, 68).oneTimeNet(), EPS, "an outflow is negative");
		assertEquals(190_000, at(p, 68).netNeed(), EPS, "the purchase adds to the year's need");

		assertEquals(100_000, at(p, 70).oneTimeNet(), EPS, "an inflow is positive");
		assertEquals(50_000, at(p, 70).netNeed(), EPS, "the inheritance covers most of the year's need");
	}

	// ---- builders -----------------------------------------------------------

	private IncomeStream stream(String label, double annual, boolean inflationAdjusted) {
		IncomeStream s = new IncomeStream();
		s.setLabel(label);
		s.setAnnualAmount(annual);
		s.setStartAge(0);
		s.setEndAge(0);
		s.setInflationAdjusted(inflationAdjusted);
		return s;
	}

	private ExpenseItem expense(String label, double annual) {
		ExpenseItem e = new ExpenseItem();
		e.setLabel(label);
		e.setAnnualAmount(annual);
		e.setStartAge(0);
		e.setEndAge(0);
		e.setInflationAdjusted(true); // flat in real terms
		return e;
	}

	private com.home.Domain.OneTimeEvent event(String label, double amount, int age, boolean inflow) {
		com.home.Domain.OneTimeEvent e = new com.home.Domain.OneTimeEvent();
		e.setLabel(label);
		e.setAmount(amount);
		e.setAge(age);
		e.setInflow(inflow);
		return e;
	}

	private com.home.Domain.Loan loan(double monthlyPayment) {
		com.home.Domain.Loan l = new com.home.Domain.Loan();
		l.setLabel("Mortgage");
		l.setBalance(300_000);
		l.setAnnualRate(0.05);
		l.setMonthlyPayment(monthlyPayment);
		l.setStartAge(0);
		return l;
	}
}
