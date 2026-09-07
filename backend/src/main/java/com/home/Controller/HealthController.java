package com.home.Controller;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Liveness probe — used by the frontend banner and by container health checks. */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class HealthController {

	@GetMapping("/api/health")
	public Map<String, Object> health() {
		return Map.of(
			"status", "ok",
			"service", "retire-server",
			"time", Instant.now().toString()
		);
	}
}
