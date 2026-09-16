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
 * The widow's penalty in the ledger: after the first death the survivor loses the
 * smaller Social Security benefit and files single (compressed brackets, halved
 * IRMAA thresholds). A plan that models a death should therefore end poorer than
 * the identical plan where both spouses live the whole horizon.
 */
class SurvivorScenarioTest {

	private final LedgerService ledger = new LedgerService(
		new FederalTaxService(), new RetirementCashFlow(new SocialSecurityService()));

	private RetirementProfile couple(int firstDeathAge) {
		RetirementProfile p = new RetirementProfile();
		p.setBirthDate(LocalDate.now().minusYears(65));
		p.setSpouseBirthDate(LocalDate.now().minusYears(65));
		p.setFilingStatus("MARRIED_JOINT");
		p.setRetirementAge(65);
		p.setPlanThroughAge(92);
		p.setDesiredAnnualIncome(90_000);
		p.setTradBalance(800_000);
		p.setRothBalance(100_000);
		p.setTaxableBalance(200_000);
		p.setInflationRate(0.025);
		p.setAnnualReturnRate(0.05);
		p.setSsMonthlyAtFra(3_000);
		p.setSsClaimAge(65);
		p.setSpouseSsMonthlyAtFra(1_500);
		p.setSpouseSsClaimAge(65);
		p.setFirstDeathAge(firstDeathAge); // 0 = both live the whole horizon
		return p;
	}

	private double endingTotal(LedgerResult r) {
		List<LedgerRow> rows = r.rows();
		return rows.get(rows.size() - 1).endTotal();
	}

	@Test
	void modellingAFirstDeathEndsPoorerThanBothSpousesSurviving() {
		LedgerResult bothLive = ledger.compute(couple(0));
		LedgerResult widowedAt78 = ledger.compute(couple(78));

		assertTrue(endingTotal(widowedAt78) < endingTotal(bothLive),
			"lost survivor SS plus single-filer taxes should leave the estate smaller");
	}
}
