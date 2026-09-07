'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  DEFAULT_PROFILE,
  type MonteCarloResult,
  type Projection,
  type RetirementProfile,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { money, percent } from '@/src/lib/format';
import { ProjectionChart } from '@/src/components/ProjectionChart';
import { MonteCarloChart } from '@/src/components/MonteCarloChart';

const CLAIM_AGES = Array.from({ length: 9 }, (_, i) => 62 + i); // 62..70

export default function PlanPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResult | null>(null);
  const [volatility, setVolatility] = useState(0.12);
  const [loadedSaved, setLoadedSaved] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mcDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || loadedSaved) return;
    api.getProfile()
      .then((p) => { if (p) setProfile({ ...DEFAULT_PROFILE, ...p }); })
      .catch(() => { /* not saved yet — keep defaults */ })
      .finally(() => setLoadedSaved(true));
  }, [user, loadedSaved]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.computeProjection(profile).then(setProjection).catch(() => setProjection(null));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [profile]);

  useEffect(() => {
    if (mcDebounce.current) clearTimeout(mcDebounce.current);
    mcDebounce.current = setTimeout(() => {
      api.monteCarlo(profile, volatility).then(setMonteCarlo).catch(() => setMonteCarlo(null));
    }, 350);
    return () => { if (mcDebounce.current) clearTimeout(mcDebounce.current); };
  }, [profile, volatility]);

  const set = useCallback(
    (key: keyof RetirementProfile) => (value: number) => {
      setProfile((prev) => ({ ...prev, [key]: value }));
      setSaveState('idle');
    },
    [],
  );

  async function onSave() {
    setSaveState('saving');
    setSaveError(null);
    try {
      const saved = await api.saveProfile(profile);
      setProfile({ ...DEFAULT_PROFILE, ...saved });
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  const funded = projection?.fundedThroughGoal;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your plan</h1>
          <p className="mt-1 text-sm opacity-70">
            Everything in today&apos;s dollars. The projection updates live.
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">← Dashboard</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Inputs */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <Section title="You" />
          <NumberField label="Current age" value={profile.currentAge} onChange={set('currentAge')} min={16} max={100} />
          <NumberField label="Retirement age" value={profile.retirementAge} onChange={set('retirementAge')} min={profile.currentAge + 1} max={100} />
          <NumberField label="Plan through age" value={profile.planThroughAge} onChange={set('planThroughAge')} min={profile.retirementAge + 1} max={110} />

          <Section title="Savings" />
          <NumberField label="Current savings" value={profile.currentSavings} onChange={set('currentSavings')} min={0} step={1000} prefix="$" />
          <NumberField label="Monthly contribution" value={profile.monthlyContribution} onChange={set('monthlyContribution')} min={0} step={50} prefix="$" />
          <PercentField label="Expected annual return" value={profile.annualReturnRate} onChange={set('annualReturnRate')} />
          <PercentField label="Inflation" value={profile.inflationRate} onChange={set('inflationRate')} />

          <Section title="Retirement income" />
          <NumberField label="Desired annual income" value={profile.desiredAnnualIncome} onChange={set('desiredAnnualIncome')} min={0} step={1000} prefix="$" />
          <NumberField label="Social Security at full retirement age (monthly)" value={profile.ssMonthlyAtFra} onChange={set('ssMonthlyAtFra')} min={0} step={50} prefix="$"
            hint="From your SSA statement. Set 0 to exclude." />
          <SelectField label="Claim Social Security at" value={profile.ssClaimAge || 67} onChange={set('ssClaimAge')} options={CLAIM_AGES} />

          <div className="pt-2">
            {user ? (
              <button type="button" onClick={onSave} disabled={saveState === 'saving'}
                className="w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save plan'}
              </button>
            ) : (
              <Link href="/signin" className="block rounded-md border border-black/15 px-4 py-2 text-center text-sm dark:border-white/15">
                Sign in to save this plan
              </Link>
            )}
            {saveError && <p className="mt-2 text-xs text-red-500">{saveError}</p>}
          </div>
        </form>

        {/* Results */}
        <div className="space-y-6">
          {projection && (
            <>
              <div className={`rounded-lg border p-4 ${
                funded ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'
              }`}>
                <div className="text-xs uppercase tracking-wide opacity-60">Bottom line</div>
                <div className="mt-1 text-2xl font-semibold">
                  {funded
                    ? `Funded through age ${projection.planThroughAge}`
                    : `Money runs out at age ${projection.moneyLastsToAge}`}
                </div>
                <p className="mt-1 text-sm opacity-70">
                  {funded
                    ? `You end with ${money(projection.balanceAtEnd)} left over.`
                    : `Your savings plus Social Security don't cover ${money(projection.annualSpendingGoal)}/yr through age ${projection.planThroughAge}. Try saving more, retiring later, or claiming SS later.`}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label={`Nest egg at ${projection.retirementAge}`} value={money(projection.nestEgg)} hint="today's dollars" />
                <Stat label="Social Security" value={projection.ssAnnualIncome > 0 ? `${money(projection.ssAnnualIncome)}/yr` : 'none'}
                  hint={projection.ssClaimAge > 0 ? `from age ${projection.ssClaimAge}` : 'not modeled'} />
                <Stat label="Portfolio draw, yr 1" value={money(projection.annualGapAtRetirement)} hint="after Social Security" />
              </div>

              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <ProjectionChart points={projection.points} retirementAge={projection.retirementAge}
                  moneyLastsToAge={projection.moneyLastsToAge} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Breakdown label="Total contributed" value={money(projection.totalContributions)} />
                <Breakdown label="Annual spending goal" value={money(projection.annualSpendingGoal)} />
              </div>
            </>
          )}

          {monteCarlo && (
            <div className="space-y-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-60">
                    Monte Carlo · {monteCarlo.trials.toLocaleString()} random markets
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={`text-3xl font-semibold ${
                      monteCarlo.successProbability >= 0.85 ? 'text-emerald-600 dark:text-emerald-400'
                      : monteCarlo.successProbability >= 0.7 ? '' : 'text-red-500'
                    }`}>
                      {Math.round(monteCarlo.successProbability * 100)}%
                    </span>
                    <span className="text-sm opacity-70">chance your money lasts to {profile.planThroughAge}</span>
                  </div>
                </div>
                <label className="text-sm">
                  <span className="mb-1 block text-xs opacity-70">Return volatility</span>
                  <div className="flex items-center rounded-md border border-black/15 dark:border-white/15">
                    <input type="number" value={Math.round(volatility * 1000) / 10} min={0} max={30} step={0.5}
                      onChange={(e) => setVolatility((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
                      className="w-20 bg-transparent px-2 py-2 outline-none" />
                    <span className="pr-2 text-sm opacity-50">%</span>
                  </div>
                </label>
              </div>

              <MonteCarloChart points={monteCarlo.points} />

              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <Breakdown label="Poor market (10th %)" value={money(monteCarlo.p10EndingBalance)} />
                <Breakdown label="Median ending" value={money(monteCarlo.medianEndingBalance)} />
                <Breakdown label="Strong market (90th %)" value={money(monteCarlo.p90EndingBalance)} />
              </div>
              <p className="text-xs opacity-50">
                Each year&apos;s return is drawn at random around your {percent(profile.annualReturnRate)} expected
                return with {percent(volatility)} volatility, capturing sequence-of-returns risk. Today&apos;s dollars.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div className="pt-1 text-xs font-semibold uppercase tracking-wide opacity-40">{title}</div>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-xs opacity-50">{hint}</div>}
    </div>
  );
}

function Breakdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-md border border-black/10 px-3 py-2 dark:border-white/10">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step = 1, prefix, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        {prefix && <span className="pl-3 text-sm opacity-50">{prefix}</span>}
        <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-3 py-2 outline-none" />
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}

/** Edits a decimal rate (0.07) as a percent (7). */
function PercentField({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} min={0} max={30} step={0.1}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-3 py-2 outline-none" />
        <span className="pr-3 text-sm opacity-50">%</span>
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: number; onChange: (v: number) => void; options: number[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40">
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{o}</option>
        ))}
      </select>
    </label>
  );
}
