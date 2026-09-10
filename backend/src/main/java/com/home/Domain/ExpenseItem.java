package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A retirement expense line — base living costs, a mortgage that ends at a
 * certain age, travel during the go-go years, a one-off like a new roof, etc.
 *
 * Amounts are in today's dollars. Inflation-adjusted expenses hold their real
 * value; a fixed-nominal one (like a level mortgage payment) loses real value
 * over time.
 */
@Embeddable
public class ExpenseItem {

	private String label;
	private double annualAmount;
	private int startAge;
	private int endAge;          // 0 = through the plan horizon
	private boolean inflationAdjusted = true;

	public ExpenseItem() {}

	/** Today's-dollars amount of this expense at a given age (0 if not active). */
	public double realAmountAt(int age, int currentAge, double inflation) {
		int end = endAge > 0 ? endAge : Integer.MAX_VALUE;
		if (annualAmount <= 0 || age < startAge || age > end) return 0;
		if (inflationAdjusted) return annualAmount;
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
