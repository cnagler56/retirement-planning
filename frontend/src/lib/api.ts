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

/** Retirement planning inputs. Rates are decimals (0.07 = 7%). */
export interface RetirementProfile {
  id?: number;
  userId?: number;
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
}

export interface ProjectionPoint {
  age: number;
  balance: number;
  contribution: number;
  ssIncome: number;
  withdrawal: number;
  phase: 'accumulation' | 'retirement';
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
  currentAge: 35,
  retirementAge: 65,
  currentSavings: 50000,
  monthlyContribution: 800,
  annualReturnRate: 0.07,
  inflationRate: 0.025,
  desiredAnnualIncome: 60000,
  ssMonthlyAtFra: 2000,
  ssClaimAge: 67,
  planThroughAge: 95,
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

  /** Compute a projection from inputs without saving — the live "what-if" preview. */
  computeProjection: (p: RetirementProfile) => send<Projection>('/api/projection', 'POST', p),

  /** Social Security claiming breakeven — pure calc, no login required. */
  ssBreakeven: (r: SsBreakevenRequest) =>
    send<SsBreakeven>('/api/social-security/breakeven', 'POST', r),

  /** Roth conversion analysis — pure calc, no login required. */
  rothAnalyze: (r: RothRequest) => send<RothResult>('/api/roth/analyze', 'POST', r),
};
