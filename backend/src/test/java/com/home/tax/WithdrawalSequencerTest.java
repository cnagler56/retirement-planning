package com.home.tax;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import com.home.tax.TaxConstants.Filing;
import com.home.tax.WithdrawalSequencer.Draw;

class WithdrawalSequencerTest {

	private static final double EPS = 0.01;

	// ---- conventional: taxable → pre-tax → Roth, only what's needed --------

	@Test
	void conventionalDrawsTaxableFirstThenPreTaxThenRoth() {
		Draw d = WithdrawalSequencer.source(WithdrawalStrategy.CONVENTIONAL,
			50_000, /*taxable*/ 30_000, /*trad*/ 40_000, /*roth*/ 20_000, /*fillRoom*/ 0);
		assertEquals(30_000, d.fromTaxable(), EPS);
		assertEquals(20_000, d.fromTradExtra(), EPS);
		assertEquals(0, d.fromRoth(), EPS, "Roth is preserved while taxable + pre-tax cover the need");
		assertFalse(d.shortfall());
		assertEquals(50_000, d.total(), EPS);
	}

	@Test
	void conventionalFlagsShortfallWhenBucketsRunOut() {
		Draw d = WithdrawalSequencer.source(WithdrawalStrategy.CONVENTIONAL,
			100_000, 10_000, 20_000, 5_000, 0);
		assertEquals(35_000, d.total(), EPS);
		assertTrue(d.shortfall());
	}

	// ---- proportional: pro-rata across every bucket ------------------------

	@Test
	void proportionalDrawsProRataByBalance() {
		Draw d = WithdrawalSequencer.source(WithdrawalStrategy.PROPORTIONAL,
			60_000, /*taxable*/ 30_000, /*trad*/ 60_000, /*roth*/ 10_000, 0);
		// pool = 100k, draw 60k → 30/60/10 % split
		assertEquals(18_000, d.fromTaxable(), EPS);
		assertEquals(36_000, d.fromTradExtra(), EPS);
		assertEquals(6_000, d.fromRoth(), EPS);
		assertFalse(d.shortfall());
	}

	// ---- tax-efficient: fill pre-tax to the bracket, even past the need ----

	@Test
	void taxEfficientFillsPreTaxUpToTheBracketBeyondImmediateNeed() {
		Draw d = WithdrawalSequencer.source(WithdrawalStrategy.TAX_EFFICIENT,
			/*need*/ 20_000, /*taxable*/ 50_000, /*trad*/ 100_000, /*roth*/ 30_000, /*fillRoom*/ 80_000);
		assertEquals(80_000, d.fromTradExtra(), EPS, "pulls pre-tax up to the bracket ceiling");
		assertEquals(0, d.fromTaxable(), EPS);
		assertEquals(0, d.fromRoth(), EPS);
		assertFalse(d.shortfall(), "the surplus over the need is parked by the caller, not a shortfall");
	}

	@Test
	void taxEfficientCoversNeedBeyondFillFromTaxableThenMorePreTaxThenRoth() {
		Draw d = WithdrawalSequencer.source(WithdrawalStrategy.TAX_EFFICIENT,
			/*need*/ 100_000, /*taxable*/ 50_000, /*trad*/ 100_000, /*roth*/ 30_000, /*fillRoom*/ 30_000);
		// fill 30k pre-tax, 50k taxable, then 20k more pre-tax; Roth untouched
		assertEquals(50_000, d.fromTradExtra(), EPS);
		assertEquals(50_000, d.fromTaxable(), EPS);
		assertEquals(0, d.fromRoth(), EPS);
		assertFalse(d.shortfall());
	}

	// ---- bracket-fill room --------------------------------------------------

	@Test
	void bracketFillRoomIsGrossRoomUnderTheNextBracket() {
		// MFJ 2025: top of 12% is the 22% floor $96,950; std deduction $30,000.
		double room = WithdrawalSequencer.bracketFillRoom(Filing.MARRIED_JOINT, 0,
			/*committedOrdinary*/ 26_950, /*targetRate*/ 0.12, /*realScale*/ 1.0);
		assertEquals(100_000, room, EPS); // (96,950 + 30,000) − 26,950
	}

	@Test
	void bracketFillRoomAddsThe65PlusDeductionAndErodesWithRealScale() {
		double bothOver65 = WithdrawalSequencer.bracketFillRoom(Filing.MARRIED_JOINT, 2, 0, 0.12, 1.0);
		assertEquals(96_950 + 30_000 + 2 * 1_600, bothOver65, EPS);

		double eroded = WithdrawalSequencer.bracketFillRoom(Filing.MARRIED_JOINT, 0, 0, 0.12, 0.9);
		assertEquals((96_950 + 30_000) * 0.9, eroded, EPS);
	}

	@Test
	void unknownStrategyStringFallsBackToConventional() {
		assertEquals(WithdrawalStrategy.CONVENTIONAL, WithdrawalStrategy.from(null));
		assertEquals(WithdrawalStrategy.CONVENTIONAL, WithdrawalStrategy.from("nonsense"));
		assertEquals(WithdrawalStrategy.TAX_EFFICIENT, WithdrawalStrategy.from("tax_efficient"));
	}
}
