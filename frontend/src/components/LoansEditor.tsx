'use client';

import { useEffect, useRef, useState } from 'react';
import { api, type Loan, type LoanAmortization, type RetirementProfile } from '@/src/lib/api';
import { money } from '@/src/lib/format';

const NEW_LOAN: Loan = {
  label: '', balance: 0, annualRate: 0.05, monthlyPayment: 0, startAge: 0,
  extraMonthly: 0, lumpSums: '', paymentAnnualIncreasePct: 0,
  refinanceAge: 0, refinanceRate: 0, refinanceTermYears: 0,
};

/**
 * The detailed loan modeler: each loan editable with extra payments, lump sums,
 * a rising payment, and a refinance, alongside a live monthly amortization
 * schedule and payoff summary. Loans live on the profile; this component just
 * edits `profile.loans` (via onLoansChange) and computes schedules for preview.
 */
export default function LoansEditor({ profile, onLoansChange }: {
  profile: RetirementProfile; onLoansChange: (loans: Loan[]) => void;
}) {
  const [schedules, setSchedules] = useState<LoanAmortization[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loans = profile.loans || [];

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.loanAmortization(profile).then(setSchedules).catch(() => setSchedules([]));
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(loans), profile.currentAge, profile.planThroughAge]);

  const updateLoan = (i: number, patch: Partial<Loan>) =>
    onLoansChange(loans.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLoan = () => onLoansChange([...loans, { ...NEW_LOAN }]);
  const removeLoan = (i: number) => onLoansChange(loans.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-70">
        Model each debt in detail — extra payments, lump sums, a rising payment, or a refinance —
        and see the full amortization and what it saves. Balances and payments are nominal (actual)
        dollars. The monthly payment is <strong>Principal &amp; Interest only</strong> — exclude escrow
        (property taxes and insurance); model those as a separate expense.
      </p>

      {loans.length === 0 && (
        <div className="rounded-lg border border-white/10 p-6 text-center text-sm opacity-70">
          No loans yet. Add a mortgage, car loan, or student loan to model it.
        </div>
      )}

      {loans.map((loan, i) => (
        <LoanCard
          key={i}
          loan={loan}
          currentAge={profile.currentAge}
          schedule={schedules[i]}
          onChange={(patch) => updateLoan(i, patch)}
          onRemove={() => removeLoan(i)}
        />
      ))}

      <button type="button" onClick={addLoan} className="text-sm underline underline-offset-4">
        + Add loan
      </button>
    </div>
  );
}

