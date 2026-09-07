package com.home.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.ConversionTaxRequest;
import com.home.Domain.ConversionTaxResult;
import com.home.Domain.ConversionTaxResult.RatePoint;
import com.home.tax.FederalTaxService;
import com.home.tax.FederalTaxService.FederalTax;
import com.home.tax.TaxConstants.Filing;

/**
 * Computes the real tax cost of a Roth conversion by running the household's
 * return through {@link FederalTaxService} with and without the conversion. The
 * difference is the true tax — capturing extra Social Security taxation, bracket
 * crossings, and capital-gains spillover that a flat "marginal rate" input misses.
 */
@Service
public class ConversionTaxService {

	private static final int CURVE_STEPS = 60;

	private final FederalTaxService tax;

	public ConversionTaxService(FederalTaxService tax) {
		this.tax = tax;
	}

	public ConversionTaxResult analyze(ConversionTaxRequest req) {
		Filing filing = "SINGLE".equalsIgnoreCase(req.filingStatus()) ? Filing.SINGLE : Filing.MARRIED_JOINT;
		int over65 = filersOver65(filing, req.age(), req.spouseAge());
		double ss = nn(req.annualSocialSecurity());
		double other = nn(req.otherOrdinaryIncome());
		double qualified = nn(req.qualifiedIncome());
		double amount = Math.max(0, nn(req.conversionAmount()));

		FederalTax before = tax.compute(filing, over65, other, ss, qualified);
		FederalTax after = tax.compute(filing, over65, other + amount, ss, qualified);

		double conversionTax = after.totalTax() - before.totalTax();
		double effectiveRate = amount > 0 ? conversionTax / amount : 0;

		// Marginal-rate curve: the rate on each successive slice of conversion.
		List<RatePoint> points = new ArrayList<>();
		double step = amount > 0 ? amount / CURVE_STEPS : 0;
		double prevTax = before.totalTax();
		points.add(new RatePoint(0, before.marginalOrdinaryRate(), 0));
		for (int i = 1; i <= CURVE_STEPS && step > 0; i++) {
			double convHere = step * i;
			double taxHere = tax.compute(filing, over65, other + convHere, ss, qualified).totalTax();
			double marginal = (taxHere - prevTax) / step;
			double cumulative = (taxHere - before.totalTax()) / convHere;
			points.add(new RatePoint(round(convHere), round4(marginal), round4(cumulative)));
			prevTax = taxHere;
		}

		return new ConversionTaxResult(
			round(amount),
			round(before.totalTax()),
			round(after.totalTax()),
			round(conversionTax),
			round4(effectiveRate),
			after.marginalOrdinaryRate(),
			round(before.taxableSocialSecurity()),
			round(after.taxableSocialSecurity()),
			round(after.taxableSocialSecurity() - before.taxableSocialSecurity()),
			round(before.agi()),
			round(after.agi()),
			points
		);
	}

	private int filersOver65(Filing filing, Integer age, Integer spouseAge) {
		int count = age != null && age >= 65 ? 1 : 0;
		if (filing == Filing.MARRIED_JOINT && spouseAge != null && spouseAge >= 65) count++;
		return count;
	}

	private static double nn(Double v) {
		return v != null && v > 0 ? v : 0;
	}

	private static double round(double v) {
		return Math.round(v);
	}

	private static double round4(double v) {
		return Math.round(v * 10000.0) / 10000.0;
	}
}
