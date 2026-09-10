const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8083';

export type UserRole = 'USER' | 'ADMIN';

export interface User {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  roles: UserRole;
}

export interface Health {
  status: string;
  service: string;
  time: string;
}

export interface Credentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export type AccountType = 'TRADITIONAL' | 'ROTH' | 'TAXABLE' | 'OTHER';

export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  balance: number;
  asOfDate: string | null;
}

export interface AccountSummary {
  traditional: number;
  roth: number;
  taxable: number;
  other: number;
  total: number;
}

/** A saved scenario row as stored on the server (inputs are a JSON string). */
export interface ScenarioRow {
  id: number;
  name: string;
  inputsJson: string;
}

/** A recurring income stream (pension, rental, annuity, inherited-land rent, …). */
export interface IncomeStream {
  label: string;
  annualAmount: number;
  startAge: number;
  /** 0 = for life (through the planning horizon). */
  endAge: number;
  /** true = keeps its real value; false = fixed nominal, erodes with inflation. */
  inflationAdjusted: boolean;
}

/** An itemized retirement expense (base living, travel, mortgage, one-off…). */
export interface ExpenseItem {
  label: string;
  annualAmount: number;
  startAge: number;
  endAge: number;
  inflationAdjusted: boolean;
}

export interface LedgerRow {
  age: number;
  startBalance: number;
  socialSecurity: number;
  pension: number;
  otherIncome: number;
  rmd: number;
  withdrawal: number;
  livingExpenses: number;
  healthcare: number;
  federalTax: number;
  stateTax: number;
  irmaa: number;
  taxableSs: number;
  endTrad: number;
  endRoth: number;
  endTaxable: number;
  endTotal: number;
  shortfall: boolean;
}

export interface LedgerResult {
  rows: LedgerRow[];
  moneyLastsToAge: number | null;
  realReturn: number;
  rmdStartAge: number;
}

/** Whole years between an ISO birth date (yyyy-mm-dd) and today. */
export function ageFromBirthDate(iso: string | null | undefined): number {
  if (!iso) return 0;
  const b = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return Math.max(0, age);
}

/** Four-digit birth year from an ISO birth date. */
export function birthYearFrom(iso: string | null | undefined): number {
  return iso && iso.length >= 4 ? Number(iso.slice(0, 4)) : 0;
}

/** Recompute the derived ages from the birth dates so they never go stale. */
export function withDerivedAges<T extends { birthDate?: string; spouseBirthDate?: string }>(
  p: T,
): T & { currentAge: number; spouseAge: number } {
  return {
    ...p,
    currentAge: ageFromBirthDate(p.birthDate),
    spouseAge: ageFromBirthDate(p.spouseBirthDate),
  };
}

/** Retirement planning inputs. Rates are decimals (0.07 = 7%). */
export interface RetirementProfile {
  id?: number;
  userId?: number;
  /** Birth date (yyyy-mm-dd) — the stored fact; ages are derived from it. */
  birthDate: string;
  spouseBirthDate: string;
  /** Derived from birthDate; kept fresh on load. Read-only in practice. */
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualReturnRate: number;
  inflationRate: number;
  desiredAnnualIncome: number;
  /** Expected Social Security benefit at full retirement age (today's dollars). */
  ssMonthlyAtFra: number;
  /** Age Social Security is claimed (62–70); 0 = none modeled. */
  ssClaimAge: number;
  /** Age to run the plan through (life expectancy for planning). */
  planThroughAge: number;
  /** Shared household facts (captured at signup, reused by every calculator). */
  filingStatus: FilingStatus;
  spouseAge: number;
  tradBalance: number;
  rothBalance: number;
  taxableBalance: number;
  annualPension: number;
  /** Annual retirement healthcare cost today (premiums + out-of-pocket). */
  annualHealthcareCost: number;
  /** Healthcare-specific inflation (decimal), usually above general inflation. */
  healthcareInflationRate: number;
  ltcEnabled: boolean;
  ltcAnnualCost: number;
  ltcStartAge: number;
  ltcYears: number;
  /** State of residence (2-letter code); defaults the state tax rate. */
  state: string;
  stateTaxRate: number;
  incomeStreams: IncomeStream[];
  expenses: ExpenseItem[];
}

export interface StateTaxInfo {
  code: string;
  name: string;
  rate: number;
}

export interface MedicareEstimateRequest {
  filingStatus: FilingStatus;
  magi: number;
  peopleOnMedicare: number;
  coverage: 'MEDIGAP' | 'ADVANTAGE';
  supplementMonthly: number;
  partDMonthly: number;
  outOfPocketAnnual: number;
}

export interface MedicareEstimateResult {
  partB: number;
  supplement: number;
  partD: number;
  outOfPocket: number;
  irmaa: number;
  total: number;
  peopleOnMedicare: number;
}