function LoanCard({ loan, currentAge, schedule, onChange, onRemove }: {
  loan: Loan; currentAge: number; schedule?: LoanAmortization;
  onChange: (patch: Partial<Loan>) => void; onRemove: () => void;
}) {
  const [showTable, setShowTable] = useState(false);
  const s = schedule?.summary;

  return (
    <section className="rounded-lg border border-white/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <input
          type="text" value={loan.label} placeholder="Loan name (e.g. Mortgage)"
          onChange={(e) => onChange({ label: e.target.value })}
          className="w-full max-w-sm bg-transparent text-lg font-medium outline-none placeholder:opacity-40"
        />
        <button type="button" onClick={onRemove} className="shrink-0 text-sm text-red-400 underline underline-offset-4">
          Remove
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Num label="Balance owed" value={loan.balance} onChange={(v) => onChange({ balance: v })} step={1000} prefix="$" />
        <Pct label="Interest rate" value={loan.annualRate} onChange={(v) => onChange({ annualRate: v })} max={30} />
        <Num label="Monthly payment (P&I)" value={loan.monthlyPayment} onChange={(v) => onChange({ monthlyPayment: v })} step={50} prefix="$"
          hint="Principal & Interest only — not escrow." />
        <Num label="Starts at your age (0 = now)" value={loan.startAge} onChange={(v) => onChange({ startAge: v })} />
      </div>

      <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide opacity-40">Pay it down faster</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Num label="Extra principal / month" value={loan.extraMonthly} onChange={(v) => onChange({ extraMonthly: v })} step={50} prefix="$"
          hint="Added to every payment." />
        <Pct label="Payment increase / year" value={loan.paymentAnnualIncreasePct} onChange={(v) => onChange({ paymentAnnualIncreasePct: v })} max={20}
          hint="Payment steps up this % annually." />
      </div>

      <LumpSumEditor value={loan.lumpSums} currentAge={currentAge} onChange={(v) => onChange({ lumpSums: v })} />

      <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide opacity-40">Refinance (optional)</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Num label="Refinance at your age (0 = none)" value={loan.refinanceAge} onChange={(v) => onChange({ refinanceAge: v })} />
        <Pct label="New rate" value={loan.refinanceRate} onChange={(v) => onChange({ refinanceRate: v })} max={30} />
        <Num label="New term (years, 0 = keep payment)" value={loan.refinanceTermYears} onChange={(v) => onChange({ refinanceTermYears: v })} />
      </div>

      {s && (
        <div className="mt-5 rounded-lg bg-white/5 p-4">
          <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Stat label="Paid off at age" value={s.payoffAge != null ? String(s.payoffAge) : 'not within horizon'} />
            <Stat label="Time to payoff" value={monthsLabel(s.payoffMonths)} />
            <Stat label="Total interest" value={money(s.totalInterest)} />
            <Stat label="Total paid" value={money(s.totalPaid)} />
          </div>
          {(s.interestSaved > 0 || s.monthsSaved > 0) && (
            <p className="mt-3 text-sm text-cyan-300">
              vs. minimum payments: save {money(s.interestSaved)} in interest
              {s.monthsSaved > 0 && <> and pay off {monthsLabel(s.monthsSaved)} sooner</>}.
            </p>
          )}
        </div>
      )}

      {schedule && schedule.rows.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowTable((v) => !v)}
            className="text-sm underline underline-offset-4">
            {showTable ? 'Hide' : 'Show'} amortization schedule ({schedule.rows.length} payments)
          </button>
          {showTable && (
            <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-right text-xs tabular-nums">
                <thead className="sticky top-0 bg-[var(--surface-2)]">
                  <tr className="opacity-70">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2">Age</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2">Principal</th>
                    <th className="px-3 py-2">Interest</th>
                    <th className="px-3 py-2">Extra</th>
                    <th className="px-3 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.rows.map((r) => (
                    <tr key={r.monthIndex} className="border-t border-white/5">
                      <td className="px-3 py-1.5 text-left opacity-50">{r.monthIndex}</td>
                      <td className="px-3 py-1.5 opacity-70">{r.age}</td>
                      <td className="px-3 py-1.5">{money(r.payment)}</td>
                      <td className="px-3 py-1.5">{money(r.principal)}</td>
                      <td className="px-3 py-1.5 opacity-70">{money(r.interest)}</td>
                      <td className="px-3 py-1.5 text-cyan-300">{r.extra > 0 ? money(r.extra) : '—'}</td>
                      <td className="px-3 py-1.5 font-medium">{money(r.endingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LumpSumEditor({ value, currentAge, onChange }: {
  value: string; currentAge: number; onChange: (v: string) => void;
}) {
  const parsed = parseLumps(value);
  const add = () => onChange(serializeLumps([...parsed, { age: currentAge || 0, amount: 0 }]));
  const update = (i: number, patch: Partial<{ age: number; amount: number }>) =>
    onChange(serializeLumps(parsed.map((l, idx) => (idx === i ? { ...l, ...patch } : l))));
  const remove = (i: number) => onChange(serializeLumps(parsed.filter((_, idx) => idx !== i)));

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm opacity-70">One-time extra payments</span>
        <button type="button" onClick={add} className="text-sm underline underline-offset-4">+ Add lump sum</button>
      </div>
      {parsed.length === 0 && <p className="mt-1 text-xs opacity-45">None. Add a bonus, inheritance, or windfall applied to principal.</p>}
      <div className="mt-2 space-y-2">
        {parsed.map((l, i) => (
          <div key={i} className="flex items-end gap-3">
            <Num label="At your age" value={l.age} onChange={(v) => update(i, { age: v })} />
            <Num label="Amount" value={l.amount} onChange={(v) => update(i, { amount: v })} step={1000} prefix="$" />
            <button type="button" onClick={() => remove(i)} className="mb-2 text-sm text-red-400 underline underline-offset-4">Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseLumps(spec: string): { age: number; amount: number }[] {
  if (!spec) return [];
  return spec.split(/[;,]/).map((part) => {
    const [a, amt] = part.split(':');
    return { age: Number(a) || 0, amount: Number(amt) || 0 };
  }).filter((l) => l.age > 0 || l.amount > 0);
}
function serializeLumps(lumps: { age: number; amount: number }[]): string {
  return lumps.filter((l) => l.amount > 0 && l.age > 0).map((l) => `${l.age}:${l.amount}`).join(';');
}

function monthsLabel(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr ${m} mo`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs opacity-50">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Num({ label, value, onChange, step = 1, prefix, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-white/15 focus-within:border-white/40">
        {prefix && <span className="pl-3 text-sm opacity-50">{prefix}</span>}
        <input type="number" value={Number.isFinite(value) ? value : ''} step={step} min={0}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-full bg-transparent px-3 py-2 outline-none" />
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}

function Pct({ label, value, onChange, max = 30, hint }: {
  label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-white/15 focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} min={0} max={max} step={0.1}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-3 py-2 outline-none" />
        <span className="pr-3 text-sm opacity-50">%</span>
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}
