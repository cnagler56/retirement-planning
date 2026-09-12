package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A recurring income stream that starts at a given age — employment, rental,
 * business, a pension, an annuity, or (say) rent from inherited land.
 *
 * Amounts are in today's dollars. An inflation-adjusted stream holds its real
 * value; a fixed-nominal one erodes by inflation each year.
 *
 * A stream belongs to a person ({@code owner} = SELF or SPOUSE) and its
 * start/end ages are expressed in <em>that person's</em> age — so a spouse who
 * keeps working can be set to end at her own retirement age. It also has a
 * {@code type} that determines whether it is taxable ordinary income; only
 * TAX_FREE (Roth distributions, return of capital, municipal interest) is
 * treated as non-taxable.
 */
@Embeddable
public class IncomeStream {

	public static final String SELF = "SELF";
	public static final String SPOUSE = "SPOUSE";

	private String label;
	private double annualAmount;
	private int startAge;
	private int endAge;          // 0 = for life (through the horizon)
	private boolean inflationAdjusted;
	private String owner;        // SELF (default) or SPOUSE — whose age the ages refer to
	private String type;         // EMPLOYMENT, RENTAL, BUSINESS, PENSION, ANNUITY, TAXABLE_OTHER, TAX_FREE

	public IncomeStream() {}

	/**
	 * Today's-dollars value of this stream in a given plan year.
	 *
	 * @param ownerAge     the owner's age that year (primary or spouse), matched
	 *                     against this stream's start/end ages
	 * @param yearsElapsed plan years from now (for deflating a fixed-nominal amount)
	 */
	public double realIncomeAt(int ownerAge, int yearsElapsed, double inflation) {
		int end = endAge > 0 ? endAge : Integer.MAX_VALUE;
		if (annualAmount <= 0 || ownerAge < startAge || ownerAge > end) return 0;
		if (inflationAdjusted) return annualAmount;
		return annualAmount / Math.pow(1 + inflation, Math.max(0, yearsElapsed));
	}

	/** Whether this stream is taxable ordinary income (everything but TAX_FREE). */
	public boolean isTaxable() {
		return type == null || !type.equalsIgnoreCase("TAX_FREE");
	}

	/** True if this stream belongs to the spouse (its ages are the spouse's ages). */
	public boolean isSpouseOwned() {
		return SPOUSE.equalsIgnoreCase(owner);
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

	public String getOwner() { return owner; }
	public void setOwner(String owner) { this.owner = owner; }

	public String getType() { return type; }
	public void setType(String type) { this.type = type; }
}
