package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A loan being paid down — mortgage, car, student, HELOC, etc.
 *
 * The balance and payment are nominal (fixed-dollar) — a fixed payment loses real
 * value over time, and the balance amortizes to zero. {@code startAge} defaults to
 * "now" (0); set it for a loan that begins later.
 */
@Embeddable
public class Loan {

	private String label;
	private double balance;          // current principal owed (nominal)
	private double annualRate;       // decimal, e.g. 0.055
	private double monthlyPayment;   // nominal monthly payment
	private int startAge;            // 0 = active now

	public Loan() {}

	public String getLabel() { return label; }
	public void setLabel(String label) { this.label = label; }

	public double getBalance() { return balance; }
	public void setBalance(double balance) { this.balance = balance; }

	public double getAnnualRate() { return annualRate; }
	public void setAnnualRate(double annualRate) { this.annualRate = annualRate; }

	public double getMonthlyPayment() { return monthlyPayment; }
	public void setMonthlyPayment(double monthlyPayment) { this.monthlyPayment = monthlyPayment; }

	public int getStartAge() { return startAge; }
	public void setStartAge(int startAge) { this.startAge = startAge; }
}
