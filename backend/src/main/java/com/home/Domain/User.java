package com.home.Domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An account holder. The password is stored BCrypt-hashed and is never
 * serialized back to the client — {@link JsonIgnore} on the getter keeps it out
 * of every /me and auth response.
 */
@Entity
@Table(name = "users")
public class User {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@JsonProperty
	@Column(name = "userid")
	private Long userId;

	@JsonProperty
	@Column(name = "first_name")
	private String firstName;

	@JsonProperty
	@Column(name = "last_name")
	private String lastName;

	@JsonProperty
	@Column(unique = true)
	private String email;

	@Column(name = "password")
	private String password;

	@JsonProperty
	@Enumerated(EnumType.STRING)
	private Role roles = Role.USER;

	public Long getUserId() { return userId; }
	public void setUserId(Long userId) { this.userId = userId; }

	public String getFirstName() { return firstName; }
	public void setFirstName(String firstName) { this.firstName = firstName; }

	public String getLastName() { return lastName; }
	public void setLastName(String lastName) { this.lastName = lastName; }

	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = email; }

	@JsonIgnore
	public String getPassword() { return password; }
	@JsonProperty
	public void setPassword(String password) { this.password = password; }

	public Role getRoles() { return roles; }
	public void setRoles(Role roles) { this.roles = roles; }
}
