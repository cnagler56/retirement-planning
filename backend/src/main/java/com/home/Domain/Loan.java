package com.home.Domain;

import jakarta.persistence.Embeddable;

/**
 * A loan being paid down — mortgage, car, student, HELOC, etc.
 *
 * The balance and payment are nominal (fixed-dollar) — a fixed payment loses real
 * value over time, and the balance amortizes to zero. {@code startAge} defaults to
 * "now" (0); set it for a loan that begins later.
 *
 * Beyond a plain payment, a loan can model the levers people actually pull:
 *  - {@code extraMonthly}: extra principal added to every payment.
 *  - {@code lumpSums}: one-time extra principal at given ages, encoded as a compact
 *    "age:amount;age:amount" string so it fits an embedded column (no child table).
 *  - {@code paymentAnnualIncreasePct}: the payment steps up this fraction each year.
 *  - {@code refinanceAge} / {@code refinanceRate} / {@code refinanceTermYears}: at
 *    a future age the rate changes; with a term set, the remaining balance is
 *    re-amortized to a new payment, otherwise the existing payment continues.
 */
@Embeddable
public class Loan {

	private String label;
	private double balance;          // current principal owed (nominal)
	private double annualRate;       // decimal, e.g. 0.055
	private double monthlyPayment;   // nominal monthly payment
	private int startAge;            // 0 = active now

	private double extraMonthly;              // extra principal added every month (nominal)
	private String lumpSums;                  // "age:amount;age:amount" one-time extra principal
	private double paymentAnnualIncreasePct;  // decimal; payment grows this much each year
	private int refinanceAge;                 // 0 = no refinance
	private double refinanceRate;             // new annual rate from refinanceAge on
	private int refinanceTermYears;           // >0 re-amortizes remaining balance over this term

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

	public double getExtraMonthly() { return extraMonthly; }
	public void setExtraMonthly(double extraMonthly) { this.extraMonthly = extraMonthly; }

	public String getLumpSums() { return lumpSums; }
	public void setLumpSums(String lumpSums) { this.lumpSums = lumpSums; }

	public double getPaymentAnnualIncreasePct() { return paymentAnnualIncreasePct; }
	public void setPaymentAnnualIncreasePct(double paymentAnnualIncreasePct) { this.paymentAnnualIncreasePct = paymentAnnualIncreasePct; }

	public int getRefinanceAge() { return refinanceAge; }
	public void setRefinanceAge(int refinanceAge) { this.refinanceAge = refinanceAge; }

	public double getRefinanceRate() { return refinanceRate; }
	public void setRefinanceRate(double refinanceRate) { this.refinanceRate = refinanceRate; }

	public int getRefinanceTermYears() { return refinanceTermYears; }
	public void setRefinanceTermYears(int refinanceTermYears) { this.refinanceTermYears = refinanceTermYears; }
}
