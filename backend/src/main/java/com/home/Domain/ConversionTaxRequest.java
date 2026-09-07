package com.home.Domain;

/**
 * Household inputs for the accurate (tax-engine-based) Roth conversion analysis.
 *
 * @param filingStatus        "SINGLE" or "MARRIED_JOINT"
 * @param age                 the filer's age (for the 65+ standard deduction)
 * @param spouseAge           spouse's age if married-joint (0/absent otherwise)
 * @param annualSocialSecurity gross annual Social Security benefits (0 if not claiming)
 * @param otherOrdinaryIncome ordinary income before any conversion — pensions,
 *                            interest, wages, existing Traditional withdrawals / RMDs
 * @param qualifiedIncome     qualified dividends + long-term capital gains
 * @param conversionAmount    amount to convert from Traditional to Roth this year
 */
public record ConversionTaxRequest(
		String filingStatus,
		Integer age,
		Integer spouseAge,
		Double annualSocialSecurity,
		Double otherOrdinaryIncome,
		Double qualifiedIncome,
		Double conversionAmount) {
}
