package com.home.Service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.home.Domain.LedgerResult;
import com.home.Domain.LedgerResult.LedgerRow;
import com.home.Domain.RetirementProfile;
import com.home.tax.FederalTaxService;

/**
 * End-to-end check that the withdrawal strategy actually reshapes the ledger:
 * the tax-efficient strategy should pull the pre-tax account down earlier, which
 * in turn shrinks the required minimum distributions later.
 */
class LedgerStrategyTest {

	private final LedgerService ledger = new LedgerService(
		new FederalTaxService(), new RetirementCashFlow(new SocialSecurityService()));

	/** MFJ couple, retired at 65, with a large pre-tax balance that RMDs will hit. */
	private RetirementProfile bigPreTaxProfile(String strategy) {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setSpouseBirthDate(LocalDate.now().minusYears(65));
		p.setFilingStatus("MARRIED_JOINT");
		p.setRetirementAge(65);
		p.setPlanThroughAge(90);
		p.setDesiredAnnualIncome(100_000);
		p.setTradBalance(1_500_000);
		p.setRothBalance(100_000);
		p.setTaxableBalance(100_000);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.05);
		p.setSsMonthlyAtFra(3_000);
		p.setSsClaimAge(65);
		p.setSpouseSsMonthlyAtFra(1_500);
		p.setSpouseSsClaimAge(65);
		p.setWithdrawalStrategy(strategy);
		return p;
	}

	private RetirementProfile taxEfficientTo(int bracketPct) {
		RetirementProfile p = bigPreTaxProfile("TAX_EFFICIENT");
		p.setWithdrawalBracketPct(bracketPct);
		return p;
	}

	private double sumRmd(LedgerResult r) {
		return r.rows().stream().mapToDouble(LedgerRow::rmd).sum();
	}

	private double endingTrad(LedgerResult r) {
		List<LedgerRow> rows = r.rows();
		return rows.get(rows.size() - 1).endTrad();
	}

	private double tradAt(LedgerResult r, int age) {
		return r.rows().stream().filter(row -> row.age() == age).mapToDouble(LedgerRow::endTrad).findFirst().orElseThrow();
	}

	@Test
	void taxEfficientDrawsPreTaxDownEarlierThanConventional() {
		LedgerResult conventional = ledger.compute(bigPreTaxProfile("CONVENTIONAL"));
		LedgerResult taxEfficient = ledger.compute(bigPreTaxProfile("TAX_EFFICIENT"));

		assertTrue(endingTrad(taxEfficient) < endingTrad(conventional),
			"tax-efficient should leave a smaller pre-tax balance at the end");
		assertTrue(sumRmd(taxEfficient) < sumRmd(conventional),
			"a smaller pre-tax balance means smaller lifetime RMDs");
	}

	@Test
	void higherBracketTargetDrainsPreTaxFasterThanLowerTarget() {
		LedgerResult fillTo12 = ledger.compute(taxEfficientTo(12));
		LedgerResult fillTo22 = ledger.compute(taxEfficientTo(22));

		// Both fully drain a $1.5M pre-tax balance by the horizon, so the gap shows
		// mid-retirement: at 70 the 22% target has pulled far more pre-tax out.
		assertTrue(tradAt(fillTo22, 70) < tradAt(fillTo12, 70),
			"filling to the 22% bracket should draw pre-tax down faster than filling only to 12%");
	}

	@Test
	void ledgerStartsFromCurrentSavingsWhenBucketsAreEmpty() {
		// "Retirement Savings" entered as a single figure, no per-bucket split.
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setFilingStatus("SINGLE");
		p.setRetirementAge(65);
		p.setPlanThroughAge(90);
		p.setDesiredAnnualIncome(40_000);
		p.setCurrentSavings(1_000_000); // buckets left at 0
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.05);
		p.setSsMonthlyAtFra(2_000);
		p.setSsClaimAge(65);

		LedgerResult r = ledger.compute(p);
		assertTrue(r.rows().get(0).endTotal() > 900_000,
			"the ledger must start from the entered savings, not $0");
		assertTrue(r.moneyLastsToAge() == null,
			"$1M against $40k/yr (less SS) should last the whole horizon, not deplete in year one");
	}
}
