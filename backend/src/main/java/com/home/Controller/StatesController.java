package com.home.Controller;

import java.util.List;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.home.tax.StateTaxTable;
import com.home.tax.StateTaxTable.State;

/** Reference data: US states with their default income-tax rate. No auth needed. */
@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class StatesController {

	@GetMapping("/api/states")
	public List<State> states() {
		return StateTaxTable.all();
	}
}
