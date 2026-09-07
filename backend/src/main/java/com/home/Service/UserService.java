package com.home.Service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.LoginDTO;
import com.home.Domain.Role;
import com.home.Domain.User;
import com.home.Repository.UserRepository;

/**
 * Account creation and credential verification. Passwords are BCrypt-hashed on
 * the way in and only ever compared via {@link PasswordEncoder#matches}.
 */
@Service
public class UserService {

	private final UserRepository userRepo;
	private final PasswordEncoder passwordEncoder;

	public UserService(UserRepository userRepo, PasswordEncoder passwordEncoder) {
		this.userRepo = userRepo;
		this.passwordEncoder = passwordEncoder;
	}

	/** Create a new USER account. 409 if the email is already taken. */
	public User register(LoginDTO request) {
		if (request.getEmail() == null || request.getEmail().isBlank()
				|| request.getPassword() == null || request.getPassword().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password are required");
		}
		String email = request.getEmail().trim().toLowerCase();
		if (userRepo.existsByEmail(email)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with that email already exists");
		}

		User user = new User();
		user.setEmail(email);
		user.setFirstName(request.getFirstName());
		user.setLastName(request.getLastName());
		user.setPassword(passwordEncoder.encode(request.getPassword()));
		user.setRoles(Role.USER);
		return userRepo.save(user);
	}

	/** Verify credentials and return the User, or 401 on any mismatch. */
	public User authenticate(LoginDTO request) {
		String email = request.getEmail() == null ? "" : request.getEmail().trim().toLowerCase();
		User user = userRepo.findByEmail(email)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
		if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
		}
		return user;
	}
}
