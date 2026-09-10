package com.home.Service;

import org.springframework.stereotype.Service;

import com.home.Domain.MedicareEstimateRequest;
import com.home.Domain.MedicareEstimateResult;
import com.home.tax.IrmaaTable;
import com.home.tax.TaxConstants.Filing;

/**
 * Estimates annual household Medicare cost from its components so the plan's
 * healthcare-cost input reflects real coverage choices rather than a guess:
 * the standard Part B premium, a Medigap or Medicare Advantage premium, a Part D
 * premium, expected out-of-pocket spending, and the income-based IRMAA surcharge
 * (reused from {@link IrmaaTable}).
 *
 * Approximate 2025 figures; premiums vary by plan and region.
 */
@Service
public class MedicareService {

	/** Standard Part B premium (2025), monthly. */
	private static final double PART_B_STANDARD_MONTHLY = 185.0;

	public MedicareEstimateResult estimate(MedicareEstimateRequest req) {
		Filing filing = "SINGLE".equalsIgnoreCase(req.filingStatus()) ? Filing.SINGLE : Filing.MARRIED_JOINT;
		int people = req.peopleOnMedicare() != null
			? Math.max(1, Math.min(2, req.peopleOnMedicare()))
			: (filing == Filing.MARRIED_JOINT ? 2 : 1);
		double magi = nn(req.magi());
		double supMonthly = nn(req.supplementMonthly());
		double partDMonthly = nn(req.partDMonthly());
		double oop = nn(req.outOfPocketAnnual());

		double partB = PART_B_STANDARD_MONTHLY * 12 * people;
		double supplement = supMonthly * 12 * people;
		double partD = partDMonthly * 12 * people;
		double outOfPocket = oop * people;
		double irmaa = IrmaaTable.surcharge(filing, magi, people, 1.0);

		double total = partB + supplement + partD + outOfPocket + irmaa;

		return new MedicareEstimateResult(
			round(partB), round(supplement), round(partD), round(outOfPocket),
			round(irmaa), round(total), people
		);
	}

	private static double nn(Double v) {
		return v != null && v > 0 ? v : 0;
	}

	private static double round(double v) {
		return Math.round(v);
	}
}
