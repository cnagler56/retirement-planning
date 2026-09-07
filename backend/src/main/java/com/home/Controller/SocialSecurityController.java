package com.home.Controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.home.Domain.SsBreakevenRequest;
import com.home.Domain.SsBreakevenResult;
import com.home.Service.SocialSecurityService;

/**
 * Social Security claiming breakeven calculator. Pure calculation on posted
 * inputs — no persistence, no login required (like the projection preview).
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class SocialSecurityController {

	private final SocialSecurityService service;

	public SocialSecurityController(SocialSecurityService service) {
		this.service = service;
	}

	@PostMapping("/api/social-security/breakeven")
	public SsBreakevenResult breakeven(@RequestBody SsBreakevenRequest request) {
		return service.breakeven(request);
	}
}
