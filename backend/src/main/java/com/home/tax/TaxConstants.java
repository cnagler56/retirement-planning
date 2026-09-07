package com.home.tax;

/**
 * Federal tax constants for a single tax year. Centralized here so updating for a
 * new year is a one-file change. Values below are for TAX YEAR 2025 and should be
 * verified against IRS figures before relying on them.
 *
 * Not modeled (kept deliberately out of scope for now): itemized deductions,
 * credits, the 3.8% Net Investment Income Tax, AMT, and state income tax.
 */
public final class TaxConstants {

	private TaxConstants() {}

	public static final int TAX_YEAR = 2025;

	public enum Filing { SINGLE, MARRIED_JOINT }

	/** A marginal bracket: everything above {@code floor} (up to the next floor) is taxed at {@code rate}. */
	public record Bracket(double floor, double rate) {}

	// Ordinary-income brackets (2025), by taxable income.
	public static final Bracket[] ORDINARY_SINGLE = {
		new Bracket(0, 0.10),
		new Bracket(11_925, 0.12),
		new Bracket(48_475, 0.22),
		new Bracket(103_350, 0.24),
		new Bracket(197_300, 0.32),
		new Bracket(250_525, 0.35),
		new Bracket(626_350, 0.37),
	};

	public static final Bracket[] ORDINARY_MARRIED = {
		new Bracket(0, 0.10),
		new Bracket(23_850, 0.12),
		new Bracket(96_950, 0.22),
		new Bracket(206_700, 0.24),
		new Bracket(394_600, 0.32),
		new Bracket(501_050, 0.35),
		new Bracket(751_600, 0.37),
	};

	// Standard deduction (2025) and the additional amount per person age 65+.
	public static final double STD_DEDUCTION_SINGLE = 15_000;
	public static final double STD_DEDUCTION_MARRIED = 30_000;
	public static final double STD_DEDUCTION_65_SINGLE = 2_000;   // per filer 65+
	public static final double STD_DEDUCTION_65_MARRIED = 1_600;  // per spouse 65+

	// Long-term capital gains / qualified dividends brackets (2025), by taxable income.
	public static final double LTCG_0_TOP_SINGLE = 48_350;
	public static final double LTCG_15_TOP_SINGLE = 533_400;
	public static final double LTCG_0_TOP_MARRIED = 96_700;
	public static final double LTCG_15_TOP_MARRIED = 600_050;

	// Net Investment Income Tax (3.8%) MAGI thresholds. NOT inflation-indexed.
	public static final double NIIT_RATE = 0.038;
	public static final double NIIT_THRESHOLD_SINGLE = 200_000;
	public static final double NIIT_THRESHOLD_MARRIED = 250_000;

	public static double niitThreshold(Filing f) {
		return f == Filing.MARRIED_JOINT ? NIIT_THRESHOLD_MARRIED : NIIT_THRESHOLD_SINGLE;
	}

	// Social Security taxability thresholds (provisional income). NOT inflation-indexed.
	public static final double SS_BASE1_SINGLE = 25_000;
	public static final double SS_BASE2_SINGLE = 34_000;
	public static final double SS_BASE1_MARRIED = 32_000;
	public static final double SS_BASE2_MARRIED = 44_000;

	public static Bracket[] ordinaryBrackets(Filing f) {
		return f == Filing.MARRIED_JOINT ? ORDINARY_MARRIED : ORDINARY_SINGLE;
	}

	public static double standardDeduction(Filing f, int filersOver65) {
		if (f == Filing.MARRIED_JOINT) {
			return STD_DEDUCTION_MARRIED + STD_DEDUCTION_65_MARRIED * clamp(filersOver65, 0, 2);
		}
		return STD_DEDUCTION_SINGLE + STD_DEDUCTION_65_SINGLE * clamp(filersOver65, 0, 1);
	}

	public static double ltcgZeroTop(Filing f) {
		return f == Filing.MARRIED_JOINT ? LTCG_0_TOP_MARRIED : LTCG_0_TOP_SINGLE;
	}

	public static double ltcgFifteenTop(Filing f) {
		return f == Filing.MARRIED_JOINT ? LTCG_15_TOP_MARRIED : LTCG_15_TOP_SINGLE;
	}

	public static double ssBase1(Filing f) {
		return f == Filing.MARRIED_JOINT ? SS_BASE1_MARRIED : SS_BASE1_SINGLE;
	}

	public static double ssBase2(Filing f) {
		return f == Filing.MARRIED_JOINT ? SS_BASE2_MARRIED : SS_BASE2_SINGLE;
	}

	private static int clamp(int v, int lo, int hi) {
		return Math.max(lo, Math.min(hi, v));
	}
}
