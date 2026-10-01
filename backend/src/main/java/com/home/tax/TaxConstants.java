package com.home.tax;

/**
 * Federal tax constants for a single tax year. Centralized here so updating for a
 * new year is a one-file change. Values below are for TAX YEAR 2026 (IRS Rev. Proc.
 * 2025-32, as amended by the One Big Beautiful Bill Act) and should be verified
 * against IRS figures before relying on them.
 *
 * Not modeled (kept deliberately out of scope for now): itemized deductions,
 * credits, AMT, and state income tax.
 */
public final class TaxConstants {

	private TaxConstants() {}

	public static final int TAX_YEAR = 2026;

	public enum Filing { SINGLE, MARRIED_JOINT }

	/** A marginal bracket: everything above {@code floor} (up to the next floor) is taxed at {@code rate}. */
	public record Bracket(double floor, double rate) {}

	// Ordinary-income brackets (2026), by taxable income.
	public static final Bracket[] ORDINARY_SINGLE = {
		new Bracket(0, 0.10),
		new Bracket(12_400, 0.12),
		new Bracket(50_400, 0.22),
		new Bracket(105_700, 0.24),
		new Bracket(201_775, 0.32),
		new Bracket(256_225, 0.35),
		new Bracket(640_600, 0.37),
	};

	public static final Bracket[] ORDINARY_MARRIED = {
		new Bracket(0, 0.10),
		new Bracket(24_800, 0.12),
		new Bracket(100_800, 0.22),
		new Bracket(211_400, 0.24),
		new Bracket(403_550, 0.32),
		new Bracket(512_450, 0.35),
		new Bracket(768_700, 0.37),
	};

	// Standard deduction (2026) and the additional amount per person age 65+.
	public static final double STD_DEDUCTION_SINGLE = 16_100;
	public static final double STD_DEDUCTION_MARRIED = 32_200;
	public static final double STD_DEDUCTION_65_SINGLE = 2_050;   // per filer 65+
	public static final double STD_DEDUCTION_65_MARRIED = 1_650;  // per spouse 65+

	// "Senior deduction" (OBBBA §70103): $6,000 per filer 65+, on top of the standard
	// deduction, for tax years 2025–2028 only. Each person's $6,000 shrinks by 6% of
	// MAGI over the threshold. NOT inflation-indexed.
	public static final double SENIOR_DEDUCTION_PER_PERSON = 6_000;
	public static final double SENIOR_DEDUCTION_PHASEOUT_RATE = 0.06;
	public static final double SENIOR_DEDUCTION_PHASEOUT_SINGLE = 75_000;
	public static final double SENIOR_DEDUCTION_PHASEOUT_MARRIED = 150_000;
	public static final int SENIOR_DEDUCTION_FIRST_YEAR = 2025;
	public static final int SENIOR_DEDUCTION_LAST_YEAR = 2028;

	// Long-term capital gains / qualified dividends brackets (2026), by taxable income.
	public static final double LTCG_0_TOP_SINGLE = 49_450;
	public static final double LTCG_15_TOP_SINGLE = 545_500;
	public static final double LTCG_0_TOP_MARRIED = 98_900;
	public static final double LTCG_15_TOP_MARRIED = 613_700;

	// Net Investment Income Tax (3.8%) MAGI thresholds. NOT inflation-indexed.
	public static final double NIIT_RATE = 0.038;
	public static final double NIIT_THRESHOLD_SINGLE = 200_000;
	public static final double NIIT_THRESHOLD_MARRIED = 250_000;

	public static double niitThreshold(Filing f) {
		return f == Filing.MARRIED_JOINT ? NIIT_THRESHOLD_MARRIED : NIIT_THRESHOLD_SINGLE;
	}

	// Payroll (FICA) tax on wages (2026): 6.2% Social Security up to the wage base,
	// plus 1.45% Medicare on all wages. The 0.9% additional Medicare tax is not modeled.
	public static final double FICA_SS_RATE = 0.062;
	public static final double FICA_SS_WAGE_BASE = 184_500;
	public static final double FICA_MEDICARE_RATE = 0.0145;

	/** Employee payroll tax on one person's wages (each paycheck is treated as one earner). */
	public static double payrollTax(double wages) {
		if (wages <= 0) return 0;
		return FICA_SS_RATE * Math.min(wages, FICA_SS_WAGE_BASE) + FICA_MEDICARE_RATE * wages;
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

	/**
	 * The senior deduction for a return.
	 *
	 * @param magi        modified AGI (for a retiree, AGI)
	 * @param taxYear     calendar tax year — the deduction only exists 2025–2028
	 * @param dollarScale scales the non-indexed $6,000 and phase-out thresholds; a
	 *                    real-dollar multi-year model passes {@code 1/(1+inflation)^t}
	 */
	public static double seniorDeduction(Filing f, int filersOver65, double magi, int taxYear, double dollarScale) {
		if (taxYear < SENIOR_DEDUCTION_FIRST_YEAR || taxYear > SENIOR_DEDUCTION_LAST_YEAR) return 0;
		int eligible = clamp(filersOver65, 0, f == Filing.MARRIED_JOINT ? 2 : 1);
		if (eligible == 0) return 0;
		double threshold = (f == Filing.MARRIED_JOINT ? SENIOR_DEDUCTION_PHASEOUT_MARRIED : SENIOR_DEDUCTION_PHASEOUT_SINGLE)
			* dollarScale;
		double reduction = SENIOR_DEDUCTION_PHASEOUT_RATE * Math.max(0, magi - threshold);
		double perPerson = Math.max(0, SENIOR_DEDUCTION_PER_PERSON * dollarScale - reduction);
		return perPerson * eligible;
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
