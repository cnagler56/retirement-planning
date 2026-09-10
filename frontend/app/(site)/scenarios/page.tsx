'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  DEFAULT_PROFILE,
  type MonteCarloResult,
  type Projection,
  type RetirementProfile,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfile } from '@/src/lib/profileStore';
import {
  deleteScenario as removeScenario,
  listScenarios,
  saveScenario,
  type Scenario,
} from '@/src/lib/scenarioStore';
import { money, percent } from '@/src/lib/format';
import { ScenarioChart, type ScenarioSeries } from '@/src/components/ScenarioChart';

const COLORS = ['#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6']; // emerald, amber, sky, violet
const CLAIM_AGES = Array.from({ length: 9 }, (_, i) => 62 + i);

interface Computed {
  projection: Projection | null;
  mc: MonteCarloResult | null;
}

export default function ScenariosPage() {
  const { user, loading } = useUser();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [computed, setComputed] = useState<Computed[]>([]);
  const [volatility] = useState(0.12);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || loaded) return;
    listScenarios(user.userId)
      .then(setScenarios)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user, loaded]);

  // Recompute every scenario's outcomes when inputs change.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const results = await Promise.all(
        scenarios.map(async (s) => {
          try {
            const [projection, mc] = await Promise.all([
              api.computeProjection(s.inputs),
              api.monteCarlo(s.inputs, volatility),
            ]);
            return { projection, mc };
          } catch {
            return { projection: null, mc: null };
          }
        }),
      );
      setComputed(results);
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [scenarios, volatility]);

  const addScenario = useCallback(async () => {
    if (!user) return;
    const base = (await loadProfile(user.userId).catch(() => null)) ?? DEFAULT_PROFILE;
    setScenarios((prev) => [
      ...prev,
      { id: 0, name: `Scenario ${prev.length + 1}`, inputs: { ...DEFAULT_PROFILE, ...base } },
    ]);
  }, [user]);

  const patch = (i: number, changes: Partial<RetirementProfile>) =>
    setScenarios((prev) => prev.map((s, idx) => (idx === i ? { ...s, inputs: { ...s.inputs, ...changes } } : s)));
  const rename = (i: number, name: string) =>
    setScenarios((prev) => prev.map((s, idx) => (idx === i ? { ...s, name } : s)));

  async function saveAll() {
    if (!user) return;
    setSaving(true);
    try {
      const saved = await Promise.all(scenarios.map((s) => saveScenario(user.userId, s)));
      setScenarios(saved);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(i: number) {
    if (!user) return;
    const s = scenarios[i];
    if (s.id) await removeScenario(user.userId, s).catch(() => {});
    setScenarios((prev) => prev.filter((_, idx) => idx !== i));
  }

  const chartSeries = useMemo<ScenarioSeries[]>(
    () =>
      scenarios.map((s, i) => ({
        name: s.name,
        color: COLORS[i % COLORS.length]!,
        points: (computed[i]?.projection?.points ?? []).map((p) => ({ age: p.age, balance: p.balance })),
      })),
    [scenarios, computed],
  );

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Compare scenarios</h1>
        <p className="mt-2 text-sm opacity-70">Sign in to build and compare retirement scenarios.</p>
        <Link href="/signin" className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare scenarios</h1>
          <p className="mt-1 text-sm opacity-70">
            Save variations of your plan — retire earlier, save more, claim Social Security later — and see them
            side by side. Today&apos;s dollars.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={addScenario} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
            + Add scenario
          </button>
          {scenarios.length > 0 && (
            <button onClick={saveAll} disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
              {saving ? 'Saving…' : 'Save all'}
            </button>
          )}
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 p-8 text-center text-sm opacity-70 dark:border-white/15">
          No scenarios yet. Click <strong>Add scenario</strong> to start from your saved plan, then tweak the levers.
        </div>
      ) : (
        <>
          {/* Editable levers per scenario */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {scenarios.map((s, i) => (
              <div key={i} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <input value={s.name} onChange={(e) => rename(i, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-medium outline-none" />
                  <button onClick={() => onDelete(i)} className="text-xs text-red-500">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Retire age" value={s.inputs.retirementAge} onChange={(v) => patch(i, { retirementAge: v })} />
                  <Sel label="Claim SS at" value={s.inputs.ssClaimAge || 67} onChange={(v) => patch(i, { ssClaimAge: v })} options={CLAIM_AGES} />
                  <Num label="Monthly saving" value={s.inputs.monthlyContribution} onChange={(v) => patch(i, { monthlyContribution: v })} step={50} prefix="$" />
                  <Num label="Current savings" value={s.inputs.currentSavings} onChange={(v) => patch(i, { currentSavings: v })} step={5000} prefix="$" />
                  <Num label="Spending goal" value={s.inputs.desiredAnnualIncome} onChange={(v) => patch(i, { desiredAnnualIncome: v })} step={1000} prefix="$" />
                  <Pct label="Return" value={s.inputs.annualReturnRate} onChange={(v) => patch(i, { annualReturnRate: v })} />
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <th className="p-3 text-left font-medium opacity-60">Metric</th>
                  {scenarios.map((s, i) => (
                    <th key={i} className="p-3 text-left font-medium">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Nest egg at retirement" cells={computed.map((c) => c.projection ? money(c.projection.nestEgg) : '—')} />
                <Row label="Plan outcome" cells={computed.map((c) => !c.projection ? '—'
                  : c.projection.fundedThroughGoal ? `Funded to ${c.projection.planThroughAge}` : `Runs out at ${c.projection.moneyLastsToAge}`)} />
                <Row label="Monte Carlo success" highlight cells={computed.map((c) => c.mc ? `${Math.round(c.mc.successProbability * 100)}%` : '—')} />
                <Row label="Median ending (today's $)" cells={computed.map((c) => c.mc ? money(c.mc.medianEndingBalance) : '—')} />
                <Row label="Social Security" cells={computed.map((c) => c.projection && c.projection.ssAnnualIncome > 0 ? `${money(c.projection.ssAnnualIncome)}/yr @ ${c.projection.ssClaimAge}` : '—')} />
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <div className="mb-2 text-sm font-medium">Portfolio balance over time</div>
            <ScenarioChart series={chartSeries} />
          </div>

          <p className="text-xs opacity-50">
            Each scenario runs the full projection and a {percent(volatility)}-volatility Monte Carlo. Levers not
            shown here (Social Security amount, balances by type, income streams, taxes) come from your saved
            profile at the time the scenario was created.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, cells, highlight = false }: { label: string; cells: string[]; highlight?: boolean }) {
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/5">
      <td className="p-3 opacity-60">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className={`p-3 ${highlight ? 'font-semibold' : ''}`}>{c}</td>
      ))}
    </tr>
  );
}

function Num({ label, value, onChange, step = 1, prefix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block opacity-60">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        {prefix && <span className="pl-2 opacity-50">{prefix}</span>}
        <input type="number" value={Number.isFinite(value) ? value : ''} step={step} min={0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none" />
      </div>
    </label>
  );
}

function Pct({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block opacity-60">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} step={0.1} min={0} max={15}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none" />
        <span className="pr-2 opacity-50">%</span>
      </div>
    </label>
  );
}

function Sel({ label, value, onChange, options }: {
  label: string; value: number; onChange: (v: number) => void; options: number[];
}) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block opacity-60">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40">
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{o}</option>
        ))}
      </select>
    </label>
  );
}
