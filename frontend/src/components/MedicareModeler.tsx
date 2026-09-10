'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type FilingStatus, type MedicareEstimateResult } from '@/src/lib/api';
import { money } from '@/src/lib/format';

/** Interactive "what would Medicare cost me?" modeler backed by /api/medicare/estimate. */
export function MedicareModeler() {
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('MARRIED_JOINT');
  const [magi, setMagi] = useState(90000);
  const [people, setPeople] = useState(2);
  const [coverage, setCoverage] = useState<'MEDIGAP' | 'ADVANTAGE'>('MEDIGAP');
  const [supplementMonthly, setSupplementMonthly] = useState(160);
  const [partDMonthly, setPartDMonthly] = useState(40);
  const [outOfPocketAnnual, setOutOfPocketAnnual] = useState(1500);
  const [result, setResult] = useState<MedicareEstimateResult | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.medicareEstimate({
        filingStatus, magi, peopleOnMedicare: people, coverage, supplementMonthly, partDMonthly, outOfPocketAnnual,
      }).then(setResult).catch(() => setResult(null));
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [filingStatus, magi, people, coverage, supplementMonthly, partDMonthly, outOfPocketAnnual]);

  const married = filingStatus === 'MARRIED_JOINT';
  const rows = result
    ? [
        { label: 'Part B premiums', value: result.partB, color: '#0ea5e9' },
        { label: coverage === 'MEDIGAP' ? 'Medigap premiums' : 'Advantage premiums', value: result.supplement, color: '#10b981' },
        { label: 'Part D premiums', value: result.partD, color: '#8b5cf6' },
        { label: 'Out-of-pocket', value: result.outOfPocket, color: '#f59e0b' },
        { label: 'IRMAA surcharge', value: result.irmaa, color: '#ef4444' },
      ]
    : [];
  const max = result ? Math.max(result.total, 1) : 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="text-sm">
          <span className="mb-1 block opacity-70">Filing status</span>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Married" active={married} onClick={() => { setFilingStatus('MARRIED_JOINT'); setPeople(2); }} />
            <Toggle label="Single" active={!married} onClick={() => { setFilingStatus('SINGLE'); setPeople(1); }} />
          </div>
        </div>
        <Num label="Annual income (MAGI)" value={magi} onChange={setMagi} step={5000} prefix="$" />
        {married && (
          <div className="text-sm">
            <span className="mb-1 block opacity-70">People on Medicare</span>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="1" active={people === 1} onClick={() => setPeople(1)} />
              <Toggle label="2" active={people === 2} onClick={() => setPeople(2)} />
            </div>
          </div>
        )}
        <div className="text-sm">
          <span className="mb-1 block opacity-70">Coverage</span>
          <div className="grid grid-cols-2 gap-2">
            <Toggle label="Original + Medigap" active={coverage === 'MEDIGAP'} onClick={() => setCoverage('MEDIGAP')} />
            <Toggle label="Advantage" active={coverage === 'ADVANTAGE'} onClick={() => setCoverage('ADVANTAGE')} />
          </div>
        </div>
        <Num label={coverage === 'MEDIGAP' ? 'Medigap /mo (per person)' : 'Advantage /mo (per person)'}
          value={supplementMonthly} onChange={setSupplementMonthly} prefix="$" />
        <Num label="Part D /mo (per person)" value={partDMonthly} onChange={setPartDMonthly} prefix="$" />
        <Num label="Out-of-pocket /yr (per person)" value={outOfPocketAnnual} onChange={setOutOfPocketAnnual} step={250} prefix="$" />
      </div>

      {/* Results */}
      <div>
        {result && (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{money(result.total)}</span>
              <span className="text-sm opacity-70">per year{married && people === 2 ? ', both of you' : ''}</span>
            </div>
            <div className="mt-1 text-sm opacity-60">≈ {money(Math.round(result.total / 12))}/month</div>

            <div className="mt-4 space-y-2">
              {rows.map((r) => (
                <div key={r.label}>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-70">{r.label}</span>
                    <span className="font-medium">{money(r.value)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-black/5 dark:bg-white/10">
                    <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </div>

            {result.irmaa > 0 && (
              <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm">
                At {money(magi)} income you&apos;re in an IRMAA tier — an extra <strong>{money(result.irmaa)}/yr</strong>.
                Lowering income below the bracket (or converting to Roth earlier) removes it.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function Num({ label, value, onChange, step = 1, prefix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        {prefix && <span className="pl-3 text-sm opacity-50">{prefix}</span>}
        <input type="number" value={Number.isFinite(value) ? value : ''} step={step} min={0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-3 py-2 outline-none" />
      </div>
    </label>
  );
}
