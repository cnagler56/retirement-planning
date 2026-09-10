package com.home.Controller;

import java.util.List;

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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.Scenario;
import com.home.Domain.User;
import com.home.Repository.ScenarioRepository;
import com.home.Service.SessionService;

/** Named saved plan variations for the scenario comparison. All endpoints require login. */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class ScenarioController {

	private final ScenarioRepository repo;
	private final SessionService sessionService;

	public ScenarioController(ScenarioRepository repo, SessionService sessionService) {
		this.repo = repo;
		this.sessionService = sessionService;
	}

	@GetMapping("/api/scenarios")
	public List<Scenario> list(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		return repo.findByUserIdOrderByIdAsc(requireUser(token).getUserId());
	}

	@PostMapping("/api/scenarios")
	public Scenario create(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestBody Scenario body) {
		User user = requireUser(token);
		Scenario s = new Scenario();
		s.setUserId(user.getUserId());
		s.setName(body.getName());
		s.setInputsJson(body.getInputsJson());
		return repo.save(s);
	}

	@PutMapping("/api/scenarios/{id}")
	public Scenario update(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@PathVariable Long id, @RequestBody Scenario body) {
		User user = requireUser(token);
		Scenario s = owned(id, user);
		s.setName(body.getName());
		s.setInputsJson(body.getInputsJson());
		return repo.save(s);
	}

	@DeleteMapping("/api/scenarios/{id}")
	public ResponseEntity<Void> delete(@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@PathVariable Long id) {
		User user = requireUser(token);
		repo.delete(owned(id, user));
		return ResponseEntity.noContent().build();
	}

	private Scenario owned(Long id, User user) {
		Scenario s = repo.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Scenario not found"));
		if (!s.getUserId().equals(user.getUserId())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your scenario");
		}
		return s;
	}

	private User requireUser(String token) {
		return sessionService.findUserByToken(token)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in required"));
	}
}
