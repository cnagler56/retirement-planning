package com.home.Domain;

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
 * A named saved plan variation — e.g. "Retire at 62" vs "Retire at 67" — used by
 * the scenario comparison. The plan inputs are stored as a JSON blob so the
 * scenario isn't coupled to the profile's exact fields.
 */
@Entity
@Table(name = "scenarios", indexes = @Index(name = "idx_scenario_user", columnList = "user_id"))
public class Scenario {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@JsonProperty
	private Long id;

	@Column(name = "user_id")
	@JsonProperty
	private Long userId;

	@JsonProperty
	private String name;

	/** The plan inputs (a RetirementProfile) serialized as JSON. */
	@Column(length = 20000)
	@JsonProperty
	private String inputsJson;

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

	public String getInputsJson() { return inputsJson; }
	public void setInputsJson(String inputsJson) { this.inputsJson = inputsJson; }

	public LocalDateTime getUpdatedAt() { return updatedAt; }
	public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
