package com.home.tax;

import org.springframework.stereotype.Service;

import com.home.tax.TaxConstants.Bracket;
import com.home.tax.TaxConstants.Filing;

/**
 * A simplified but faithful federal income-tax calculator for a retiree
 * household. Given the components of income it computes tax the way the 1040
 * does — including the two effects that dominate Roth conversion decisions:
 *
 *  - Social Security taxation: how much of the benefit is taxable depends on
 *    "provisional income" (other income + half the benefit), via the IRS
 *    worksheet. More ordinary income → more of the benefit taxed (the "tax
 *    torpedo").
 *  - Capital-gains stacking: qualified dividends and long-term gains sit on top
 *    of ordinary taxable income and are taxed at 0/15/20%. Pushing up ordinary
 *    income (e.g. a conversion) can spill gains from the 0% band into 15%.
 *
 * Out of scope: itemized deductions, credits, NIIT, AMT, and state tax.
 */
@Service
public class FederalTaxService {

	/**
	 * @param filing              filing status
	 * @param filersOver65        how many filers are 65+ (0–2), for the extra deduction
	 * @param otherOrdinaryIncome ordinary income other than Social Security — pensions,
	 *                            interest, wages, Traditional withdrawals, RMDs, and any
	 *                            Roth conversion
	 * @param socialSecurity      gross annual Social Security benefits
	 * @param qualifiedIncome     qualified dividends + long-term capital gains
	 */
	public FederalTax compute(Filing filing, int filersOver65,
			double otherOrdinaryIncome, double socialSecurity, double qualifiedIncome) {
		return compute(filing, filersOver65, otherOrdinaryIncome, socialSecurity, qualifiedIncome, 1.0);
	}

	/**
	 * @param ssThresholdScale scales the Social Security taxability thresholds. They
	 *                         are not inflation-indexed, so a real-dollar multi-year
	 *                         model passes {@code 1/(1+inflation)^t} to shrink them
	 *                         over time (more of the benefit becomes taxable).
	 */
	public FederalTax compute(Filing filing, int filersOver65,
			double otherOrdinaryIncome, double socialSecurity, double qualifiedIncome,
			double ssThresholdScale) {

		double ordOther = Math.max(0, otherOrdinaryIncome);
		double ss = Math.max(0, socialSecurity);
		double qualified = Math.max(0, qualifiedIncome);

		double taxableSs = taxableSocialSecurity(filing, ordOther + qualified, ss, ssThresholdScale);
		double agi = ordOther + qualified + taxableSs;

		double stdDeduction = TaxConstants.standardDeduction(filing, filersOver65);
		double taxableIncome = Math.max(0, agi - stdDeduction);

		// Qualified income is taxed at capital-gains rates; the rest is ordinary.
		double qualifiedInTaxable = Math.min(qualified, taxableIncome);
		double ordinaryTaxable = taxableIncome - qualifiedInTaxable;

		double ordinaryTax = bracketTax(ordinaryTaxable, TaxConstants.ordinaryBrackets(filing));
		double capGainsTax = capitalGainsTax(filing, ordinaryTaxable, qualifiedInTaxable, taxableIncome);

		// Net Investment Income Tax: 3.8% of the lesser of net investment income
		// (here, qualified dividends + gains) or MAGI over the threshold.
		double niitThreshold = TaxConstants.niitThreshold(filing) * ssThresholdScale;
		double niit = TaxConstants.NIIT_RATE * Math.min(qualified, Math.max(0, agi - niitThreshold));

		return new FederalTax(
			round(ordinaryTax + capGainsTax + niit),
			round(agi),
			round(taxableIncome),
			round(taxableSs),
			round(ordinaryTax),
			round(capGainsTax),
			round(ordinaryTaxable),
			marginalOrdinaryRate(ordinaryTaxable, TaxConstants.ordinaryBrackets(filing)),
			round(niit)
		);
	}

	/** Taxable portion of Social Security via the IRS provisional-income worksheet. */
	private double taxableSocialSecurity(Filing filing, double otherIncome, double ss, double thresholdScale) {
		if (ss <= 0) return 0;
		double base1 = TaxConstants.ssBase1(filing) * thresholdScale;
		double base2 = TaxConstants.ssBase2(filing) * thresholdScale;
		double provisional = otherIncome + 0.5 * ss;

		if (provisional <= base1) return 0;
		if (provisional <= base2) {
			return Math.min(0.5 * ss, 0.5 * (provisional - base1));
		}
		double amount = 0.85 * (provisional - base2) + Math.min(0.5 * ss, 0.5 * (base2 - base1));
		return Math.min(0.85 * ss, amount);
	}

	/** Tax on qualified income (LTCG/dividends) stacked on top of ordinary taxable income. */
	private double capitalGainsTax(Filing filing, double ordinaryTaxable, double qualified, double taxableIncome) {
		if (qualified <= 0) return 0;
		double zeroTop = TaxConstants.ltcgZeroTop(filing);
		double fifteenTop = TaxConstants.ltcgFifteenTop(filing);

		double start = ordinaryTaxable;             // gains stack above ordinary income
		double end = start + qualified;             // == taxableIncome

		double at0 = Math.max(0, Math.min(end, zeroTop) - start);
		double at15 = Math.max(0, Math.min(end, fifteenTop) - Math.max(start, zeroTop));
		double at20 = Math.max(0, end - Math.max(start, fifteenTop));

		return at15 * 0.15 + at20 * 0.20;
	}

	/** Progressive tax across the marginal brackets. */
	private double bracketTax(double taxable, Bracket[] brackets) {
		if (taxable <= 0) return 0;
		double tax = 0;
		for (int i = 0; i < brackets.length; i++) {
			double floor = brackets[i].floor();
			if (taxable <= floor) break;
			double ceil = (i + 1 < brackets.length) ? brackets[i + 1].floor() : Double.MAX_VALUE;
			double amountInBracket = Math.min(taxable, ceil) - floor;
			tax += amountInBracket * brackets[i].rate();
		}
		return tax;
	}

	/** The marginal ordinary bracket rate that the last dollar of ordinary income lands in. */
	private double marginalOrdinaryRate(double ordinaryTaxable, Bracket[] brackets) {
		double rate = brackets[0].rate();
		for (Bracket b : brackets) {
			if (ordinaryTaxable > b.floor()) rate = b.rate();
			else break;
		}
		return rate;
	}

	private static double round(double v) {
		return Math.round(v);
	}

	/**
	 * A computed tax return.
	 *
	 * @param totalTax               federal income tax owed
	 * @param agi                    adjusted gross income
	 * @param taxableIncome          AGI minus the standard deduction
	 * @param taxableSocialSecurity  how much of the SS benefit was taxable
	 * @param ordinaryTax            tax on ordinary income
	 * @param capitalGainsTax        tax on qualified dividends / long-term gains
	 * @param ordinaryTaxableIncome  taxable income excluding qualified income
	 * @param marginalOrdinaryRate   bracket the last ordinary dollar fell in
	 * @param niit                   Net Investment Income Tax (3.8%) included in totalTax
	 */
	public record FederalTax(
			double totalTax,
			double agi,
			double taxableIncome,
			double taxableSocialSecurity,
			double ordinaryTax,
			double capitalGainsTax,
			double ordinaryTaxableIncome,
			double marginalOrdinaryRate,
			double niit) {}
}