export interface ProjectionPoint {
  age: number;
  balance: number;
  contribution: number;
  ssIncome: number;
  withdrawal: number;
  phase: 'accumulation' | 'retirement';
}

export interface MonteCarloBand {
  age: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  successProbability: number;
  trials: number;
  volatility: number;
  medianEndingBalance: number;
  p10EndingBalance: number;
  p90EndingBalance: number;
  medianDepletionAge: number | null;
  points: MonteCarloBand[];
}

export interface GoalSeekLever {
  alreadyMet: boolean;
  reachable: boolean;
  currentValue: number;
  neededValue: number;
  delta: number;
}

export interface GoalSeekResult {
  currentSuccess: number;
  target: number;
  monthlyContribution: GoalSeekLever;
  retirementAge: GoalSeekLever;
  spending: GoalSeekLever;
}

/** All dollar figures are in today's (inflation-adjusted) dollars. */
export interface Projection {
  points: ProjectionPoint[];
  nestEgg: number;
  yearsToRetirement: number;
  retirementAge: number;
  totalContributions: number;
  annualSpendingGoal: number;
  ssClaimAge: number;
  ssAnnualIncome: number;
  annualGapAtRetirement: number;
  moneyLastsToAge: number | null;
  planThroughAge: number;
  balanceAtEnd: number;
  fundedThroughGoal: boolean;
  realReturn: number;
  annualHealthcareAtRetirement: number;
  ltcTotalCost: number;
}

export interface SsBreakevenRequest {
  birthYear: number;
  monthlyAtFra: number;
  earlyAge: number;
  lateAge: number;
  lifeExpectancy: number;
  /** Expected nominal annual investment return as a decimal (0.05 = 5%). */
  investmentReturn: number;
  /** Annual Social Security cost-of-living adjustment (0.025 = 2.5%). */
  colaRate: number;
  /** Annual inflation, used to show results in today's dollars (0.025 = 2.5%). */
  inflationRate: number;
}

export interface SsAgeBenefit {
  age: number;
  monthly: number;
}

export interface SsCumulativePoint {
  age: number;
  early: number;
  late: number;
}

export interface SsBreakeven {
  fraLabel: string;
  earlyAge: number;
  earlyMonthly: number;
  lateAge: number;
  lateMonthly: number;
  breakevenAge: number | null;
  breakevenLabel: string | null;
  cumulativeEarlyAtLife: number;
  cumulativeLateAtLife: number;
  lifeExpectancy: number;
  delayingWins: boolean;
  investmentReturn: number;
  colaRate: number;
  inflationRate: number;
  todaysDollars: boolean;
  schedule: SsAgeBenefit[];
  points: SsCumulativePoint[];
}

/** Sensible starting values for a fresh planner. */
export const DEFAULT_PROFILE: RetirementProfile = {
  birthDate: '1965-01-01',
  spouseBirthDate: '1965-01-01',
  currentAge: ageFromBirthDate('1965-01-01'),
  retirementAge: 65,
  currentSavings: 50000,
  monthlyContribution: 800,
  annualReturnRate: 0.07,
  inflationRate: 0.025,
  desiredAnnualIncome: 60000,
  ssMonthlyAtFra: 2000,
  ssClaimAge: 67,
  planThroughAge: 95,
  filingStatus: 'MARRIED_JOINT',
  spouseAge: ageFromBirthDate('1965-01-01'),
  tradBalance: 40000,
  rothBalance: 10000,
  taxableBalance: 0,
  annualPension: 0,
  annualHealthcareCost: 8000,
  healthcareInflationRate: 0.05,
  ltcEnabled: false,
  ltcAnnualCost: 100000,
  ltcStartAge: 83,
  ltcYears: 3,
  state: '',
  stateTaxRate: 0,
  incomeStreams: [],
  expenses: [],
};

export type TaxSource = 'OUTSIDE' | 'CONVERSION';

export interface RothRequest {
  conversionAmount: number;
  currentMarginalRate: number;
  retirementMarginalRate: number;
  annualReturn: number;
  years: number;
  taxPaidFrom: TaxSource;
  taxableDragRate: number;
}

export interface RothPoint {
  year: number;
  convert: number;
  noConvert: number;
}

export interface RothResult {
  conversionTax: number;
  rothStartValue: number;
  convertEndValue: number;
  noConvertEndValue: number;
  advantage: number;
  convertWins: boolean;
  breakevenRetirementRate: number;
  taxPaidFrom: TaxSource;
  years: number;
  points: RothPoint[];
}

export type FilingStatus = 'SINGLE' | 'MARRIED_JOINT';

