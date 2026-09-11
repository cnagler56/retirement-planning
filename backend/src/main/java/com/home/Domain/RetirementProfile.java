package com.home.Domain;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
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

	/** Date of birth — the durable fact; the current age is derived from it. */
	@JsonProperty
	private LocalDate birthDate;

	/** Spouse's date of birth (married-joint). */
	@JsonProperty
	private LocalDate spouseBirthDate;

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

	/** Annual retirement healthcare cost today (premiums + out-of-pocket), today's dollars. */
	@JsonProperty
	private double annualHealthcareCost;

	/** Healthcare-specific inflation (decimal) — typically higher than general inflation. */
	@JsonProperty
	private double healthcareInflationRate;

	/** Whether to model a long-term-care shock late in life. */
	@JsonProperty
	private boolean ltcEnabled;

	/** Annual long-term-care cost (today's dollars) during the LTC window. */
	@JsonProperty
	private double ltcAnnualCost;

	/** Age the long-term-care need begins. */
	@JsonProperty
	private int ltcStartAge;

	/** How many years the long-term-care need lasts. */
	@JsonProperty
	private int ltcYears;

	/** State of residence (2-letter code) — used to default the state tax rate. */
	@JsonProperty
	private String state;

	/** Flat state income-tax rate (decimal). */
	@JsonProperty
	private double stateTaxRate;

	/** Additional income streams — pension, rental, annuity, inherited-land rent, etc. */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "profile_income_streams", joinColumns = @JoinColumn(name = "profile_id"))
	@JsonProperty
	private List<IncomeStream> incomeStreams = new ArrayList<>();

	/** Itemized retirement expenses (base living costs, travel, mortgage, one-offs). */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "profile_expenses", joinColumns = @JoinColumn(name = "profile_id"))
	@JsonProperty
	private List<ExpenseItem> expenses = new ArrayList<>();

	/** Loans / debts being paid down (mortgage, car, student, …). */
	@ElementCollection(fetch = FetchType.EAGER)
	@CollectionTable(name = "profile_loans", joinColumns = @JoinColumn(name = "profile_id"))
	@JsonProperty
	private List<Loan> loans = new ArrayList<>();

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

	public LocalDate getBirthDate() { return birthDate; }
	public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }

	public LocalDate getSpouseBirthDate() { return spouseBirthDate; }
	public void setSpouseBirthDate(LocalDate spouseBirthDate) { this.spouseBirthDate = spouseBirthDate; }

	/** Current age, derived from the birth date (0 if unset). Serialized for convenience. */
	@JsonProperty
	public int getCurrentAge() { return ageFrom(birthDate); }

	/** Spouse's current age, derived from their birth date. */
	@JsonProperty
	public int getSpouseAge() { return ageFrom(spouseBirthDate); }

	/** Birth year (for RMD start age and Social Security FRA). */
	@JsonIgnore
	public int getBirthYear() {
		return birthDate != null ? birthDate.getYear() : java.time.Year.now().getValue() - getCurrentAge();
	}

	private static int ageFrom(LocalDate d) {
		return d == null ? 0 : Period.between(d, LocalDate.now()).getYears();
	}

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

	public double getTradBalance() { return tradBalance; }
	public void setTradBalance(double tradBalance) { this.tradBalance = tradBalance; }

	public double getRothBalance() { return rothBalance; }
	public void setRothBalance(double rothBalance) { this.rothBalance = rothBalance; }

	public double getTaxableBalance() { return taxableBalance; }
	public void setTaxableBalance(double taxableBalance) { this.taxableBalance = taxableBalance; }

	public double getAnnualPension() { return annualPension; }
	public void setAnnualPension(double annualPension) { this.annualPension = annualPension; }

	public double getAnnualHealthcareCost() { return annualHealthcareCost; }
	public void setAnnualHealthcareCost(double v) { this.annualHealthcareCost = v; }

	public double getHealthcareInflationRate() { return healthcareInflationRate; }
	public void setHealthcareInflationRate(double v) { this.healthcareInflationRate = v; }

	public boolean isLtcEnabled() { return ltcEnabled; }
	public void setLtcEnabled(boolean v) { this.ltcEnabled = v; }

	public double getLtcAnnualCost() { return ltcAnnualCost; }
	public void setLtcAnnualCost(double v) { this.ltcAnnualCost = v; }

	public int getLtcStartAge() { return ltcStartAge; }
	public void setLtcStartAge(int v) { this.ltcStartAge = v; }

	public int getLtcYears() { return ltcYears; }
	public void setLtcYears(int v) { this.ltcYears = v; }

	public String getState() { return state; }
	public void setState(String state) { this.state = state; }

	public double getStateTaxRate() { return stateTaxRate; }
	public void setStateTaxRate(double stateTaxRate) { this.stateTaxRate = stateTaxRate; }

	public List<IncomeStream> getIncomeStreams() { return incomeStreams; }
	public void setIncomeStreams(List<IncomeStream> incomeStreams) {
		this.incomeStreams = incomeStreams != null ? incomeStreams : new ArrayList<>();
	}

	public List<ExpenseItem> getExpenses() { return expenses; }
	public void setExpenses(List<ExpenseItem> expenses) {
		this.expenses = expenses != null ? expenses : new ArrayList<>();
	}

	public List<Loan> getLoans() { return loans; }
	public void setLoans(List<Loan> loans) {
		this.loans = loans != null ? loans : new ArrayList<>();
	}

	public double getSsMonthlyAtFra() { return ssMonthlyAtFra; }
	public void setSsMonthlyAtFra(double ssMonthlyAtFra) { this.ssMonthlyAtFra = ssMonthlyAtFra; }

	public int getSsClaimAge() { return ssClaimAge; }
	public void setSsClaimAge(int ssClaimAge) { this.ssClaimAge = ssClaimAge; }

	public int getPlanThroughAge() { return planThroughAge; }
	public void setPlanThroughAge(int planThroughAge) { this.planThroughAge = planThroughAge; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
