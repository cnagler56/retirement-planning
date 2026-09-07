package com.home.Controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.ProjectionResult;
import com.home.Domain.RetirementProfile;
import com.home.Domain.User;
import com.home.Repository.RetirementProfileRepository;
import com.home.Service.ProjectionService;
import com.home.Service.SessionService;

/**
 * Retirement profile + projection.
 *
 * - GET  /api/profile     the signed-in user's saved profile (or 204 if none yet)
 * - PUT  /api/profile     upsert the signed-in user's profile, returns it
 * - POST /api/projection  compute a projection from posted inputs WITHOUT saving
 *                         (drives the live "what-if" preview; no login required)
 * - GET  /api/projection  compute from the signed-in user's SAVED profile
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class RetirementProfileController {

	private final RetirementProfileRepository repo;
	private final ProjectionService projectionService;
	private final SessionService sessionService;

	public RetirementProfileController(RetirementProfileRepository repo,
			ProjectionService projectionService, SessionService sessionService) {
		this.repo = repo;
		this.projectionService = projectionService;
		this.sessionService = sessionService;
	}

	@GetMapping("/api/profile")
	public ResponseEntity<RetirementProfile> getProfile(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		User user = requireUser(token);
		return repo.findByUserId(user.getUserId())
			.map(ResponseEntity::ok)
			.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@PutMapping("/api/profile")
	public RetirementProfile saveProfile(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token,
			@RequestBody RetirementProfile body) {
		User user = requireUser(token);
		RetirementProfile profile = repo.findByUserId(user.getUserId()).orElseGet(RetirementProfile::new);
		profile.setUserId(user.getUserId());
		profile.setCurrentAge(body.getCurrentAge());
		profile.setRetirementAge(body.getRetirementAge());
		profile.setCurrentSavings(body.getCurrentSavings());
		profile.setMonthlyContribution(body.getMonthlyContribution());
		profile.setAnnualReturnRate(body.getAnnualReturnRate());
		profile.setInflationRate(body.getInflationRate());
		profile.setDesiredAnnualIncome(body.getDesiredAnnualIncome());
		profile.setSsMonthlyAtFra(body.getSsMonthlyAtFra());
		profile.setSsClaimAge(body.getSsClaimAge());
		profile.setPlanThroughAge(body.getPlanThroughAge());
		return repo.save(profile);
	}

	/** Pure calculation on posted inputs — no persistence, no auth needed. */
	@PostMapping("/api/projection")
	public ProjectionResult preview(@RequestBody RetirementProfile body) {
		return projectionService.compute(body);
	}

	/** Projection from the signed-in user's saved profile. */
	@GetMapping("/api/projection")
	public ProjectionResult savedProjection(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		User user = requireUser(token);
		RetirementProfile profile = repo.findByUserId(user.getUserId())
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No saved profile yet"));
		return projectionService.compute(profile);
	}

	private User requireUser(String token) {
		return sessionService.findUserByToken(token)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in required"));
	}
}
