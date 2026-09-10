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

/** Annual Social Security to assume in the tax models (benefit at FRA × 12). */
function annualSs(p: RetirementProfile): number {
  return Math.round((p.ssMonthlyAtFra || 0) * 12);
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

/** Today's-dollars income from streams active at a given age. */
function streamIncomeAt(p: RetirementProfile, age: number): number {
  return (p.incomeStreams || []).reduce((sum, s) => {
    const end = s.endAge > 0 ? s.endAge : Infinity;
    if (!s.annualAmount || age < s.startAge || age > end) return sum;
    const real = s.inflationAdjusted
      ? s.annualAmount
      : s.annualAmount / Math.pow(1 + p.inflationRate, Math.max(0, age - p.currentAge));
    return sum + real;
  }, 0);
}

export function conversionTaxDefaults(p: RetirementProfile | null): ConversionTaxRequest {
  if (!p) return DEFAULT_CONVERSION_TAX;
  return {
    ...DEFAULT_CONVERSION_TAX,
    filingStatus: p.filingStatus || DEFAULT_CONVERSION_TAX.filingStatus,
    age: p.currentAge || DEFAULT_CONVERSION_TAX.age,
    spouseAge: p.spouseAge || p.currentAge || DEFAULT_CONVERSION_TAX.spouseAge,
    annualSocialSecurity: annualSs(p),
    otherOrdinaryIncome: Math.round((p.annualPension || 0) + streamIncomeAt(p, p.currentAge)),
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
