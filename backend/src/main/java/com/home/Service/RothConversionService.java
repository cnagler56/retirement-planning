package com.home.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.home.Domain.RothConversionRequest;
import com.home.Domain.RothConversionResult;
import com.home.Domain.RothConversionResult.Point;

/**
 * Roth conversion analyzer: compares the after-tax value of converting Traditional
 * dollars to Roth now versus leaving them to grow tax-deferred, on equal footing.
 *
 * Two ways to pay the conversion tax:
 *  - CONVERSION: the tax is withheld from the amount, so only (amount × (1 − rate))
 *    lands in the Roth. Then converting wins exactly when your future tax rate
 *    exceeds today's — the classic rate comparison.
 *  - OUTSIDE: the tax is paid from taxable savings, so the full amount grows
 *    tax-free in the Roth. The fair comparison keeps that same tax cash invested
 *    in a taxable account (growing at an after-tax, drag-reduced rate) under the
 *    "don't convert" case. Sheltering money out of that drag is why paying from
 *    outside can win even when future and current rates are equal.
 *
 * A deterministic estimate. Ignores RMDs (which conversions also reduce), IRMAA,
 * state taxes, the 5-year rule, and bracket changes. Not tax advice.
 */
@Service
public class RothConversionService {

	public RothConversionResult analyze(RothConversionRequest req) {
		double amount = positive(req.conversionAmount(), 100_000);
		double curRate = rate(req.currentMarginalRate(), 0.22);
		double retRate = rate(req.retirementMarginalRate(), 0.24);
		double r = rate(req.annualReturn(), 0.06);
		int years = req.years() != null && req.years() > 0 ? Math.min(req.years(), 60) : 20;
		boolean fromOutside = !"CONVERSION".equalsIgnoreCase(req.taxPaidFrom());
		double drag = rate(req.taxableDragRate(), 0.15);
		double rTaxable = r * (1 - drag);

		double conversionTax = amount * curRate;
		// What lands in the Roth: the full amount if tax is paid separately,
		// otherwise the amount net of the tax withheld from it.
		double rothStart = fromOutside ? amount : amount * (1 - curRate);

		List<Point> points = new ArrayList<>(years + 1);
		for (int t = 0; t <= years; t++) {
			double grow = Math.pow(1 + r, t);
			double convert = rothStart * grow; // Roth is tax-free at withdrawal
			double noConvert;
			if (fromOutside) {
				// Traditional taxed at retirement + the tax cash kept in taxable.
				noConvert = amount * grow * (1 - retRate)
					+ conversionTax * Math.pow(1 + rTaxable, t);
			} else {
				noConvert = amount * grow * (1 - retRate);
			}
			points.add(new Point(t, round(convert), round(noConvert)));
		}

		double convertEnd = points.get(years).convert();
		double noConvertEnd = points.get(years).noConvert();

		// Break-even retirement rate: the future rate at which the strategies tie.
		double breakevenRetRate;
		if (fromOutside) {
			// amount·(1+r)^N = amount·(1+r)^N·(1−ret) + tax·(1+rTaxable)^N
			// ⇒ ret = curRate · ((1+rTaxable)/(1+r))^N
			breakevenRetRate = curRate * Math.pow((1 + rTaxable) / (1 + r), years);
		} else {
			breakevenRetRate = curRate; // pure rate comparison
		}

		return new RothConversionResult(
			round(conversionTax),
			round(rothStart),
			round(convertEnd),
			round(noConvertEnd),
			round(convertEnd - noConvertEnd),
			convertEnd > noConvertEnd,
			breakevenRetRate,
			fromOutside ? "OUTSIDE" : "CONVERSION",
			years,
			points
		);
	}

	private static double positive(Double v, double fallback) {
		return v != null && v > 0 ? v : fallback;
	}

	private static double rate(Double v, double fallback) {
		if (v == null) return fallback;
		if (v < 0) return 0;
		if (v > 1) return 1;
		return v;
	}

	private static double round(double v) {
		return Math.round(v);
	}
}
