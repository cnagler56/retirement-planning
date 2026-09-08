'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  DEFAULT_LIFETIME_ROTH,
  type LifetimeRothRequest,
  type LifetimeRothResult,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfile } from '@/src/lib/profileStore';
import { lifetimeDefaults } from '@/src/lib/profileDefaults';
import { money, percent } from '@/src/lib/format';
import { LifetimeWealthChart, type WealthPoint } from '@/src/components/LifetimeWealthChart';

export default function LifetimeRothPage() {
  const { user } = useUser();
  const [input, setInput] = useState<LifetimeRothRequest>(DEFAULT_LIFETIME_ROTH);
  const [result, setResult] = useState<LifetimeRothResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill from the saved household profile once signed in.
  useEffect(() => {
    if (!user || seeded) return;
    loadProfile(user.userId).then((p) => { if (p) setInput(lifetimeDefaults(p)); }).catch(() => {}).finally(() => setSeeded(true));
  }, [user, seeded]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setBusy(true);
    debounce.current = setTimeout(() => {
      api.lifetimeRoth(input).then(setResult).catch(() => setResult(null)).finally(() => setBusy(false));
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [input]);

  const set = <K extends keyof LifetimeRothRequest>(key: K) => (value: LifetimeRothRequest[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const married = input.filingStatus === 'MARRIED_JOINT';

  // After-tax net worth per year for both strategies (Roth is tax-free; pre-tax
  // is valued at the terminal rate — same convention as the ending figure).
  const series = useMemo<WealthPoint[]>(() => {
    if (!result) return [];
    const tr = input.terminalTradRate;
    const conv = new Map(result.converted.points.map((p) => [p.age, p]));
    return result.baseline.points.map((b) => {
      const c = conv.get(b.age);
      const w = (p: typeof b) => p.roth + p.taxable + p.trad * (1 - tr);
      return { age: b.age, baseline: w(b), converted: c ? w(c) : w(b) };
    });
  }, [result, input.terminalTradRate]);

  const rec = result?.convertRecommended;

  // Break the outcome into its parts, and the upfront tax cash the conversions need.
  const breakdown = useMemo(() => {
    if (!result) return null;
    const b = result.baseline;
    const c = result.converted;
    const incomeTaxSaved = b.lifetimeIncomeTax - c.lifetimeIncomeTax;
    const irmaaSaved = b.lifetimeIrmaa - c.lifetimeIrmaa;
    const acaLost = b.lifetimeAcaSubsidy - c.lifetimeAcaSubsidy;

    // Cash to fund the conversions = extra income tax during conversion years,
    // paid from the taxable account.
    const baseByAge = new Map(b.points.map((p) => [p.age, p]));
    let cashNeeded = 0;
    let peakYear = 0;
    let peakAge = 0;
    let firstConvAge = 0;
    let lastConvAge = 0;
    for (const p of c.points) {
      if (p.conversion > 0) {
        if (!firstConvAge) firstConvAge = p.age;
        lastConvAge = p.age;
        const bp = baseByAge.get(p.age);
        const extra = p.federalTax + p.stateTax - (bp ? bp.federalTax + bp.stateTax : 0);
        cashNeeded += extra;
        if (extra > peakYear) { peakYear = extra; peakAge = p.age; }
      }
    }
    return { incomeTaxSaved, irmaaSaved, acaLost, cashNeeded, peakYear, peakAge, firstConvAge, lastConvAge,
      startingTaxable: input.taxableBalance };
  }, [result, input.taxableBalance]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lifetime Roth strategy</h1>
          <p className="mt-1 text-sm opacity-70">
            Convert in the low-income years vs. do nothing — over your whole retirement, in today&apos;s dollars.
          </p>
        </div>
        <Link href="/roth" className="text-sm underline underline-offset-4">← Single-year</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Inputs */}
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="text-sm">
            <span className="mb-1 block opacity-70">Filing status</span>
            <div className="grid grid-cols-2 gap-2">
              <Choice label="Married joint" active={married} onClick={() => set('filingStatus')('MARRIED_JOINT')} />
              <Choice label="Single" active={!married} onClick={() => set('filingStatus')('SINGLE')} />
            </div>
          </div>

          <Section title="Ages" />
          <div className={married ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
            <Num label="Your age" value={input.currentAge} onChange={set('currentAge')} min={40} max={90} />
            {married && <Num label="Spouse" value={input.spouseAge} onChange={set('spouseAge')} min={40} max={90} />}
            <Num label="Plan to" value={input.planThroughAge} onChange={set('planThroughAge')} min={70} max={100} />
          </div>

          <Section title="Accounts (today's $)" />
          <Num label="Pre-tax (Traditional)" value={input.tradBalance} onChange={set('tradBalance')} min={0} step={25000} prefix="$" />
          <Num label="Roth" value={input.rothBalance} onChange={set('rothBalance')} min={0} step={10000} prefix="$" />
          <Num label="Taxable brokerage" value={input.taxableBalance} onChange={set('taxableBalance')} min={0} step={10000} prefix="$" />

          <Section title="Income" />
          <Num label="Annual pension" value={input.annualPension} onChange={set('annualPension')} min={0} step={1000} prefix="$" />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Annual Social Security" value={input.annualSocialSecurity} onChange={set('annualSocialSecurity')} min={0} step={1000} prefix="$" />
            <Num label="Claim age" value={input.ssClaimAge} onChange={set('ssClaimAge')} min={62} max={70} />
          </div>

          <Section title="Assumptions" />
          <div className="grid grid-cols-2 gap-2">
            <Pct label="Return" value={input.investmentReturn} onChange={set('investmentReturn')} max={15} />
            <Pct label="Inflation" value={input.inflationRate} onChange={set('inflationRate')} max={10} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Pct label="State tax" value={input.stateTaxRate} onChange={set('stateTaxRate')} max={15} />
            <Pct label="Heir/terminal rate" value={input.terminalTradRate} onChange={set('terminalTradRate')} max={50} />
          </div>

          <Section title="Conversion strategy" />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Convert from age" value={input.convStartAge} onChange={set('convStartAge')} min={40} max={90} />
            <Num label="through age" value={input.convEndAge} onChange={set('convEndAge')} min={40} max={90} />
          </div>
          <Num label="Fill taxable income up to" value={input.targetTaxableIncome} onChange={set('targetTaxableIncome')} min={0} step={5000} prefix="$"
            hint="Bracket ceiling to fill each year, e.g. 96,950 = top of 12% (MFJ)." />

          {married && (
            <>
              <Section title="Survivor (widow's penalty)" />
              <div className="grid grid-cols-2 gap-2">
                <Num label="First death at age" value={input.firstDeathAge} onChange={set('firstDeathAge')} min={0} max={100}
                  hint="0 = both live to horizon." />
                <Num label="Survivor's SS" value={input.survivorSocialSecurity} onChange={set('survivorSocialSecurity')} min={0} step={1000} prefix="$" />
              </div>
            </>
          )}

          <Section title="ACA coverage (pre-65)" />
          <div className="grid grid-cols-2 gap-2">
            <Choice label="On marketplace" active={input.acaCoverage} onClick={() => set('acaCoverage')(true)} />
            <Choice label="Not on ACA" active={!input.acaCoverage} onClick={() => set('acaCoverage')(false)} />
          </div>
          {input.acaCoverage && (
            <div className="grid grid-cols-2 gap-2">
              <Num label="Benchmark premium/yr" value={input.acaBenchmarkAnnual} onChange={set('acaBenchmarkAnnual')} min={0} step={1000} prefix="$" />
              <Num label="Household size" value={input.acaHouseholdSize} onChange={set('acaHouseholdSize')} min={1} max={10} />
            </div>
          )}
        </form>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <>
              <div className={`rounded-lg border p-4 ${
                rec ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'
              } ${busy ? 'opacity-60' : ''}`}>
                <div className="text-xs uppercase tracking-wide opacity-60">Bottom line</div>
                <div className="mt-1 text-2xl font-semibold">
                  {rec
                    ? `Converting leaves ${money(result.endingWealthAdvantage)} more`
                    : `Converting costs ${money(Math.abs(result.endingWealthAdvantage))}`}
                </div>
                <p className="mt-1 text-sm opacity-70">
                  You convert {money(result.converted.totalConverted)} over ages{' '}
                  {breakdown?.firstConvAge}–{breakdown?.lastConvAge}. RMDs begin at age {result.rmdStartAge}.
                </p>

                {breakdown && (
                  <dl className="mt-3 space-y-1.5 border-t border-black/10 pt-3 text-sm dark:border-white/10">
                    <Line label="Federal + state income tax saved" value={breakdown.incomeTaxSaved} good />
                    <Line label="Medicare IRMAA saved" value={breakdown.irmaaSaved} good />
                    {input.acaCoverage && breakdown.acaLost !== 0 && (
                      <Line label="ACA subsidies forfeited" value={-breakdown.acaLost} good={false} />
                    )}
                    <div className="mt-1 flex items-baseline justify-between border-t border-black/10 pt-1.5 font-semibold dark:border-white/10">
                      <span>Net effect on ending wealth</span>
                      <span className={rec ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}>
                        {rec ? '+' : '−'}{money(Math.abs(result.endingWealthAdvantage))}
                      </span>
                    </div>
                  </dl>
                )}
              </div>

              {breakdown && breakdown.cashNeeded > 0 && (
                <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                  <div className="text-xs uppercase tracking-wide opacity-60">
                    Cash you need to do this
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold">{money(breakdown.cashNeeded)}</span>
                    <span className="text-sm opacity-70">in conversion taxes, total</span>
                  </div>
                  <p className="mt-1 text-sm opacity-70">
                    Spread over ages {breakdown.firstConvAge}–{breakdown.lastConvAge}, with the biggest single year
                    about {money(breakdown.peakYear)} at age {breakdown.peakAge}. Paid from your taxable account
                    (starting balance {money(breakdown.startingTaxable)}) — ideally you cover the tax from outside
                    the IRA so the full conversion lands in the Roth.
                  </p>
                  {breakdown.cashNeeded > breakdown.startingTaxable && (
                    <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
                      ⚠️ The total conversion tax exceeds your taxable balance — you may not have enough outside
                      cash to pay it, which weakens the strategy. Consider converting less each year.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <Compare label="Lifetime income tax"
                  base={result.baseline.lifetimeIncomeTax} conv={result.converted.lifetimeIncomeTax} />
                <Compare label="Lifetime IRMAA"
                  base={result.baseline.lifetimeIrmaa} conv={result.converted.lifetimeIrmaa} />
                <Compare label="Ending after-tax wealth"
                  base={result.baseline.endingAfterTaxWealth} conv={result.converted.endingAfterTaxWealth} higherIsBetter />
              </div>

              {input.acaCoverage && result.baseline.lifetimeAcaSubsidy > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <strong>ACA tradeoff:</strong> converting in the pre-65 years forfeits{' '}
                  {money(result.baseline.lifetimeAcaSubsidy - result.converted.lifetimeAcaSubsidy)} of marketplace
                  subsidies (you&apos;d keep {money(result.converted.lifetimeAcaSubsidy)} vs{' '}
                  {money(result.baseline.lifetimeAcaSubsidy)}). That cost is already netted into the wealth
                  comparison above.
                </div>
              )}

              {married && input.firstDeathAge > 0 && (
                <div className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
                  <strong>Widow&apos;s penalty modeled:</strong> from age {input.firstDeathAge} the survivor files
                  Single on nearly the same RMDs — compressed brackets and halved IRMAA thresholds. Converting
                  before then shifts income out of those higher-taxed years.
                </div>
              )}

              <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="mb-2 text-sm font-medium">After-tax net worth over the plan</div>
                <LifetimeWealthChart series={series} />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <Bucket label="Ending pre-tax" base={result.baseline.endingTrad} conv={result.converted.endingTrad} />
                <Bucket label="Ending Roth" base={result.baseline.endingRoth} conv={result.converted.endingRoth} />
                <Bucket label="Ending taxable" base={result.baseline.endingTaxable} conv={result.converted.endingTaxable} />
              </div>

              <p className="text-xs opacity-50">
                Today&apos;s dollars, {percent(input.investmentReturn)} return, {percent(input.inflationRate)} inflation.
                Models 2025 federal brackets, RMDs (start age {result.rmdStartAge}), Social Security taxation, NIIT,
                IRMAA, ACA subsidies, the survivor filing-status change, and a flat state tax — with the non-indexed
                SS/IRMAA/NIIT thresholds eroding in real terms over time. Pension and Social Security fund living
                expenses (tax inputs only); RMDs not needed for spending are reinvested; taxes are paid from the
                taxable account. Excludes AMT, the Roth 5-year rule, and state rules beyond a flat rate. Not tax advice.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <div className="pt-2 text-xs font-semibold uppercase tracking-wide opacity-40">{title}</div>;
}

/** One line in the savings breakdown: positive = a saving, negative = a cost. */
function Line({ label, value, good }: { label: string; value: number; good: boolean }) {
  const positive = value >= 0;
  return (
    <div className="flex items-baseline justify-between">
      <span className="opacity-70">{label}</span>
      <span className={good && positive ? 'text-emerald-600 dark:text-emerald-400' : positive ? '' : 'text-amber-600'}>
        {positive ? '+' : '−'}{money(Math.abs(value))}
      </span>
    </div>
  );
}

function Compare({ label, base, conv, higherIsBetter = false }: {
  label: string; base: number; conv: number; higherIsBetter?: boolean;
}) {
  const better = higherIsBetter ? conv > base : conv < base;
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-1 text-lg font-semibold">{money(conv)}</div>
      <div className={`mt-0.5 text-xs ${better ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-50'}`}>
        vs {money(base)} baseline
      </div>
    </div>
  );
}

function Bucket({ label, base, conv }: { label: string; base: number; conv: number }) {
  return (
    <div className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10">
      <div className="opacity-60">{label}</div>
      <div className="mt-0.5 flex justify-between">
        <span>{money(conv)}</span>
        <span className="opacity-50">was {money(base)}</span>
      </div>
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

function Num({ label, value, onChange, min, max, step = 1, prefix, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; prefix?: string; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        {prefix && <span className="pl-2 text-sm opacity-50">{prefix}</span>}
        <input type="number" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-2 py-2 outline-none" />
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}

function Pct({ label, value, onChange, max = 30 }: {
  label: string; value: number; onChange: (v: number) => void; max?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} min={0} max={max} step={0.1}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-2 py-2 outline-none" />
        <span className="pr-2 text-sm opacity-50">%</span>
      </div>
    </label>
  );
}
