'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  api,
  DEFAULT_PROFILE,
  type LedgerResult,
  type MonteCarloResult,
  type Projection,
  type RetirementProfile,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfileWithAccounts } from '@/src/lib/profileStore';
import { money, percent } from '@/src/lib/format';

const MC_VOLATILITY = 0.12;

export default function SummaryPage() {
  const { user, loading } = useUser();
  const [profile, setProfile] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || loaded) return;
    loadProfileWithAccounts(user.userId)
      .then(({ profile: p }) => { if (p) setProfile({ ...DEFAULT_PROFILE, ...p }); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user, loaded]);

  useEffect(() => {
    if (!loaded) return;
    api.computeProjection(profile).then(setProjection).catch(() => setProjection(null));
    api.monteCarlo(profile, MC_VOLATILITY).then(setMonteCarlo).catch(() => setMonteCarlo(null));
    api.ledger(profile).then(setLedger).catch(() => setLedger(null));
  }, [profile, loaded]);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Plan summary</h1>
        <p className="mt-2 text-sm opacity-70">Sign in to see your one-page plan summary.</p>
        <Link href="/signin" className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>Sign in</Link>
      </div>
    );
  }

  // Deterministic outcome comes from the ledger — the tax-and-RMD-aware year-by-year —
  // so the summary matches that table rather than the simpler, tax-free projection.
  const funded = ledger ? ledger.moneyLastsToAge == null : (projection?.fundedThroughGoal ?? false);
  const runsOut = ledger ? ledger.moneyLastsToAge : (projection?.moneyLastsToAge ?? null);
  const endingBalance = ledger ? (ledger.rows.at(-1)?.endTotal ?? 0) : (projection?.balanceAtEnd ?? 0);
  const lifetimeTax = ledger
    ? ledger.rows.reduce((s, r) => s + r.federalTax + r.stateTax + r.irmaa, 0)
    : null;
  const savings = Math.max(profile.currentSavings, profile.tradBalance + profile.rothBalance + profile.taxableBalance);
  const name = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const events = (profile.oneTimeEvents || []).filter((e) => e.amount > 0);

  return (
    <>
      {/* Print rules: drop the app chrome and the on-screen "paper" framing. */}
      <style>{`
        @media print {
          header { display: none !important; }
          main { padding: 0 !important; }
          .no-print { display: none !important; }
          .plan-sheet { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 0.5in; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between no-print">
        <Link href="/plan" className="text-sm underline underline-offset-4">← Planner</Link>
        <button type="button" onClick={() => window.print()}
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
          Save as PDF
        </button>
      </div>

      <div className="plan-sheet mx-auto max-w-3xl rounded-xl bg-white p-8 text-neutral-900 shadow-lg">
        {/* Header */}
        <div className="flex items-end justify-between border-b border-neutral-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Retirement Plan Summary</h1>
            {name && <p className="mt-0.5 text-sm text-neutral-500">{name}</p>}
          </div>
          <p className="text-xs text-neutral-400">Prepared {today}</p>
        </div>

        {!projection ? (
          <p className="py-10 text-center text-sm text-neutral-400">Building your summary…</p>
        ) : (
          <>
            {/* Bottom line */}
            <div className={`mt-5 rounded-lg p-4 ${funded ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'}`}>
              <div className="text-lg font-semibold">
                {funded
                  ? `On track — funded through age ${profile.planThroughAge}`
                  : `Shortfall — money runs out at age ${runsOut}`}
              </div>
              {monteCarlo && (
                <div className="mt-1 text-sm opacity-80">
                  {Math.round(monteCarlo.successProbability * 100)}% chance of lasting through age {profile.planThroughAge}{' '}
                  across {monteCarlo.trials.toLocaleString()} market simulations (10th–90th percentile ending{' '}
                  {money(monteCarlo.p10EndingBalance)}–{money(monteCarlo.p90EndingBalance)}).
                </div>
              )}
            </div>

            {/* Snapshot */}
            <Section title="Snapshot" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Stat label="Current age" value={String(profile.currentAge)} />
              <Stat label="Retirement age" value={`${projection.retirementAge} (in ${projection.yearsToRetirement} yrs)`} />
              <Stat label="Plan through" value={`age ${profile.planThroughAge}`} />
              <Stat label="Retirement savings" value={money(savings)} />
              <Stat label="Monthly contribution" value={money(profile.monthlyContribution)} />
              <Stat label="Filing" value={profile.filingStatus === 'MARRIED_JOINT' ? 'Married filing jointly' : 'Single'} />
            </div>

            {/* Money */}
            <Section title="The numbers (today's dollars)" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Stat label="Nest egg at retirement" value={money(projection.nestEgg)} />
              <Stat label="Annual spending goal" value={money(projection.annualSpendingGoal)} />
              <Stat label="Social Security"
                value={projection.ssAnnualIncome > 0 ? `${money(projection.ssAnnualIncome)}/yr` : '—'}
                sub={projection.ssAnnualIncome > 0 ? `from age ${projection.ssClaimAge}` : undefined} />
              <Stat label="First-year portfolio draw" value={`${money(projection.annualGapAtRetirement)}/yr`} sub="after Social Security" />
              <Stat label="Healthcare at retirement" value={`${money(projection.annualHealthcareAtRetirement)}/yr`} />
              <Stat label="RMDs begin" value={ledger ? `age ${ledger.rmdStartAge}` : '—'} />
              <Stat label="Lifetime taxes" value={lifetimeTax != null ? money(lifetimeTax) : '—'} sub="federal + state + IRMAA" />
              <Stat label="Projected ending balance" value={money(endingBalance)} sub={`at age ${profile.planThroughAge}, after taxes`} />
              <Stat label="Total contributed" value={money(projection.totalContributions)} sub="to retirement" />
            </div>

            {/* Assumptions */}
            <Section title="Assumptions" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Stat label="Expected return" value={percent(profile.annualReturnRate)} />
              <Stat label="Inflation" value={percent(profile.inflationRate)} />
              <Stat label="Real return" value={percent(projection.realReturn)} />
              <Stat label="Withdrawal order" value={strategyLabel(profile.withdrawalStrategy)} />
            </div>

            {/* Risks & notes */}
            <Section title="Risks & considerations" />
            <ul className="space-y-1.5 text-sm text-neutral-700">
              <li>• <strong>Sequence-of-returns risk:</strong> in a poor market (10th percentile), the plan {monteCarlo && monteCarlo.p10EndingBalance <= 0 ? 'runs dry before the horizon' : `ends near ${monteCarlo ? money(monteCarlo.p10EndingBalance) : '—'}`}.</li>
              <li>• <strong>Long-term care:</strong> {profile.ltcEnabled
                ? `modeled — about ${money(projection.ltcTotalCost)} over the care window (today's dollars).`
                : 'not modeled. A multi-year care event is a common late-life shock worth stress-testing.'}</li>
              {profile.filingStatus === 'MARRIED_JOINT' && (
                <li>• <strong>Survivor:</strong> {profile.firstDeathAge && profile.firstDeathAge > 0
                  ? `a first death at age ${profile.firstDeathAge} is included — the survivor files single and keeps the larger Social Security benefit.`
                  : 'not modeled. The survivor would face single-filer taxes and lose the smaller Social Security benefit.'}</li>
              )}
              {events.length > 0 && (
                <li>• <strong>One-time events:</strong> {events.length} included ({events.map((e) => e.label || (e.inflow ? 'inflow' : 'outflow')).join(', ')}).</li>
              )}
            </ul>

            {/* Footer */}
            <p className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-400">
              All figures in today&apos;s (inflation-adjusted) dollars and are estimates, not financial or tax advice.
              Deterministic projection with a {monteCarlo ? `${Math.round(MC_VOLATILITY * 100)}%-volatility` : ''} Monte Carlo overlay.
              Generated {today} · Retirement Planner.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function strategyLabel(s: string | undefined): string {
  if (s === 'PROPORTIONAL') return 'Proportional';
  if (s === 'TAX_EFFICIENT') return 'Tax-efficient';
  return 'Taxable → pre-tax → Roth';
}

function Section({ title }: { title: string }) {
  return <h2 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {sub && <div className="text-xs text-neutral-400">{sub}</div>}
    </div>
  );
}
