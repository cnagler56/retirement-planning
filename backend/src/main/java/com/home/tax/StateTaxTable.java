package com.home.tax;

import java.util.List;

/**
 * Approximate top marginal state income-tax rates (2024), used only as a default
 * the user can override. Nine states levy no income tax (rate 0). Real state
 * taxation of retirement income varies a lot — many states exempt Social
 * Security and part of pension/IRA income — so treat these as a starting point,
 * not an exact figure.
 */
public final class StateTaxTable {

	private StateTaxTable() {}

	public record State(String code, String name, double rate) {}

	private static final List<State> STATES = List.of(
		new State("AL", "Alabama", 0.05),
		new State("AK", "Alaska", 0.0),
		new State("AZ", "Arizona", 0.025),
		new State("AR", "Arkansas", 0.044),
		new State("CA", "California", 0.133),
		new State("CO", "Colorado", 0.044),
		new State("CT", "Connecticut", 0.0699),
		new State("DE", "Delaware", 0.066),
		new State("DC", "District of Columbia", 0.1075),
		new State("FL", "Florida", 0.0),
		new State("GA", "Georgia", 0.0549),
		new State("HI", "Hawaii", 0.11),
		new State("ID", "Idaho", 0.058),
		new State("IL", "Illinois", 0.0495),
		new State("IN", "Indiana", 0.0305),
		new State("IA", "Iowa", 0.057),
		new State("KS", "Kansas", 0.057),
		new State("KY", "Kentucky", 0.04),
		new State("LA", "Louisiana", 0.0425),
		new State("ME", "Maine", 0.0715),
		new State("MD", "Maryland", 0.0575),
		new State("MA", "Massachusetts", 0.05),
		new State("MI", "Michigan", 0.0425),
		new State("MN", "Minnesota", 0.0985),
		new State("MS", "Mississippi", 0.047),
		new State("MO", "Missouri", 0.048),
		new State("MT", "Montana", 0.059),
		new State("NE", "Nebraska", 0.0584),
		new State("NV", "Nevada", 0.0),
		new State("NH", "New Hampshire", 0.0),
		new State("NJ", "New Jersey", 0.1075),
		new State("NM", "New Mexico", 0.059),
		new State("NY", "New York", 0.109),
		new State("NC", "North Carolina", 0.045),
		new State("ND", "North Dakota", 0.025),
		new State("OH", "Ohio", 0.035),
		new State("OK", "Oklahoma", 0.0475),
		new State("OR", "Oregon", 0.099),
		new State("PA", "Pennsylvania", 0.0307),
		new State("RI", "Rhode Island", 0.0599),
		new State("SC", "South Carolina", 0.064),
		new State("SD", "South Dakota", 0.0),
		new State("TN", "Tennessee", 0.0),
		new State("TX", "Texas", 0.0),
		new State("UT", "Utah", 0.0455),
		new State("VT", "Vermont", 0.0875),
		new State("VA", "Virginia", 0.0575),
		new State("WA", "Washington", 0.0),
		new State("WV", "West Virginia", 0.0512),
		new State("WI", "Wisconsin", 0.0765),
		new State("WY", "Wyoming", 0.0)
	);

	public static List<State> all() {
		return STATES;
	}

	/** Default rate for a state code (0 if unknown / no income tax). */
	public static double rateFor(String code) {
		if (code == null) return 0;
		return STATES.stream()
			.filter(s -> s.code().equalsIgnoreCase(code))
			.map(State::rate)
			.findFirst()
			.orElse(0.0);
	}
}
