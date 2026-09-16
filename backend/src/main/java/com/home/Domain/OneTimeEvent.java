package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A single-year cash flow at a specific age — an inheritance, a home sale, a new
 * car, a wedding, a lump medical bill. Unlike an income stream or expense (which
 * recur), an event happens once, in the year the owner reaches {@code age}.
 *
 * Amounts are in today's dollars. {@code inflow} distinguishes money coming in
 * (added to the portfolio / reducing the year's withdrawal need) from money going
 * out (an extra draw that year). Treated as after-tax cash — not added to taxable
 * income — which fits the common cases (inheritance, primary-home-sale exclusion,
 * a cash purchase); a taxable-windfall flag is a possible future refinement.
 */
@Embeddable
public class OneTimeEvent {

	private String label;
	private double amount;   // today's dollars, always entered as a positive number
	private int age;         // the primary's age in the year it happens
	private boolean inflow;  // true = money in (inheritance, sale); false = money out (purchase)

	public OneTimeEvent() {}

	/** Signed today's-dollars cash flow if this event lands on {@code atAge}, else 0.
	 *  Positive = money in, negative = money out. */
	public double netAt(int atAge) {
		if (amount <= 0 || atAge != age) return 0;
		return inflow ? amount : -amount;
	}

	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }

	public double getAmount() { return amount; }
	public void setAmount(double amount) { this.amount = amount; }

	public int getAge() { return age; }
	public void setAge(int age) { this.age = age; }

	public boolean isInflow() { return inflow; }
	public void setInflow(boolean inflow) { this.inflow = inflow; }
}
