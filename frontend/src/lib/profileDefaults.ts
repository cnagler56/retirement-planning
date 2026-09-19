/**
 * Maps the one saved household profile into each calculator's input shape, so
 * the calculators default to what the user entered at signup instead of asking
 * for ages and shared facts again. When there's no saved profile (logged out or
 * not yet onboarded), each falls back to its own static default.
 */
import {
  birthYearFrom,
  DEFAULT_CONVERSION_TAX,
  DEFAULT_LIFETIME_ROTH,
  DEFAULT_SS,
  type ConversionTaxRequest,
  type LifetimeRothRequest,
  type RetirementProfile,
  type SsBreakevenRequest,
} from './api';

/** Annual household Social Security for the tax models (both spouses' FRA × 12). */
function annualSs(p: RetirementProfile): number {
  const spouse = p.filingStatus === 'MARRIED_JOINT' ? (p.spouseSsMonthlyAtFra || 0) : 0;
  return Math.round(((p.ssMonthlyAtFra || 0) + spouse) * 12);
}

export function ssDefaults(p: RetirementProfile | null): SsBreakevenRequest {
  if (!p) return DEFAULT_SS;
  return {
    ...DEFAULT_SS,
    birthYear: birthYearFrom(p.birthDate) || new Date().getFullYear() - p.currentAge,
    monthlyAtFra: p.ssMonthlyAtFra || DEFAULT_SS.monthlyAtFra,
    lateAge: p.ssClaimAge || DEFAULT_SS.lateAge,
    inflationRate: p.inflationRate,
    colaRate: p.inflationRate,
    investmentReturn: p.annualReturnRate,
  };
}

export function conversionTaxDefaults(p: RetirementProfile | null): ConversionTaxRequest {
  if (!p) return DEFAULT_CONVERSION_TAX;
  // A Roth conversion is a retirement move — most valuable in low-income years after
  // you stop working but before Social Security and RMDs. So default the scenario to
  // the first retirement year (or the current year if already retired), not a
  // still-working year with high wages.
  const scenarioAge = p.currentAge >= p.retirementAge ? p.currentAge : p.retirementAge;
  const married = p.filingStatus === 'MARRIED_JOINT';
  const spouseOffset = married && p.spouseAge > 0 ? p.spouseAge - p.currentAge : 0;
  const claiming = p.ssClaimAge > 0 && scenarioAge >= p.ssClaimAge;
  return {
    ...DEFAULT_CONVERSION_TAX,
    filingStatus: p.filingStatus || DEFAULT_CONVERSION_TAX.filingStatus,
    age: scenarioAge || DEFAULT_CONVERSION_TAX.age,
    spouseAge: (scenarioAge + spouseOffset) || DEFAULT_CONVERSION_TAX.spouseAge,
    // Social Security only counts once you're claiming it; 0 in the gap years.
    annualSocialSecurity: claiming ? annualSs(p) : 0,
    // Just the pension by default — a reliable retirement income. Wages, rental, and
    // existing RMDs vary by the year you're modeling, so you add those yourself.
    otherOrdinaryIncome: Math.round(p.annualPension || 0),
  };
}

export function lifetimeDefaults(p: RetirementProfile | null): LifetimeRothRequest {
  if (!p) return DEFAULT_LIFETIME_ROTH;
  return {
    ...DEFAULT_LIFETIME_ROTH,
    filingStatus: p.filingStatus || DEFAULT_LIFETIME_ROTH.filingStatus,
    currentAge: p.currentAge || DEFAULT_LIFETIME_ROTH.currentAge,
    spouseAge: p.spouseAge || p.currentAge || DEFAULT_LIFETIME_ROTH.spouseAge,
    planThroughAge: p.planThroughAge || DEFAULT_LIFETIME_ROTH.planThroughAge,
    tradBalance: p.tradBalance || 0,
    rothBalance: p.rothBalance || 0,
    taxableBalance: p.taxableBalance || 0,
    annualPension: p.annualPension || 0,
    annualSocialSecurity: annualSs(p),
    ssClaimAge: p.ssClaimAge || DEFAULT_LIFETIME_ROTH.ssClaimAge,
    investmentReturn: p.annualReturnRate || DEFAULT_LIFETIME_ROTH.investmentReturn,
    inflationRate: p.inflationRate || DEFAULT_LIFETIME_ROTH.inflationRate,
    stateTaxRate: p.stateTaxRate || 0,
    // Default the conversion window to the gap years: retirement → RMD age.
    convStartAge: p.retirementAge || DEFAULT_LIFETIME_ROTH.convStartAge,
    convEndAge: (birthYearFrom(p.birthDate) || new Date().getFullYear() - p.currentAge) >= 1960 ? 74 : 72,
    incomeStreams: p.incomeStreams || [],
  };
}
