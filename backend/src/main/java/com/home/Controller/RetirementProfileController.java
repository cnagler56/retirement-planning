package com.home.Controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.home.Domain.GoalSeekRequest;
import com.home.Domain.GoalSeekResult;
import com.home.Domain.LedgerResult;
import com.home.Domain.Loan;
import com.home.Domain.LoanAmortization;
import com.home.Domain.MonteCarloRequest;
import com.home.Domain.MonteCarloResult;
import com.home.Domain.ProjectionResult;
import com.home.Domain.RetirementProfile;
import com.home.Domain.User;
import com.home.Repository.RetirementProfileRepository;
import com.home.Service.GoalSeekService;
import com.home.Service.LedgerService;
import com.home.Service.MonteCarloService;
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
	private final MonteCarloService monteCarloService;
	private final GoalSeekService goalSeekService;
	private final LedgerService ledgerService;
	private final SessionService sessionService;

	public RetirementProfileController(RetirementProfileRepository repo,
			ProjectionService projectionService, MonteCarloService monteCarloService,
			GoalSeekService goalSeekService, LedgerService ledgerService, SessionService sessionService) {
		this.repo = repo;
		this.projectionService = projectionService;
		this.monteCarloService = monteCarloService;
		this.goalSeekService = goalSeekService;
		this.ledgerService = ledgerService;
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
		profile.setBirthDate(body.getBirthDate());
		profile.setSpouseBirthDate(body.getSpouseBirthDate());
		profile.setRetirementAge(body.getRetirementAge());
		profile.setCurrentSavings(body.getCurrentSavings());
		profile.setMonthlyContribution(body.getMonthlyContribution());
		profile.setAnnualReturnRate(body.getAnnualReturnRate());
		profile.setInflationRate(body.getInflationRate());
		profile.setDesiredAnnualIncome(body.getDesiredAnnualIncome());
		profile.setSsMonthlyAtFra(body.getSsMonthlyAtFra());
		profile.setSsClaimAge(body.getSsClaimAge());
		profile.setSpouseSsMonthlyAtFra(body.getSpouseSsMonthlyAtFra());
		profile.setSpouseSsClaimAge(body.getSpouseSsClaimAge());
		profile.setPlanThroughAge(body.getPlanThroughAge());
		profile.setFilingStatus(body.getFilingStatus());
		profile.setTradBalance(body.getTradBalance());
		profile.setRothBalance(body.getRothBalance());
		profile.setTaxableBalance(body.getTaxableBalance());
		profile.setAnnualPension(body.getAnnualPension());
		profile.setAnnualHealthcareCost(body.getAnnualHealthcareCost());
		profile.setHealthcareInflationRate(body.getHealthcareInflationRate());
		profile.setLtcEnabled(body.isLtcEnabled());
		profile.setLtcAnnualCost(body.getLtcAnnualCost());
		profile.setLtcStartAge(body.getLtcStartAge());
		profile.setLtcYears(body.getLtcYears());
		profile.setState(body.getState());
		profile.setStateTaxRate(body.getStateTaxRate());
		profile.setIncomeStreams(body.getIncomeStreams());
		profile.setExpenses(body.getExpenses());
		profile.setLoans(body.getLoans());
		profile.setAssets(body.getAssets());
		return repo.save(profile);
	}

	/** Remove the user's server-side profile — used when they switch to device-only storage. */
	@DeleteMapping("/api/profile")
	public ResponseEntity<Void> deleteProfile(
			@CookieValue(name = SessionService.COOKIE_NAME, required = false) String token) {
		User user = requireUser(token);
		repo.findByUserId(user.getUserId()).ifPresent(repo::delete);
		return ResponseEntity.noContent().build();
	}

	/** Pure calculation on posted inputs — no persistence, no auth needed. */
	@PostMapping("/api/projection")
	public ProjectionResult preview(@RequestBody RetirementProfile body) {
		return projectionService.compute(body);
	}

	/** Monte Carlo run of a plan — probability of success and percentile bands. */
	@PostMapping("/api/projection/montecarlo")
	public MonteCarloResult monteCarlo(@RequestBody MonteCarloRequest body) {
		return monteCarloService.run(body);
	}

	/** Goal-seek: what change to each lever reaches a target success rate. */
	@PostMapping("/api/projection/goalseek")
	public GoalSeekResult goalSeek(@RequestBody GoalSeekRequest body) {
		return goalSeekService.solve(body);
	}

	/** Full year-by-year cash-flow ledger from retirement age to the horizon. */
	@PostMapping("/api/projection/ledger")
	public LedgerResult ledger(@RequestBody RetirementProfile body) {
		return ledgerService.compute(body);
	}

	/**
	 * Month-by-month amortization schedule + payoff summary for each loan on the
	 * posted profile. No persistence, so the Loans page can recompute live as the
	 * user edits payments, extras, or a refinance before saving.
	 */
	@PostMapping("/api/loans/amortization")
	public java.util.List<LoanAmortization> loanAmortization(@RequestBody RetirementProfile body) {
		int currentAge = Math.max(0, body.getCurrentAge());
		int horizon = Math.max(body.getPlanThroughAge(), currentAge + 50); // long enough to show full payoff
		java.util.List<LoanAmortization> out = new java.util.ArrayList<>();
		if (body.getLoans() != null) {
			for (Loan loan : body.getLoans()) out.add(com.home.tax.LoanSchedule.amortize(loan, currentAge, horizon));
		}
		return out;
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
