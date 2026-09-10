package com.home.Controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.home.Domain.MedicareEstimateRequest;
import com.home.Domain.MedicareEstimateResult;
import com.home.Service.MedicareService;

/** Medicare annual cost estimator. Pure calculation, no login required. */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class MedicareController {

	private final MedicareService service;

	public MedicareController(MedicareService service) {
		this.service = service;
	}

	@PostMapping("/api/medicare/estimate")
	public MedicareEstimateResult estimate(@RequestBody MedicareEstimateRequest request) {
		return service.estimate(request);
	}
}
