package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A net-worth asset the household holds outside its retirement draw-down buckets —
 * real estate, cash/savings, a vehicle, a business, etc.
 *
 * Tracked for the net-worth picture only: these are <em>not</em> spent or sold in
 * the projection. Value is in today's dollars. (Retirement accounts that fund the
 * plan live in the trad/Roth/taxable balances instead.)
 */
@Embeddable
public class Asset {

	private String label;
	private String type;   // REAL_ESTATE, CASH, VEHICLE, BUSINESS, OTHER
	private double value;  // today's dollars

	public Asset() {}

	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }

	public String getType() { return type; }
	public void setType(String type) { this.type = type; }

	public double getValue() { return value; }
	public void setValue(double value) { this.value = value; }
}