export interface ConversionTaxRequest {
  filingStatus: FilingStatus;
  age: number;
  spouseAge: number;
  annualSocialSecurity: number;
  otherOrdinaryIncome: number;
  qualifiedIncome: number;
  conversionAmount: number;
}

export interface ConversionRatePoint {
  amount: number;
  marginalRate: number;
  cumulativeRate: number;
}

export interface ConversionTaxResult {
  conversionAmount: number;
  taxBefore: number;
  taxAfter: number;
  conversionTax: number;
  effectiveMarginalRate: number;
  nominalTopBracket: number;
  taxableSsBefore: number;
  taxableSsAfter: number;
  extraSsTaxed: number;
  agiBefore: number;
  agiAfter: number;
  points: ConversionRatePoint[];
}

export interface LifetimeRothRequest {
  filingStatus: FilingStatus;
  currentAge: number;
  spouseAge: number;
  planThroughAge: number;
  tradBalance: number;
  rothBalance: number;
  taxableBalance: number;
  annualPension: number;
  annualSocialSecurity: number;
  ssClaimAge: number;
  investmentReturn: number;
  inflationRate: number;
  taxableYieldRate: number;
  stateTaxRate: number;
  stateTaxesSs: boolean;
  terminalTradRate: number;
  convStartAge: number;
  convEndAge: number;
  targetTaxableIncome: number;
  maxAnnualConversion: number;
  firstDeathAge: number;
  survivorSocialSecurity: number;
  acaCoverage: boolean;
  acaHouseholdSize: number;
  acaBenchmarkAnnual: number;
  incomeStreams: IncomeStream[];
}

export interface LifetimeYearPoint {
  age: number;
  trad: number;
  roth: number;
  taxable: number;
  rmd: number;
  conversion: number;
  ordinaryIncome: number;
  taxableSs: number;
  federalTax: number;
  stateTax: number;
  irmaa: number;
  acaSubsidy: number;
  magi: number;
  widowed: boolean;
}

export interface LifetimeStrategyOutcome {
  lifetimeIncomeTax: number;
  lifetimeIrmaa: number;
  lifetimeAcaSubsidy: number;
  lifetimeTaxTotal: number;
  totalConverted: number;
  endingAfterTaxWealth: number;
  endingTrad: number;
  endingRoth: number;
  endingTaxable: number;
  points: LifetimeYearPoint[];
}

export interface LifetimeRothResult {
  rmdStartAge: number;
  baseline: LifetimeStrategyOutcome;
  converted: LifetimeStrategyOutcome;
  lifetimeTaxSaved: number;
  endingWealthAdvantage: number;
  convertRecommended: boolean;
}

export const DEFAULT_LIFETIME_ROTH: LifetimeRothRequest = {
  filingStatus: 'MARRIED_JOINT',
  currentAge: 65,
  spouseAge: 65,
  planThroughAge: 92,
  tradBalance: 1500000,
  rothBalance: 100000,
  taxableBalance: 300000,
  annualPension: 0,
  annualSocialSecurity: 50000,
  ssClaimAge: 67,
  investmentReturn: 0.06,
  inflationRate: 0.025,
  taxableYieldRate: 0.02,
  stateTaxRate: 0,
  stateTaxesSs: false,
  terminalTradRate: 0.24,
  convStartAge: 65,
  convEndAge: 74,
  targetTaxableIncome: 96950,
  maxAnnualConversion: 0,
  firstDeathAge: 0,
  survivorSocialSecurity: 33000,
  acaCoverage: false,
  acaHouseholdSize: 2,
  acaBenchmarkAnnual: 18000,
  incomeStreams: [],
};

export const DEFAULT_CONVERSION_TAX: ConversionTaxRequest = {
  filingStatus: 'MARRIED_JOINT',
  age: 66,
  spouseAge: 66,
  annualSocialSecurity: 40000,
  otherOrdinaryIncome: 30000,
  qualifiedIncome: 0,
  conversionAmount: 40000,
};

export const DEFAULT_ROTH: RothRequest = {
  conversionAmount: 100000,
  currentMarginalRate: 0.22,
  retirementMarginalRate: 0.24,
  annualReturn: 0.06,
  years: 20,
  taxPaidFrom: 'OUTSIDE',
  taxableDragRate: 0.15,
};

/** Sensible starting values for the Social Security breakeven calculator. */
export const DEFAULT_SS: SsBreakevenRequest = {
  birthYear: 1965,
  monthlyAtFra: 2000,
  earlyAge: 62,
  lateAge: 70,
  lifeExpectancy: 90,
  investmentReturn: 0.05,
  colaRate: 0.025,
  inflationRate: 0.025,
};

