'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, DEFAULT_ROTH, type RothRequest, type RothResult, type TaxSource } from '@/src/lib/api';
import { money, percent } from '@/src/lib/format';
import { RothChart } from '@/src/components/RothChart';

export default function RothPage() {
  const [input, setInput] = useState<RothRequest>(DEFAULT_ROTH);
  const [result, setResult] = useState<RothResult | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.rothAnalyze(input).then(setResult).catch(() => setResult(null));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [input]);

  const set = <K extends keyof RothRequest>(key: K) => (value: RothRequest[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const fromOutside = input.taxPaidFrom === 'OUTSIDE';

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roth conversion analyzer</h1>
          <p className="mt-1 text-sm opacity-70">
            Convert to Roth now, or leave it to grow tax-deferred?
          </p>
        </div>
        <Link href="/" className="text-sm underline underline-offset-4">← Dashboard</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Inputs */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <NumberField label="Amount to convert" value={input.conversionAmount}
            onChange={set('conversionAmount')} min={0} step={5000} prefix="$" />
          <PercentField label="Current marginal tax rate" value={input.currentMarginalRate}
            onChange={set('currentMarginalRate')} max={50} />
          <PercentField label="Expected retirement tax rate" value={input.retirementMarginalRate}
            onChange={set('retirementMarginalRate')} max={50} />
          <PercentField label="Expected annual return" value={input.annualReturn}
            onChange={set('annualReturn')} max={20} />
          <NumberField label="Years until withdrawal" value={input.years}
            onChange={set('years')} min={1} max={60} />

          <div className="text-sm">
            <span className="mb-1 block opacity-70">Pay the conversion tax from</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Outside funds" active={fromOutside} onClick={() => set('taxPaidFrom')('OUTSIDE')} />
              <Choice label="The conversion" active={!fromOutside} onClick={() => set('taxPaidFrom')('CONVERSION')} />
            </div>
            <span className="mt-1 block text-xs opacity-45">
              {fromOutside
                ? 'Full amount lands in the Roth; tax comes from taxable savings.'
                : 'Tax is withheld from the amount, so less lands in the Roth.'}
            </span>
          </div>

          {fromOutside && (
            <PercentField label="Taxable account tax drag" value={input.taxableDragRate}
              onChange={set('taxableDragRate')} max={40}
              hint="Share of taxable growth lost to tax yearly. Why paying from outside helps." />
          )}
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <>
              <div className={`rounded-lg border p-4 ${
                result.convertWins ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'
              }`}>
                <div className="text-xs uppercase tracking-wide opacity-60">Bottom line</div>
                <div className="mt-1 text-2xl font-semibold">
                  {result.convertWins
                    ? `Converting wins by ${money(Math.abs(result.advantage))}`
                    : `Not converting wins by ${money(Math.abs(result.advantage))}`}
                </div>
                <p className="mt-1 text-sm opacity-70">
                  After {result.years} years, converting is worth {money(result.convertEndValue)} after tax
                  vs {money(result.noConvertEndValue)} if you don&apos;t — a{' '}
                  {money(Math.abs(result.advantage))} {result.convertWins ? 'edge' : 'shortfall'}. Converting
                  also removes future required minimum distributions on this money (not counted above).
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Tax due now" value={money(result.conversionTax)} hint="at your current rate" />
                <Stat label="Lands in Roth" value={money(result.rothStartValue)}
                  hint={result.taxPaidFrom === 'OUTSIDE' ? 'full amount' : 'after withheld tax'} />
                <Stat label="Break-even future rate" value={percent(result.breakevenRetirementRate)}
                  hint="convert if you expect higher" />
              </div>

              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="mb-2 text-sm font-medium">After-tax value over time</div>
                <RothChart points={result.points} />
              </div>

              <p className="text-xs opacity-50">
                Compares after-tax ending wealth on equal footing. Ignores RMDs (which conversions reduce),
                IRMAA surcharges, state taxes, the 5-year rule, and future bracket changes. Not tax advice.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
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

function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm ${
        active
          ? 'border-transparent'
          : 'border-black/15 opacity-70 hover:opacity-100 dark:border-white/15'
      }`}
      style={active ? { background: 'var(--foreground)', color: 'var(--background)' } : undefined}
    >
      {label}
    </button>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1, prefix }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string;
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
    </label>
  );
}

/** Edits a decimal rate (0.22) as a percent (22). */
function PercentField({ label, value, onChange, max = 30, hint }: {
  label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} min={0} max={max} step={0.5}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-3 py-2 outline-none" />
        <span className="pr-3 text-sm opacity-50">%</span>
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}
