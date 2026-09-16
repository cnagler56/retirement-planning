package com.home.tax;

import com.home.tax.TaxConstants.Bracket;
import com.home.tax.TaxConstants.Filing;

/**
 * Decides how much to draw from each account bucket to cover a year's spending,
 * given the chosen {@link WithdrawalStrategy}. Pure and side-effect free so it can
 * be unit-tested directly; the ledger owns the balances, taxes, and RMD around it.
 *
 * All amounts are today's dollars. The required minimum distribution is handled by
 * the caller before this runs, so {@code tradAvailable} is the pre-tax balance
 * <em>beyond</em> the RMD and {@code needBeyondRmd} is the spending still to fund
 * after the RMD (and guaranteed income) are applied.
 *
 * A strategy may deliberately withdraw more than {@code needBeyondRmd} — the
 * tax-efficient one pulls pre-tax up to a bracket ceiling even past the immediate
 * need — so the caller parks any surplus (as it already does with an unspent RMD).
 */
public final class WithdrawalSequencer {

	private WithdrawalSequencer() {}

	/** The amounts to pull from each bucket, plus whether the buckets fell short. */
	public record Draw(double fromTaxable, double fromTradExtra, double fromRoth, boolean shortfall) {
		public double total() {
			return fromTaxable + fromTradExtra + fromRoth;
		}
	}

	/**
	 * @param strategy      how to source the spending
	 * @param needBeyondRmd spending still to fund after RMD and guaranteed income (≥ 0)
	 * @param taxable       taxable-account balance available
	 * @param tradAvailable pre-tax balance beyond the RMD already taken
	 * @param roth          Roth balance available
	 * @param bracketFillRoom for {@link WithdrawalStrategy#TAX_EFFICIENT} only: how much
	 *                        more ordinary income fits under the target bracket ceiling
	 *                        this year (0 for other strategies)
	 */
	public static Draw source(WithdrawalStrategy strategy, double needBeyondRmd,
			double taxable, double tradAvailable, double roth, double bracketFillRoom) {
		double need = Math.max(0, needBeyondRmd);
		double t = Math.max(0, taxable);
		double d = Math.max(0, tradAvailable);
		double r = Math.max(0, roth);

		return switch (strategy) {
			case PROPORTIONAL -> proportional(need, t, d, r);
			case TAX_EFFICIENT -> taxEfficient(need, t, d, r, Math.max(0, bracketFillRoom));
			case CONVENTIONAL -> conventional(need, t, d, r);
		};
	}

	/** Taxable → pre-tax → Roth, taking only what the year needs. */
	private static Draw conventional(double need, double taxable, double trad, double roth) {
		double remaining = need;
		double wTaxable = Math.min(taxable, remaining); remaining -= wTaxable;
		double wTrad = Math.min(trad, remaining); remaining -= wTrad;
		double wRoth = Math.min(roth, remaining); remaining -= wRoth;
		return new Draw(wTaxable, wTrad, wRoth, remaining > 1);
	}

	/** Pro-rata across every bucket by balance. */
	private static Draw proportional(double need, double taxable, double trad, double roth) {
		double pool = taxable + trad + roth;
		if (pool <= 0) return new Draw(0, 0, 0, need > 1);
		double draw = Math.min(need, pool);
		double wTaxable = draw * (taxable / pool);
		double wTrad = draw * (trad / pool);
		double wRoth = draw * (roth / pool);
		return new Draw(wTaxable, wTrad, wRoth, need - draw > 1);
	}

	/**
	 * Fill pre-tax up to the bracket ceiling first (even beyond the immediate need),
	 * then cover any remainder from taxable, then more pre-tax if forced, then Roth.
	 */
	private static Draw taxEfficient(double need, double taxable, double trad, double roth, double fillRoom) {
		double wTrad = Math.min(trad, fillRoom);   // pre-tax up to the low-bracket ceiling
		double remaining = need - wTrad;            // negative → pre-tax over-covers the need
		double wTaxable = 0, wRoth = 0;
		boolean shortfall = false;
		if (remaining > 0) {
			wTaxable = Math.min(taxable, remaining); remaining -= wTaxable;
			double moreTrad = Math.min(trad - wTrad, remaining); wTrad += moreTrad; remaining -= moreTrad;
			wRoth = Math.min(roth, remaining); remaining -= wRoth;
			shortfall = remaining > 1;
		}
		return new Draw(wTaxable, wTrad, wRoth, shortfall);
	}

	/**
	 * How much more ordinary income fits under the target bracket this year — the
	 * gross-income room below the top of the {@code targetBracketRate} bracket, given
	 * the ordinary income already committed (pension, RMD, taxable streams).
	 *
	 * Thresholds erode in real terms by {@code realScale}, matching {@link
	 * FederalTaxService}. This is a heuristic ceiling: because filling ordinary income
	 * can pull more Social Security into taxable income, the realized bracket may edge
	 * slightly higher — the ledger's tax calc remains exact.
	 */
	public static double bracketFillRoom(Filing filing, int filersOver65, double committedOrdinary,
			double targetBracketRate, double realScale) {
		Bracket[] brackets = TaxConstants.ordinaryBrackets(filing);
		double taxableCeiling = Double.MAX_VALUE;
		for (Bracket b : brackets) {
			if (b.rate() > targetBracketRate + 1e-9) { taxableCeiling = b.floor(); break; }
		}
		if (taxableCeiling == Double.MAX_VALUE) return Double.MAX_VALUE; // top bracket target: no ceiling
		double grossCeiling = (taxableCeiling + TaxConstants.standardDeduction(filing, filersOver65)) * realScale;
		return Math.max(0, grossCeiling - committedOrdinary);
	}
}
