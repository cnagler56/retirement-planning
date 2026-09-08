package com.home.Domain;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * A user's retirement planning inputs — one row per user. The projection math
 * lives in ProjectionService; this is just the saved starting point.
 *
 * Rates are stored as decimals (0.07 = 7%). Money fields are plain doubles:
 * projections are estimates, so cent-accurate BigDecimal precision isn't worth
 * the ceremony here.
 */
@Entity
@Table(name = "retirement_profiles")
public class RetirementProfile {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@JsonProperty
	private Long id;

	/** Owning user. Unique — one profile per user. */
	@Column(name = "user_id", unique = true)
	@JsonProperty
	private Long userId;

	@JsonProperty
	private int currentAge;

	@JsonProperty
	private int retirementAge;

	/** Amount already saved toward retirement, today. */
	@JsonProperty
	private double currentSavings;

	/** Recurring monthly contribution going forward. */
	@JsonProperty
	private double monthlyContribution;

	/** Expected average annual return, as a decimal (0.07 = 7%). */
	@JsonProperty
	private double annualReturnRate;

	/** Expected annual inflation, as a decimal (0.025 = 2.5%). Optional context. */
	@JsonProperty
	private double inflationRate;

	/** "SINGLE" or "MARRIED_JOINT" — drives tax brackets across the calculators. */
	@JsonProperty
	private String filingStatus;

	/** Spouse's current age (married-joint only). */
	@JsonProperty
	private int spouseAge;

	/** Pre-tax (Traditional IRA / 401k) balance, today's dollars. */
	@JsonProperty
	private double tradBalance;

	/** Roth balance, today's dollars. */
	@JsonProperty
	private double rothBalance;

	/** Taxable brokerage balance, today's dollars. */
	@JsonProperty
	private double taxableBalance;

	/** Annual pension income (ordinary), today's dollars. */
	@JsonProperty
	private double annualPension;

	/** Flat state income-tax rate (decimal). */
	@JsonProperty
	private double stateTaxRate;

	/** Desired gross income per year in retirement, in today's dollars. */
	@JsonProperty
	private double desiredAnnualIncome;

	/** Expected Social Security benefit at full retirement age (today's dollars). */
	@JsonProperty
	private double ssMonthlyAtFra;

	/** Age at which Social Security is claimed (62–70). 0/absent = no SS modeled. */
	@JsonProperty
	private int ssClaimAge;

	/** Age to run the plan through (life expectancy for planning). */
	@JsonProperty
	private int planThroughAge;

	@JsonProperty
	private LocalDateTime updatedAt;

	@PreUpdate
	void onUpdate() {
		updatedAt = LocalDateTime.now();
	}

	public Long getId() { return id; }
	public void setId(Long id) { this.id = id; }

	public Long getUserId() { return userId; }
	public void setUserId(Long userId) { this.userId = userId; }

	public int getCurrentAge() { return currentAge; }
	public void setCurrentAge(int currentAge) { this.currentAge = currentAge; }

	public int getRetirementAge() { return retirementAge; }
	public void setRetirementAge(int retirementAge) { this.retirementAge = retirementAge; }

	public double getCurrentSavings() { return currentSavings; }
	public void setCurrentSavings(double currentSavings) { this.currentSavings = currentSavings; }

	public double getMonthlyContribution() { return monthlyContribution; }
	public void setMonthlyContribution(double monthlyContribution) { this.monthlyContribution = monthlyContribution; }

	public double getAnnualReturnRate() { return annualReturnRate; }
	public void setAnnualReturnRate(double annualReturnRate) { this.annualReturnRate = annualReturnRate; }

	public double getInflationRate() { return inflationRate; }
	public void setInflationRate(double inflationRate) { this.inflationRate = inflationRate; }

	public double getDesiredAnnualIncome() { return desiredAnnualIncome; }
	public void setDesiredAnnualIncome(double desiredAnnualIncome) { this.desiredAnnualIncome = desiredAnnualIncome; }

	public String getFilingStatus() { return filingStatus; }
	public void setFilingStatus(String filingStatus) { this.filingStatus = filingStatus; }

	public int getSpouseAge() { return spouseAge; }
	public void setSpouseAge(int spouseAge) { this.spouseAge = spouseAge; }

	public double getTradBalance() { return tradBalance; }
	public void setTradBalance(double tradBalance) { this.tradBalance = tradBalance; }

	public double getRothBalance() { return rothBalance; }
	public void setRothBalance(double rothBalance) { this.rothBalance = rothBalance; }

	public double getTaxableBalance() { return taxableBalance; }
	public void setTaxableBalance(double taxableBalance) { this.taxableBalance = taxableBalance; }

	public double getAnnualPension() { return annualPension; }
	public void setAnnualPension(double annualPension) { this.annualPension = annualPension; }

	public double getStateTaxRate() { return stateTaxRate; }
	public void setStateTaxRate(double stateTaxRate) { this.stateTaxRate = stateTaxRate; }

	public double getSsMonthlyAtFra() { return ssMonthlyAtFra; }
	public void setSsMonthlyAtFra(double ssMonthlyAtFra) { this.ssMonthlyAtFra = ssMonthlyAtFra; }

	public int getSsClaimAge() { return ssClaimAge; }
	public void setSsClaimAge(int ssClaimAge) { this.ssClaimAge = ssClaimAge; }

	public int getPlanThroughAge() { return planThroughAge; }
	public void setPlanThroughAge(int planThroughAge) { this.planThroughAge = planThroughAge; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
