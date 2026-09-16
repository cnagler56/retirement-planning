package com.home.tax;

/**
 * How retirement spending is sourced across the three account buckets each year,
 * after any required minimum distribution is taken.
 *
 * <ul>
 *   <li>{@link #CONVENTIONAL} — taxable → pre-tax → Roth. Lets the tax-advantaged
 *       accounts compound longest, but can leave a large pre-tax balance that
 *       forces big, highly taxed RMDs later.</li>
 *   <li>{@link #PROPORTIONAL} — draw pro-rata from every bucket by balance, which
 *       preserves tax diversification and smooths the mix over time.</li>
 *   <li>{@link #TAX_EFFICIENT} — fill pre-tax withdrawals up to the top of a target
 *       ordinary-income bracket first (levelling income into low brackets and
 *       shrinking future RMDs), then taxable, then Roth last.</li>
 * </ul>
 */
public enum WithdrawalStrategy {
	CONVENTIONAL,
	PROPORTIONAL,
	TAX_EFFICIENT;

	/** Parse a stored value, defaulting to {@link #CONVENTIONAL} for null/unknown. */
	public static WithdrawalStrategy from(String value) {
		if (value == null) return CONVENTIONAL;
		try {
			return WithdrawalStrategy.valueOf(value.trim().toUpperCase());
		} catch (IllegalArgumentException e) {
			return CONVENTIONAL;
		}
	}
}
