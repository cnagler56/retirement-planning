package com.home.Domain;

import java.time.LocalDate;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * A single financial account with its current balance. Kept current by the user,
 * a CSV import, or a script pushing to the accounts API. Rolled up by type into
 * the plan's pre-tax / Roth / taxable buckets.
 */
@Entity
@Table(name = "accounts", indexes = @Index(name = "idx_account_user", columnList = "user_id"))
public class Account {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@JsonProperty
	private Long id;

	@Column(name = "user_id")
	@JsonProperty
	private Long userId;

	@JsonProperty
	private String name;

	/** TRADITIONAL, ROTH, TAXABLE, or OTHER. */
	@JsonProperty
	private String type;

	@JsonProperty
	private double balance;

	/** When this balance was last known to be accurate. */
	@JsonProperty
	private LocalDate asOfDate;

	@JsonProperty
	private LocalDateTime updatedAt;

	@PrePersist
	@PreUpdate
	void touch() { updatedAt = LocalDateTime.now(); }

	public Long getId() { return id; }
	public void setId(Long id) { this.id = id; }

	public Long getUserId() { return userId; }
	public void setUserId(Long userId) { this.userId = userId; }

	public String getName() { return name; }
	public void setName(String name) { this.name = name; }

	public String getType() { return type; }
	public void setType(String type) { this.type = type; }

	public double getBalance() { return balance; }
	public void setBalance(double balance) { this.balance = balance; }

	public LocalDate getAsOfDate() { return asOfDate; }
	public void setAsOfDate(LocalDate asOfDate) { this.asOfDate = asOfDate; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
