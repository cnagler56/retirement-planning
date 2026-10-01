package com.home.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import com.home.tax.FederalTaxService.FederalTax;
import com.home.tax.TaxConstants.Filing;

/** Hand-checked 2026 returns, focused on the 2025–2028 senior deduction. */
class FederalTaxServiceTest {

	private static final double EPS = 0.5;
	private final FederalTaxService tax = new FederalTaxService();

	@Test
	void coupleBothOver65GetsFullSeniorDeductionAndTorpedoStillApplies() {
		// MFJ both 66, $40k SS, $30k pension. Before: AGI 41,100 < 32,200 + 3,300 + 12,000 → $0.
		FederalTax before = tax.compute(Filing.MARRIED_JOINT, 2, 30_000, 40_000, 0);
		assertEquals(11_100, before.taxableSocialSecurity(), EPS);
		assertEquals(12_000, before.seniorDeduction(), EPS);
		assertEquals(0, before.totalTax(), EPS);

		// Converting $40k: AGI 104,000 − 47,500 = 56,500 taxable → 2,480 + 12% × 31,700.
		FederalTax after = tax.compute(Filing.MARRIED_JOINT, 2, 70_000, 40_000, 0);
		assertEquals(34_000, after.taxableSocialSecurity(), EPS);
		assertEquals(56_500, after.taxableIncome(), EPS);
		assertEquals(6_284, after.totalTax(), EPS);
	}

	@Test
	void seniorDeductionPhasesOutPerPersonAboveMagiThreshold() {
		// MFJ $200k: each $6,000 loses 6% × 50,000 = 3,000 → $6,000 total.
		FederalTax mfj = tax.compute(Filing.MARRIED_JOINT, 2, 200_000, 0, 0);
		assertEquals(6_000, mfj.seniorDeduction(), EPS);
		assertEquals(158_500, mfj.taxableIncome(), EPS);
		assertEquals(24_294, mfj.totalTax(), EPS);

		// Fully gone at $250k MFJ.
		assertEquals(0, tax.compute(Filing.MARRIED_JOINT, 2, 250_000, 0, 0).seniorDeduction(), EPS);

		// Single $100k: 6,000 − 6% × 25,000 = 4,500; std 16,100 + 2,050.
		FederalTax single = tax.compute(Filing.SINGLE, 1, 100_000, 0, 0);
		assertEquals(4_500, single.seniorDeduction(), EPS);
		assertEquals(77_350, single.taxableIncome(), EPS);
		assertEquals(11_729, single.totalTax(), EPS);
	}

	@Test
	void seniorDeductionOnlyForFilersOver65AndOnlyThrough2028() {
		assertEquals(6_000, tax.compute(Filing.MARRIED_JOINT, 1, 50_000, 0, 0).seniorDeduction(), EPS);
		assertEquals(0, tax.compute(Filing.MARRIED_JOINT, 0, 50_000, 0, 0).seniorDeduction(), EPS);

		assertEquals(12_000, tax.compute(Filing.MARRIED_JOINT, 2, 70_000, 40_000, 0, 1.0, 2028).seniorDeduction(), EPS);
		FederalTax in2029 = tax.compute(Filing.MARRIED_JOINT, 2, 70_000, 40_000, 0, 1.0, 2029);
		assertEquals(0, in2029.seniorDeduction(), EPS);
		assertEquals(7_724, in2029.totalTax(), EPS); // 68,500 taxable
	}

	@Test
	void seniorDeductionErodesInRealTermsLikeOtherNonIndexedAmounts() {
		FederalTax f = tax.compute(Filing.MARRIED_JOINT, 2, 50_000, 0, 0, 0.9, 2027);
		assertEquals(2 * 6_000 * 0.9, f.seniorDeduction(), EPS);
	}
}
