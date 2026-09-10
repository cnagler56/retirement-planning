package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A recurring income stream that starts at a given age — a pension, rental
 * income, an annuity, part-time work, or (say) rent from inherited land that
 * begins when it's inherited.
 *
 * Amounts are entered in today's dollars. An inflation-adjusted stream holds its
 * real value (constant in today's dollars); a fixed-nominal one loses buying
 * power over time, so its today's-dollars value erodes by inflation each year.
 */
@Embeddable
public class IncomeStream {

	private String label;
	private double annualAmount;
	private int startAge;
	private int endAge;          // 0 = for life (through the horizon)
	private boolean inflationAdjusted;

	public IncomeStream() {}

	/** Today's-dollars value of this stream at a given age (0 if not active). */
	public double realIncomeAt(int age, int currentAge, double inflation) {
		int end = endAge > 0 ? endAge : Integer.MAX_VALUE;
		if (annualAmount <= 0 || age < startAge || age > end) return 0;
		if (inflationAdjusted) return annualAmount;
		// Fixed nominal: erodes in real terms from today.
		return annualAmount / Math.pow(1 + inflation, Math.max(0, age - currentAge));
	}

	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }

	public double getAnnualAmount() { return annualAmount; }
	public void setAnnualAmount(double annualAmount) { this.annualAmount = annualAmount; }

	public int getStartAge() { return startAge; }
	public void setStartAge(int startAge) { this.startAge = startAge; }

	public int getEndAge() { return endAge; }
	public void setEndAge(int endAge) { this.endAge = endAge; }

	public boolean isInflationAdjusted() { return inflationAdjusted; }
	public void setInflationAdjusted(boolean inflationAdjusted) { this.inflationAdjusted = inflationAdjusted; }
}
