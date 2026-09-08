'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  DEFAULT_CONVERSION_TAX,
  type ConversionTaxRequest,
  type ConversionTaxResult,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfile } from '@/src/lib/profileStore';
import { conversionTaxDefaults } from '@/src/lib/profileDefaults';
import { money, percent } from '@/src/lib/format';
import { RothTorpedoChart } from '@/src/components/RothTorpedoChart';

export default function RothPage() {
  const { user } = useUser();
  const [input, setInput] = useState<ConversionTaxRequest>(DEFAULT_CONVERSION_TAX);
  const [result, setResult] = useState<ConversionTaxResult | null>(null);
  const [seeded, setSeeded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill from the saved household profile once signed in.
  useEffect(() => {
    if (!user || seeded) return;
    loadProfile(user.userId).then((p) => { if (p) setInput(conversionTaxDefaults(p)); }).catch(() => {}).finally(() => setSeeded(true));
  }, [user, seeded]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.conversionTaxCost(input).then(setResult).catch(() => setResult(null));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [input]);

  const set = <K extends keyof ConversionTaxRequest>(key: K) => (value: ConversionTaxRequest[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const married = input.filingStatus === 'MARRIED_JOINT';
  // Effective rate meaningfully above the bracket ⇒ a torpedo is in play.
  const torpedo = result != null && result.effectiveMarginalRate - result.nominalTopBracket > 0.01;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roth conversion analyzer</h1>
          <p className="mt-1 text-sm opacity-70">
            The real tax cost of converting this year — computed from your whole return.
          </p>
        </div>
        <Link href="/roth/lifetime" className="text-sm underline underline-offset-4">Lifetime strategy →</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Inputs */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div className="text-sm">
            <span className="mb-1 block opacity-70">Filing status</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Married joint" active={married} onClick={() => set('filingStatus')('MARRIED_JOINT')} />
              <Choice label="Single" active={!married} onClick={() => set('filingStatus')('SINGLE')} />
            </div>
          </div>

          <div className={married ? 'grid grid-cols-2 gap-3' : ''}>
            <NumberField label="Your age" value={input.age} onChange={set('age')} min={40} max={100} />
            {married && <NumberField label="Spouse age" value={input.spouseAge} onChange={set('spouseAge')} min={40} max={100} />}
          </div>

          <NumberField label="Annual Social Security" value={input.annualSocialSecurity}
            onChange={set('annualSocialSecurity')} min={0} step={1000} prefix="$"
            hint="Gross benefits. 0 if not yet claiming." />
          <NumberField label="Other ordinary income" value={input.otherOrdinaryIncome}
            onChange={set('otherOrdinaryIncome')} min={0} step={1000} prefix="$"
            hint="Pensions, interest, wages, existing RMDs — before any conversion." />
          <NumberField label="Qualified dividends & long-term gains" value={input.qualifiedIncome}
            onChange={set('qualifiedIncome')} min={0} step={1000} prefix="$" />
          <NumberField label="Amount to convert" value={input.conversionAmount}
            onChange={set('conversionAmount')} min={0} step={5000} prefix="$" />
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <>
              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="text-xs uppercase tracking-wide opacity-60">
                  Converting {money(result.conversionAmount)} costs
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-3xl font-semibold">{money(result.conversionTax)}</span>
                  <span className="text-lg opacity-70">
                    = {percent(result.effectiveMarginalRate)} effective rate
                  </span>
                </div>
                {torpedo ? (
                  <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
                    ⚠️ <strong>Social Security tax torpedo.</strong> Your top bracket is only{' '}
                    {percent(result.nominalTopBracket)}, but this conversion pulls{' '}
                    <strong>{money(result.extraSsTaxed)}</strong> of Social Security into taxable income —
                    pushing your real rate to <strong>{percent(result.effectiveMarginalRate)}</strong>.
                    Converting less, or before you claim Social Security, avoids much of this.
                  </p>
                ) : (
                  <p className="mt-2 text-sm opacity-70">
                    Your top bracket on the last converted dollar is {percent(result.nominalTopBracket)}.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Federal tax before" value={money(result.taxBefore)} />
                <Stat label="Federal tax after" value={money(result.taxAfter)} />
                <Stat label="Extra SS taxed" value={money(result.extraSsTaxed)}
                  hint={`taxable SS ${money(result.taxableSsBefore)} → ${money(result.taxableSsAfter)}`} />
              </div>

              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="mb-2 text-sm font-medium">Marginal rate as you convert more</div>
                <RothTorpedoChart points={result.points} nominalBracket={result.nominalTopBracket} />
                <p className="mt-2 text-xs opacity-55">
                  Where the green line rises above the nominal bracket, each extra dollar also makes some
                  Social Security (or capital gains) taxable. Once the line drops back, the torpedo is
                  spent — further conversions cost only the bracket rate.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <Breakdown label="AGI before → after" value={`${money(result.agiBefore)} → ${money(result.agiAfter)}`} />
                <Breakdown label="Blended rate on conversion" value={percent(result.effectiveMarginalRate)} />
              </div>

              <p className="text-xs opacity-50">
                Uses 2025 federal brackets, the standard deduction (incl. the age-65 addition), the IRS
                Social Security worksheet, capital-gains stacking, and the 3.8% Net Investment Income Tax.
                Excludes state tax, IRMAA, AMT, and credits (see the lifetime strategy for those). Not tax advice.
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

function Breakdown({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-md border border-black/10 px-3 py-2 dark:border-white/10">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md border px-3 py-2 text-sm ${
        active ? 'border-transparent' : 'border-black/15 opacity-70 hover:opacity-100 dark:border-white/15'
      }`}
      style={active ? { background: 'var(--foreground)', color: 'var(--background)' } : undefined}>
      {label}
    </button>
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
