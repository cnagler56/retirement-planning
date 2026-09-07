'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, DEFAULT_SS, type SsBreakeven, type SsBreakevenRequest } from '@/src/lib/api';
import { money, percent } from '@/src/lib/format';
import { BreakevenChart } from '@/src/components/BreakevenChart';

const CLAIM_AGES = Array.from({ length: 9 }, (_, i) => 62 + i); // 62..70

export default function SocialSecurityPage() {
  const [input, setInput] = useState<SsBreakevenRequest>(DEFAULT_SS);
  const [result, setResult] = useState<SsBreakeven | null>(null);
  // COLA mirrors inflation until the user edits COLA directly, then it unlinks.
  const [colaLinked, setColaLinked] = useState(true);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.ssBreakeven(input).then(setResult).catch(() => setResult(null));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [input]);

  const set = <K extends keyof SsBreakevenRequest>(key: K) => (value: number) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  // Editing inflation also moves COLA while they're linked.
  const setInflation = (value: number) =>
    setInput((prev) => ({ ...prev, inflationRate: value, ...(colaLinked ? { colaRate: value } : null) }));

  // Editing COLA directly breaks the link so it holds its own value.
  const setCola = (value: number) => {
    setColaLinked(false);
    setInput((prev) => ({ ...prev, colaRate: value }));
  };

  // Re-link COLA back to inflation.
  const relinkCola = () => {
    setColaLinked(true);
    setInput((prev) => ({ ...prev, colaRate: prev.inflationRate }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social Security breakeven</h1>
          <p className="mt-1 text-sm opacity-70">
            When does claiming later pull ahead of claiming earlier?
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">← Dashboard</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Inputs */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <NumberField label="Birth year" value={input.birthYear} onChange={set('birthYear')} min={1943} max={2005} />
          <NumberField label="Monthly benefit at full retirement age" value={input.monthlyAtFra}
            onChange={set('monthlyAtFra')} min={0} step={50} prefix="$"
            hint="From your SSA statement (ssa.gov/myaccount)" />
          <SelectField label="Claim earlier at" value={input.earlyAge} onChange={set('earlyAge')} options={CLAIM_AGES} />
          <SelectField label="Compare to claiming at" value={input.lateAge} onChange={set('lateAge')} options={CLAIM_AGES} />
          <NumberField label="Plan through age" value={input.lifeExpectancy} onChange={set('lifeExpectancy')} min={71} max={100}
            hint="How long you expect to collect" />
          <PercentField label="Expected investment return" value={input.investmentReturn} onChange={set('investmentReturn')}
            hint="Nominal. Benefits taken sooner stay invested at this rate." />
          <PercentField label="Inflation" value={input.inflationRate} onChange={setInflation}
            hint="Shows all values in today's dollars. Doesn't change the breakeven age." />
          <PercentField
            label="Annual COLA"
            value={input.colaRate}
            onChange={setCola}
            hint={
              colaLinked
                ? 'Tracking inflation — Social Security’s yearly raise. Edit to override.'
                : undefined
            }
            action={
              colaLinked ? undefined : (
                <button type="button" onClick={relinkCola} className="underline opacity-70 hover:opacity-100">
                  Match inflation
                </button>
              )
            }
          />
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <>
              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="text-xs uppercase tracking-wide opacity-60">Breakeven age</div>
                <div className="mt-1 text-3xl font-semibold">
                  {result.breakevenLabel ?? 'n/a'}
                </div>
                <p className="mt-2 text-sm opacity-70">
                  {result.breakevenAge != null ? (
                    <>
                      Claiming at <strong>{result.lateAge}</strong> ({money(result.lateMonthly)}/mo) overtakes
                      claiming at <strong>{result.earlyAge}</strong> ({money(result.earlyMonthly)}/mo) around age{' '}
                      <strong>{result.breakevenLabel}</strong>
                      {result.investmentReturn > 0 ? (
                        <> — counting the {percent(result.investmentReturn)} growth on benefits taken sooner</>
                      ) : null}
                      . Live past that and the later claim wins; die before it and the earlier claim won.
                    </>
                  ) : (
                    <>Pick two different claim ages to see a breakeven.</>
                  )}
                </p>
                <p className="mt-1 text-xs opacity-50">
                  Full retirement age for {input.birthYear}: {result.fraLabel}.
                  {result.colaRate > 0 && <> {percent(result.colaRate)} COLA.</>}
                  {result.investmentReturn > 0 && <> {percent(result.investmentReturn)} invested return.</>}
                  {result.todaysDollars && <> Values in today&apos;s dollars.</>}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Stat label={`Monthly at ${result.earlyAge}`} value={money(result.earlyMonthly)}
                  sub={`${money(result.earlyMonthly * 12)}/yr`} accent="amber" />
                <Stat label={`Monthly at ${result.lateAge}`} value={money(result.lateMonthly)}
                  sub={`${money(result.lateMonthly * 12)}/yr`} accent="emerald" />
              </div>

              <div
                className={`rounded-lg border p-3 text-sm ${
                  result.delayingWins
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'
                }`}
              >
                By age {result.lifeExpectancy}, claiming at {result.earlyAge} is worth{' '}
                {money(result.cumulativeEarlyAtLife)} and claiming at {result.lateAge} is worth{' '}
                {money(result.cumulativeLateAtLife)}
                {result.investmentReturn > 0 ? ` (benefits invested at ${percent(result.investmentReturn)})` : ''}.
                Claiming at{' '}
                <strong>{result.delayingWins ? result.lateAge : result.earlyAge}</strong> comes out ahead by{' '}
                {money(Math.abs(result.cumulativeLateAtLife - result.cumulativeEarlyAtLife))}.
              </div>

              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="mb-2 text-sm font-medium">
                  {result.investmentReturn > 0 ? 'Accumulated value of benefits' : 'Cumulative benefits collected'}
                  {result.todaysDollars && <span className="font-normal opacity-50"> · today&apos;s dollars</span>}
                </div>
                <BreakevenChart points={result.points} earlyAge={result.earlyAge}
                  lateAge={result.lateAge} breakevenAge={result.breakevenAge} />
              </div>

              <details className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
                <summary className="cursor-pointer font-medium">Benefit by claiming age</summary>
                <div className="mt-3 grid grid-cols-3 gap-y-1 sm:grid-cols-5">
                  {result.schedule.map((s) => (
                    <div key={s.age} className="flex flex-col">
                      <span className="text-xs opacity-50">Age {s.age}</span>
                      <span className="font-medium">{money(s.monthly)}</span>
                    </div>
                  ))}
                </div>
              </details>

              <p className="text-xs opacity-50">
                Estimates using 2024 SSA reduction and delayed-credit rules, with an annual COLA and
                benefits taken sooner assumed to stay invested at your expected return. Excludes taxes
                and spousal benefits. Not financial advice.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent: 'amber' | 'emerald';
}) {
  const dot = accent === 'amber' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-60">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />{label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-0.5 text-xs opacity-50">{sub}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, prefix, hint }: {
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

/** Edits a decimal rate (0.05) as a percent (5). */
function PercentField({ label, value, onChange, hint, action }: {
  label: string; value: number; onChange: (v: number) => void;
  hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <label className="block">
        <span className="mb-1 block opacity-70">{label}</span>
        <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
          <input type="number" value={Math.round(value * 1000) / 10} min={0} max={15} step={0.1}
            onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
            className="w-full bg-transparent px-3 py-2 outline-none" />
          <span className="pr-3 text-sm opacity-50">%</span>
        </div>
      </label>
      {(hint || action) && (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs opacity-60">
          <span className="opacity-80">{hint}</span>
          {action}
        </div>
      )}
    </div>
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
          <option key={o} value={o} className="bg-white text-black dark:bg-neutral-900 dark:text-white">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
