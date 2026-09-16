package com.home.Service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.home.Domain.LedgerResult;
import com.home.Domain.LedgerResult.LedgerRow;
import com.home.Domain.OneTimeEvent;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;

/** One-time events flow through the ledger: an outflow leaves the estate smaller,
 *  an inflow larger, and each shows in the row for its year. */
class OneTimeEventLedgerTest {

	private final LedgerService ledger = new LedgerService(
		new FederalTaxService(), new RetirementCashFlow(new SocialSecurityService()));

	private RetirementProfile profile(OneTimeEvent... events) {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setFilingStatus("SINGLE");
		p.setRetirementAge(65);
		p.setPlanThroughAge(90);
		p.setDesiredAnnualIncome(70_000);
		p.setTradBalance(400_000);
		p.setRothBalance(100_000);
		p.setTaxableBalance(500_000);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.05);
		p.setSsMonthlyAtFra(2_500);
		p.setSsClaimAge(65);
		if (events.length > 0) p.setOneTimeEvents(List.of(events));
		return p;
	}

	private OneTimeEvent event(String label, double amount, int age, boolean inflow) {
		OneTimeEvent e = new OneTimeEvent();
		e.setLabel(label);
		e.setAmount(amount);
		e.setAge(age);
		e.setInflow(inflow);
		return e;
	}

	private double endingTotal(LedgerResult r) {
		List<LedgerRow> rows = r.rows();
		return rows.get(rows.size() - 1).endTotal();
	}

	private LedgerRow rowAt(LedgerResult r, int age) {
		return r.rows().stream().filter(row -> row.age() == age).findFirst().orElseThrow();
	}

	@Test
	void outflowShrinksTheEstateAndInflowGrowsIt() {
		double baseline = endingTotal(ledger.compute(profile()));
		double afterCar = endingTotal(ledger.compute(profile(event("New car", 50_000, 72, false))));
		double afterInheritance = endingTotal(ledger.compute(profile(event("Inheritance", 150_000, 72, true))));

		assertTrue(afterCar < baseline, "a one-time purchase should leave less at the end");
		assertTrue(afterInheritance > baseline, "a one-time windfall should leave more at the end");
	}

	@Test
	void theEventShowsInItsOwnYearAndNowhereElse() {
		LedgerResult r = ledger.compute(profile(event("Inheritance", 150_000, 72, true)));
		assertEquals(150_000, rowAt(r, 72).oneTime(), 0.5, "inflow is positive in its year");
		assertEquals(0, rowAt(r, 71).oneTime(), 0.5, "no event the year before");
		assertEquals(0, rowAt(r, 73).oneTime(), 0.5, "no event the year after");
	}
}
