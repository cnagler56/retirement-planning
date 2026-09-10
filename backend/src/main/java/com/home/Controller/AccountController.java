package com.home.Controller;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.Account;
import com.home.Domain.User;
import com.home.Repository.AccountRepository;
import com.home.Repository.UserRepository;
import com.home.Service.SessionService;

/**
 * Accounts and their balances. Endpoints accept either the browser session cookie
 * or a personal API key (X-Api-Key header) so a script or CSV import can keep
 * balances current. Balances roll up by type into the plan's pre-tax / Roth /
 * taxable buckets.
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class AccountController {

	private final AccountRepository repo;
	private final UserRepository userRepo;
	private final SessionService sessionService;
	private final SecureRandom random = new SecureRandom();

	public AccountController(AccountRepository repo, UserRepository userRepo, SessionService sessionService) {
		this.repo = repo;
		this.userRepo = userRepo;
		this.sessionService = sessionService;
	}

	@GetMapping("/api/accounts")
	public List<Account> list(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey) {
		return repo.findByUserIdOrderByIdAsc(requireUser(token, apiKey).getUserId());
	}

	@PostMapping("/api/accounts")
	public Account create(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey, @RequestBody Account body) {
		User user = requireUser(token, apiKey);
		body.setId(null);
		body.setUserId(user.getUserId());
		return repo.save(body);
	}

	@PutMapping("/api/accounts/{id}")
	public Account update(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey,
			@PathVariable Long id, @RequestBody Account body) {
		User user = requireUser(token, apiKey);
		Account a = owned(id, user);
		a.setName(body.getName());
		a.setType(body.getType());
		a.setBalance(body.getBalance());
		a.setAsOfDate(body.getAsOfDate());
		return repo.save(a);
	}

	@DeleteMapping("/api/accounts/{id}")
	public ResponseEntity<Void> delete(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey, @PathVariable Long id) {
		repo.delete(owned(id, requireUser(token, apiKey)));
		return ResponseEntity.noContent().build();
	}

	/** Upsert a list of accounts by name — the entry point for scripts / CSV import. */
	@PostMapping("/api/accounts/bulk")
	public List<Account> bulk(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey, @RequestBody List<Account> body) {
		User user = requireUser(token, apiKey);
		for (Account incoming : body) {
			Account a = repo.findByUserIdAndName(user.getUserId(), incoming.getName()).orElseGet(Account::new);
			a.setUserId(user.getUserId());
			a.setName(incoming.getName());
			a.setType(incoming.getType());
			a.setBalance(incoming.getBalance());
			a.setAsOfDate(incoming.getAsOfDate());
			repo.save(a);
		}
		return repo.findByUserIdOrderByIdAsc(user.getUserId());
	}

	/** Balances rolled up by type, for pulling into the plan. */
	@GetMapping("/api/accounts/summary")
	public Map<String, Double> summary(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestHeader(name = "X-Api-Key", required = false) String apiKey) {
		double trad = 0, roth = 0, taxable = 0, other = 0;
		for (Account a : repo.findByUserIdOrderByIdAsc(requireUser(token, apiKey).getUserId())) {
			String t = a.getType() == null ? "" : a.getType().toUpperCase();
			switch (t) {
				case "TRADITIONAL" -> trad += a.getBalance();
				case "ROTH" -> roth += a.getBalance();
				case "TAXABLE" -> taxable += a.getBalance();
				default -> other += a.getBalance();
			}
		}
		return Map.of("traditional", trad, "roth", roth, "taxable", taxable, "other", other,
			"total", trad + roth + taxable + other);
	}

	/** Generate (or rotate) the caller's personal API key. Session auth only. */
	@PostMapping("/api/accounts/token")
	public Map<String, String> generateToken(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		User user = sessionService.findUserByToken(token)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in required"));
		byte[] bytes = new byte[24];
		random.nextBytes(bytes);
		String key = "rpk_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		user.setApiToken(key);
		userRepo.save(user);
		return Map.of("apiKey", key);
	}

	private Account owned(Long id, User user) {
		Account a = repo.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
		if (!a.getUserId().equals(user.getUserId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your account");
		}
		return a;
	}

	/** Resolve the caller from the session cookie, or failing that a personal API key. */
	private User requireUser(String token, String apiKey) {
		return sessionService.findUserByToken(token)
			.or(() -> apiKey != null && !apiKey.isBlank() ? userRepo.findByApiToken(apiKey.trim()) : java.util.Optional.empty())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in or provide a valid API key"));
	}
}
