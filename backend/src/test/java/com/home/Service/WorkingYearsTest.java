package com.home.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.home.Domain.IncomeStream;
import com.home.Domain.LedgerResult;
import com.home.Domain.LedgerResult.LedgerRow;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;
import com.home.tax.TaxConstants;

/**
 * A paycheck (an income stream marked "stops at retirement") makes the working
 * years real cash-flow years, so moving the retirement age moves the paycheck and
 * the saving that comes with it.
 */
class WorkingYearsTest {

	private static final double EPS = 1;

	private final SocialSecurityService ss = new SocialSecurityService();
	private final RetirementCashFlow cashFlow = new RetirementCashFlow(ss, new FederalTaxService());
	private final LedgerService ledger = new LedgerService(new FederalTaxService(), cashFlow);
	private final ProjectionService projection = new ProjectionService(ss, cashFlow);

	/** Age 57, $1M pre-tax, $120k/yr all-in spending, a $200k salary. */
	private RetirementProfile profile(int retirementAge, boolean paycheck) {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(57).minusDays(10));
		p.setSpouseBirthDate(LocalDate.now().minusYears(57).minusDays(10));
		p.setFilingStatus("MARRIED_JOINT");
		p.setRetirementAge(retirementAge);
		p.setPlanThroughAge(95);
		p.setDesiredAnnualIncome(120_000);
		p.setTradBalance(1_000_000);
		p.setMonthlyContribution(1_000);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.06);
		p.setStateTaxRate(0.05);
		p.setSsMonthlyAtFra(3_000);
		p.setSsClaimAge(67);

		IncomeStream salary = new IncomeStream();
		salary.setLabel("Salary");
		salary.setAnnualAmount(200_000);
		salary.setStartAge(50);
		salary.setEndAge(62); // ignored once flagged: the retirement age decides
		salary.setInflationAdjusted(true);
		salary.setEndsAtRetirement(paycheck);
		List<IncomeStream> streams = new ArrayList<>();
		streams.add(salary);
		p.setIncomeStreams(streams);
		return p;
	}

	private static LedgerRow row(LedgerResult r, int age) {
		return r.rows().stream().filter(x -> x.age() == age).findFirst().orElseThrow();
	}

	@Test
	void paycheckFollowsTheRetirementAgeNotItsOwnEndAge() {
		RetirementCashFlow.Calc at70 = cashFlow.forProfile(profile(70, true), 95);
		assertEquals(200_000, at70.at(65).streams(), EPS);  // past its own end age of 62
		assertEquals(200_000, at70.at(69).streams(), EPS);
		assertEquals(0, at70.at(70).streams(), EPS);         // stops at retirement

		RetirementCashFlow.Calc at60 = cashFlow.forProfile(profile(60, true), 95);
		assertEquals(0, at60.at(61).streams(), EPS);         // before its own end age of 62
	}

	@Test
	void payrollTaxOnlyWhileWorking() {
		RetirementCashFlow.Calc c = cashFlow.forProfile(profile(65, true), 95);
		assertEquals(TaxConstants.payrollTax(200_000), c.at(60).payrollTax(), EPS);
		assertEquals(184_500 * 0.062 + 200_000 * 0.0145, c.at(60).payrollTax(), EPS);
		assertEquals(0, c.at(65).payrollTax(), EPS);
	}

	@Test
	void ledgerShowsWorkingYearsWithTheSurplusSaved() {
		LedgerResult r = ledger.compute(profile(65, true));
		LedgerRow first = r.rows().get(0);
		assertEquals(57, first.age());
		assertTrue(first.working());
		assertTrue(first.payrollTax() > 0);
		assertEquals(0, first.withdrawal(), EPS);
		// $200k pay − $120k spending − taxes leaves a real surplus on top of the $12k contribution.
		assertTrue(first.saved() > 12_000 + 10_000, "saved " + first.saved());
		assertFalse(row(r, 65).working());
	}

	@Test
	void withoutAPaycheckTheLedgerStillStartsAtRetirement() {
		LedgerResult r = ledger.compute(profile(65, false));
		assertEquals(65, r.rows().get(0).age());
		assertFalse(r.rows().get(0).working());
	}

	@Test
	void retiringLaterNowAddsTheExtraYearsOfPayAndSaving() {
		LedgerResult at62 = ledger.compute(profile(62, true));
		LedgerResult at70 = ledger.compute(profile(70, true));
		// By 70 the later retiree has 8 more years of pay and saving instead of withdrawals.
		double gap = row(at70, 70).startBalance() - row(at62, 70).startBalance();
		assertTrue(gap > 800_000, "gap at 70 = " + gap);

		// And that gap is far bigger than when the job is only an unflagged stream.
		double oldGap = row(ledger.compute(profile(70, false)), 70).startBalance()
			- row(ledger.compute(profile(62, false)), 70).startBalance();
		assertTrue(gap > oldGap + 300_000, "new gap " + gap + " vs old " + oldGap);
	}

	@Test
	void projectionAgreesThatWorkingLongerGrowsTheNestEgg() {
		double nestEgg62 = projection.compute(profile(62, true)).nestEgg();
		double nestEgg70 = projection.compute(profile(70, true)).nestEgg();
		assertTrue(nestEgg70 > nestEgg62 + 800_000, nestEgg62 + " → " + nestEgg70);
	}
}