/**
 * Default fetch options for every API call — `credentials: 'include'` is
 * what makes the browser send the session cookie cross-origin (Next.js on
 * :3000 → RetireServer on :8083). Without this, the server sees no cookie
 * and /me always 401s.
 */
const FETCH_OPTS: RequestInit = { credentials: 'include' };

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, FETCH_OPTS);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** POST/DELETE/PUT with the session cookie; surfaces the server's error message. */
async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg = j.message || j.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  // 204 No Content (e.g. logout) has an empty body.
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  /** Backend liveness probe. */
  health: () => get<Health>('/api/health'),

  /** US states with default income-tax rates (reference data). */
  listStates: () => get<StateTaxInfo[]>('/api/states'),

  /** Estimate annual Medicare cost from its components. */
  medicareEstimate: (r: MedicareEstimateRequest) =>
    send<MedicareEstimateResult>('/api/medicare/estimate', 'POST', r),

  /** Returns the user attached to the current session cookie, or throws 401. */
  getMe: () => get<User>('/me'),

  /** Create an account; the server sets the session cookie on success. */
  register: (c: Credentials) => send<User>('/register', 'POST', c),

  /** Sign in; the server sets the session cookie on success. */
  login: (c: Credentials) => send<User>('/login', 'POST', c),

  /** Clears the server-side session and tells the browser to drop the cookie. */
  logout: () => send<void>('/logout', 'POST'),

  /** The signed-in user's saved profile, or null if they haven't saved one (204). */
  getProfile: async (): Promise<RetirementProfile | null> => {
    const res = await fetch(`${BASE}/api/profile`, FETCH_OPTS);
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<RetirementProfile>;
  },

  /** Upsert the signed-in user's profile (requires login). */
  saveProfile: (p: RetirementProfile) => send<RetirementProfile>('/api/profile', 'PUT', p),

  /** Remove the server-side profile (when switching to device-only storage). */
  deleteProfile: () => send<void>('/api/profile', 'DELETE'),

  /** Financial accounts and balances. */
  listAccounts: () => get<Account[]>('/api/accounts'),
  saveAccounts: (accounts: Account[]) => send<Account[]>('/api/accounts/bulk', 'POST', accounts),
  deleteAccount: (id: number) => send<void>(`/api/accounts/${id}`, 'DELETE'),
  accountSummary: () => get<AccountSummary>('/api/accounts/summary'),
  generateApiKey: () => send<{ apiKey: string }>('/api/accounts/token', 'POST'),

  /** Saved plan variations for the scenario comparison. */
  listScenarios: () => get<ScenarioRow[]>('/api/scenarios'),
  createScenario: (name: string, inputsJson: string) =>
    send<ScenarioRow>('/api/scenarios', 'POST', { name, inputsJson }),
  updateScenario: (id: number, name: string, inputsJson: string) =>
    send<ScenarioRow>(`/api/scenarios/${id}`, 'PUT', { name, inputsJson }),
  deleteScenario: (id: number) => send<void>(`/api/scenarios/${id}`, 'DELETE'),

  /** Compute a projection from inputs without saving — the live "what-if" preview. */
  computeProjection: (p: RetirementProfile) => send<Projection>('/api/projection', 'POST', p),

  /** Monte Carlo run of a plan — probability of success and percentile bands. */
  monteCarlo: (profile: RetirementProfile, volatility: number, trials = 1000) =>
    send<MonteCarloResult>('/api/projection/montecarlo', 'POST', { profile, volatility, trials }),

  /** Goal-seek: what change to each lever reaches a target success rate. */
  goalSeek: (profile: RetirementProfile, volatility: number, targetSuccess: number, trials = 500) =>
    send<GoalSeekResult>('/api/projection/goalseek', 'POST', { profile, volatility, targetSuccess, trials }),

  /** Full year-by-year cash-flow ledger from retirement to the horizon. */
  ledger: (profile: RetirementProfile) => send<LedgerResult>('/api/projection/ledger', 'POST', profile),

  /** Social Security claiming breakeven — pure calc, no login required. */
  ssBreakeven: (r: SsBreakevenRequest) =>
    send<SsBreakeven>('/api/social-security/breakeven', 'POST', r),

  /** Roth conversion analysis (simple two-rate model) — pure calc, no login required. */
  rothAnalyze: (r: RothRequest) => send<RothResult>('/api/roth/analyze', 'POST', r),

  /** True current-year tax cost of a conversion, from the federal tax engine. */
  conversionTaxCost: (r: ConversionTaxRequest) =>
    send<ConversionTaxResult>('/api/roth/tax-cost', 'POST', r),

  /** Multi-year lifetime conversion comparison (no conversions vs. bracket-filling). */
  lifetimeRoth: (r: LifetimeRothRequest) =>
    send<LifetimeRothResult>('/api/roth/lifetime', 'POST', r),
};
