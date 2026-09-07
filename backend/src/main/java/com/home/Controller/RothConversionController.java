package com.home.Controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.home.Domain.RothConversionRequest;
import com.home.Domain.RothConversionResult;
import com.home.Service.RothConversionService;

/**
 * Roth conversion analyzer. Pure calculation on posted inputs — no persistence,
 * no login required (like the projection preview and SS breakeven).
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class RothConversionController {

	private final RothConversionService service;

	public RothConversionController(RothConversionService service) {
		this.service = service;
	}

	@PostMapping("/api/roth/analyze")
	public RothConversionResult analyze(@RequestBody RothConversionRequest request) {
		return service.analyze(request);
	}
}
