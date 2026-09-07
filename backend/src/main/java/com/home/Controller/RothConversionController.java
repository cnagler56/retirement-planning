package com.home.Controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.home.Domain.ConversionTaxRequest;
import com.home.Domain.ConversionTaxResult;
import com.home.Domain.LifetimeRothRequest;
import com.home.Domain.LifetimeRothResult;
import com.home.Domain.RothConversionRequest;
import com.home.Domain.RothConversionResult;
import com.home.Service.ConversionTaxService;
import com.home.Service.LifetimeRothService;
import com.home.Service.RothConversionService;

/**
 * Roth conversion analyzer. Pure calculation on posted inputs — no persistence,
 * no login required (like the projection preview and SS breakeven).
 */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class RothConversionController {

	private final RothConversionService service;
	private final ConversionTaxService taxCost;
	private final LifetimeRothService lifetime;

	public RothConversionController(RothConversionService service, ConversionTaxService taxCost,
			LifetimeRothService lifetime) {
		this.service = service;
		this.taxCost = taxCost;
		this.lifetime = lifetime;
	}

	/** Long-horizon after-tax wealth comparison (simple two-rate model). */
	@PostMapping("/api/roth/analyze")
	public RothConversionResult analyze(@RequestBody RothConversionRequest request) {
		return service.analyze(request);
	}

	/** The true current-year tax cost of a conversion, from the federal tax engine. */
	@PostMapping("/api/roth/tax-cost")
	public ConversionTaxResult taxCost(@RequestBody ConversionTaxRequest request) {
		return taxCost.analyze(request);
	}

	/** Multi-year lifetime comparison: no conversions vs. a bracket-filling strategy. */
	@PostMapping("/api/roth/lifetime")
	public LifetimeRothResult lifetime(@RequestBody LifetimeRothRequest request) {
		return lifetime.analyze(request);
	}
}
