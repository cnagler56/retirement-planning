'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  DEFAULT_PROFILE,
  type LedgerResult,
  type LedgerRow,
  type RetirementProfile,
} from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfileWithAccounts } from '@/src/lib/profileStore';
import {
  deleteScenario as removeScenario,
  listScenarios,
  saveScenario,
  type Scenario,
} from '@/src/lib/scenarioStore';
import { money } from '@/src/lib/format';
import NumericInput from '@/src/components/NumericInput';

const STEP_YEARS = 5;
const CLAIM_AGES = Array.from({ length: 9 }, (_, i) => 62 + i);

type Key = keyof RetirementProfile;

export default function ScenariosPage() {
  const { user } = useUser();
  const [base, setBase] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [whatIf, setWhatIf] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [baseLedger, setBaseLedger] = useState<LedgerResult | null>(null);
  const [whatIfLedger, setWhatIfLedger] = useState<LedgerResult | null>(null);
  const [saved, setSaved] = useState<Scenario[]>([]);
  const [activeId, setActiveId] = useState<number>(0);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The current plan (left) comes from the saved profile + accounts; the what-if starts as a copy.
  useEffect(() => {
    if (!user) return;
    loadProfileWithAccounts(user.userId)
      .then(({ profile: p }) => {
        if (!p) return;
        const full = { ...DEFAULT_PROFILE, ...p };
        setBase(full);
        setWhatIf(full);
      })
      .catch(() => {});
    listScenarios(user.userId).then(setSaved).catch(() => {});
  }, [user]);

  useEffect(() => {
    api.ledger(base).then(setBaseLedger).catch(() => setBaseLedger(null));
  }, [base]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      api.ledger(whatIf).then(setWhatIfLedger).catch(() => setWhatIfLedger(null));
    }, 300);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [whatIf]);

  const set = <K extends Key>(k: K) => (v: RetirementProfile[K]) => setWhatIf((prev) => ({ ...prev, [k]: v }));
  const changed = (k: Key) => JSON.stringify(whatIf[k]) !== JSON.stringify(base[k]);
  const changedCount = (Object.keys(whatIf) as Key[]).filter(changed).length;
  const married = whatIf.filingStatus === 'MARRIED_JOINT';

  // Shared ages so the two tables line up row for row: every 5 years from the
  // earliest row either plan has (today, when working years are modeled; otherwise
  // the earlier retirement age), plus the final plan year.
  const ages = useMemo(() => {
    const firsts = [baseLedger?.rows[0]?.age, whatIfLedger?.rows[0]?.age].filter((a): a is number => a != null);
    const start = firsts.length ? Math.min(...firsts) : Math.min(base.retirementAge, whatIf.retirementAge);
    const end = Math.max(baseLedger?.rows.at(-1)?.age ?? 0, whatIfLedger?.rows.at(-1)?.age ?? 0);
    const out: number[] = [];
    for (let a = start; a <= end; a += STEP_YEARS) out.push(a);
    if (end > 0 && out.at(-1) !== end) out.push(end);
    return out;
  }, [base.retirementAge, whatIf.retirementAge, baseLedger, whatIfLedger]);

  function loadSaved(id: number) {
    setActiveId(id);
    const s = saved.find((x) => x.id === id);
    if (s) { setWhatIf({ ...DEFAULT_PROFILE, ...s.inputs }); setName(s.name); }
    else { setWhatIf(base); setName(''); }
  }

  async function onSave() {
    if (!user) return;
    setSaving(true);
    try {
      const existing = saved.find((x) => x.id === activeId);
      const s = await saveScenario(user.userId, {
        id: existing?.id ?? 0,
        name: name.trim() || `Scenario ${saved.length + 1}`,
        inputs: whatIf,
      });
      setSaved((prev) => (existing ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s]));
      setActiveId(s.id);
      setName(s.name);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!user) return;
    const s = saved.find((x) => x.id === activeId);
    if (!s) return;
    await removeScenario(user.userId, s).catch(() => {});
    setSaved((prev) => prev.filter((x) => x.id !== s.id));
    loadSaved(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare scenarios</h1>
          <p className="mt-1 text-sm opacity-70">
            Change any factor below and see how your year-by-year plan shifts. Today&apos;s dollars, every {STEP_YEARS} years.
            {!user && <> <Link href="/signin" className="underline underline-offset-4">Sign in</Link> to start from your own plan.</>}
          </p>
        </div>
        <Link href="/ledger" className="text-sm underline underline-offset-4">Full year-by-year →</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      {/* What-if levers: a narrow sidebar that stays in view while the tables update */}
      <aside className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">What if…</h2>
            <button onClick={() => setWhatIf(base)} disabled={changedCount === 0}
              className="rounded-md border border-black/15 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/15">
              Reset to my plan
            </button>
          </div>
          <div className="text-xs opacity-60">
            {changedCount === 0 ? 'Matches your current plan' : `${changedCount} change${changedCount === 1 ? '' : 's'} from your current plan`}
          </div>
          <div className="space-y-2 text-sm">
            {user && (
              <>
                <select value={activeId} onChange={(e) => loadSaved(Number(e.target.value))} aria-label="Saved scenarios"
                  className="w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 dark:border-white/15">
                  <option value={0} className="bg-white text-black dark:bg-neutral-900 dark:text-white">New scenario</option>
                  {saved.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{s.name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name" aria-label="Scenario name"
                    className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-2 py-1.5 outline-none dark:border-white/15" />
                  <button onClick={onSave} disabled={saving} className="rounded-md px-3 py-1.5 font-medium disabled:opacity-50"
                    style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                    {saving ? 'Saving…' : activeId ? 'Update' : 'Save'}
                  </button>
                </div>
                {activeId !== 0 && <button onClick={onDelete} className="text-xs text-red-500">Delete this scenario</button>}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
          <Group title="Timing">
            <Num label="Retire at age" value={whatIf.retirementAge} onChange={set('retirementAge')} changed={changed('retirementAge')} />
            {married && (
              <Num label="Spouse retires at age" value={whatIf.spouseRetirementAge} onChange={set('spouseRetirementAge')} changed={changed('spouseRetirementAge')} />
            )}
            <Num label="Plan through age" value={whatIf.planThroughAge} onChange={set('planThroughAge')} changed={changed('planThroughAge')} />
            <Sel label="Claim Social Security at" value={whatIf.ssClaimAge || 67} options={CLAIM_AGES}
              onChange={set('ssClaimAge')} changed={changed('ssClaimAge')} />
            {married && (
              <Sel label="Spouse claims at" value={whatIf.spouseSsClaimAge || 67} options={CLAIM_AGES}
                onChange={set('spouseSsClaimAge')} changed={changed('spouseSsClaimAge')} />
            )}
          </Group>

          <Group title="Savings">
            {/* With no itemized buckets the ledger runs off the single savings total. */}
            {base.tradBalance + base.rothBalance + base.taxableBalance <= 0 && (
              <Num label="Retirement savings (total)" prefix="$" step={5000} value={whatIf.currentSavings}
                onChange={set('currentSavings')} changed={changed('currentSavings')} />
            )}
            <Num label="Pre-tax balance" prefix="$" step={5000} value={whatIf.tradBalance} onChange={set('tradBalance')} changed={changed('tradBalance')} />
            <Num label="Roth balance" prefix="$" step={5000} value={whatIf.rothBalance} onChange={set('rothBalance')} changed={changed('rothBalance')} />
            <Num label="Taxable balance" prefix="$" step={5000} value={whatIf.taxableBalance} onChange={set('taxableBalance')} changed={changed('taxableBalance')} />
            <Num label="Monthly saving (until retiring)" prefix="$" step={50} value={whatIf.monthlyContribution}
              onChange={set('monthlyContribution')} changed={changed('monthlyContribution')} />
          </Group>

          <Group title="Income">
            <Num label="Your SS at full retirement age (monthly)" prefix="$" step={50} value={whatIf.ssMonthlyAtFra}
              onChange={set('ssMonthlyAtFra')} changed={changed('ssMonthlyAtFra')} />
            {married && (
              <Num label="Spouse SS at full retirement age (monthly)" prefix="$" step={50} value={whatIf.spouseSsMonthlyAtFra}
                onChange={set('spouseSsMonthlyAtFra')} changed={changed('spouseSsMonthlyAtFra')} />
            )}
            <Pct label="Social Security COLA" value={whatIf.ssColaRate ?? whatIf.inflationRate}
              onChange={set('ssColaRate')} changed={changed('ssColaRate')} />
            <Num label="Pension (annual)" prefix="$" step={1000} value={whatIf.annualPension} onChange={set('annualPension')} changed={changed('annualPension')} />
          </Group>

          <Group title="Spending">
            <Num label="Annual spending (all-in)" prefix="$" step={1000} value={whatIf.desiredAnnualIncome}
              onChange={set('desiredAnnualIncome')} changed={changed('desiredAnnualIncome')} />
            <Num label="Healthcare (annual)" prefix="$" step={500} value={whatIf.annualHealthcareCost}
              onChange={set('annualHealthcareCost')} changed={changed('annualHealthcareCost')} />
            <Pct label="Healthcare inflation" value={whatIf.healthcareInflationRate}
              onChange={set('healthcareInflationRate')} changed={changed('healthcareInflationRate')} />
          </Group>

          <Group title="Markets">
            <Pct label="Investment return" value={whatIf.annualReturnRate} onChange={set('annualReturnRate')} changed={changed('annualReturnRate')} />
            <Pct label="Inflation" value={whatIf.inflationRate} onChange={set('inflationRate')} changed={changed('inflationRate')} />
          </Group>

          <Group title="Taxes & withdrawals">
            <Choice label="Filing status" value={whatIf.filingStatus} changed={changed('filingStatus')}
              onChange={(v) => set('filingStatus')(v as RetirementProfile['filingStatus'])}
              options={[['MARRIED_JOINT', 'Married joint'], ['SINGLE', 'Single']]} />
            <Pct label="State tax rate" value={whatIf.stateTaxRate} onChange={set('stateTaxRate')} changed={changed('stateTaxRate')} />
            <Choice label="Withdrawal order" value={whatIf.withdrawalStrategy ?? 'CONVENTIONAL'} changed={changed('withdrawalStrategy')}
              onChange={set('withdrawalStrategy')}
              options={[['CONVENTIONAL', 'Taxable → pre-tax → Roth'], ['PROPORTIONAL', 'Proportional'], ['TAX_EFFICIENT', 'Tax-efficient']]} />
            {whatIf.withdrawalStrategy === 'TAX_EFFICIENT' && (
              <Choice label="Fill pre-tax up to" value={String(whatIf.withdrawalBracketPct ?? 12)} changed={changed('withdrawalBracketPct')}
                onChange={(v) => set('withdrawalBracketPct')(Number(v))}
                options={[['12', 'Top of 12% bracket'], ['22', 'Top of 22% bracket']]} />
            )}
          </Group>

          <Group title="Long-term care">
            <Toggle label="Model a long-term-care need" value={whatIf.ltcEnabled} onChange={set('ltcEnabled')} changed={changed('ltcEnabled')} />
            {whatIf.ltcEnabled && (
              <>
                <Num label="LTC cost (annual)" prefix="$" step={5000} value={whatIf.ltcAnnualCost} onChange={set('ltcAnnualCost')} changed={changed('ltcAnnualCost')} />
                <Num label="Starting at age" value={whatIf.ltcStartAge} onChange={set('ltcStartAge')} changed={changed('ltcStartAge')} />
                <Num label="For years" value={whatIf.ltcYears} onChange={set('ltcYears')} changed={changed('ltcYears')} />
              </>
            )}
          </Group>

          {married && (
            <Group title="Survivor">
              <Num label="Your age at first death (0 = not modeled)" value={whatIf.firstDeathAge ?? 0}
                onChange={set('firstDeathAge')} changed={changed('firstDeathAge')} />
              {(whatIf.firstDeathAge ?? 0) > 0 && (
                <Pct label="Survivor spending (% of couple's)" value={whatIf.survivorSpendingFactor ?? 1} max={100}
                  onChange={set('survivorSpendingFactor')} changed={changed('survivorSpendingFactor')} />
              )}
            </Group>
          )}
        </div>
        <p className="mt-4 text-xs opacity-55">
          Income streams, itemized expenses, loans, and one-time events come from your{' '}
          <Link href="/profile" className="underline underline-offset-4">profile</Link> and apply to both sides.
        </p>
      </aside>

      {/* Side-by-side year-by-year */}
      <div className="space-y-4">
        <div className="grid gap-6 xl:grid-cols-2">
          <PlanTable title="Your current plan" ledger={baseLedger} ages={ages} />
          <PlanTable title="What if" ledger={whatIfLedger} ages={ages} compareTo={baseLedger} accent />
        </div>
        <p className="text-xs opacity-50">
          <strong>Income</strong> = Social Security + pension + other income. <strong>From savings</strong> = RMDs + withdrawals
          (in working years, what&apos;s saved instead).
          <strong> Spending</strong> = living + healthcare + loan payments. <strong>Taxes</strong> = federal + state + Medicare IRMAA + payroll.
          Mark your job as a <Link href="/profile" className="underline underline-offset-4">paycheck</Link> so
          retiring later adds the extra years of pay.
          Deterministic (not Monte Carlo). Not tax advice.
        </p>
      </div>
      </div>
    </div>
  );
}

// ---- results table ---------------------------------------------------------

function PlanTable({ title, ledger, ages, compareTo, accent = false }: {
  title: string; ledger: LedgerResult | null; ages: number[]; compareTo?: LedgerResult | null; accent?: boolean;
}) {
  const byAge = new Map(ledger?.rows.map((r) => [r.age, r]) ?? []);
  const baseByAge = new Map(compareTo?.rows.map((r) => [r.age, r]) ?? []);
  const outcome = !ledger ? '—'
    : ledger.moneyLastsToAge ? `Runs out at ${ledger.moneyLastsToAge}` : `Funded through ${ledger.rows.at(-1)?.age ?? '—'}`;

  return (
    <section className={`rounded-lg border p-4 ${accent ? 'border-cyan-500/40' : 'border-black/10 dark:border-white/10'}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className={`rounded-md border px-2 py-0.5 text-xs ${ledger?.moneyLastsToAge ? 'border-red-500/40 bg-red-500/10' : 'border-black/10 dark:border-white/10'}`}>
          {outcome}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <Th left>Age</Th>
              <Th>Income</Th>
              <Th>From savings</Th>
              <Th>Spending</Th>
              <Th>Taxes</Th>
              <Th>End balance</Th>
            </tr>
          </thead>
          <tbody>
            {ages.map((age) => {
              const r = byAge.get(age);
              const b = baseByAge.get(age);
              return (
                <tr key={age} className={`border-b border-black/5 last:border-0 dark:border-white/5 ${r?.shortfall ? 'bg-red-500/10' : ''}`}>
                  <Td left strong>
                    {age}
                    {r?.working && <span className="ml-1.5 rounded bg-cyan-500/15 px-1 py-0.5 text-[10px] font-normal text-cyan-300">working</span>}
                  </Td>
                  {r ? (
                    <>
                      <Td>{cell(income(r))}</Td>
                      <Td>{r.working && r.saved > 0 && fromSavings(r) === 0
                        ? <span className="text-emerald-500">+{money(r.saved)} saved</span>
                        : cell(fromSavings(r))}</Td>
                      <Td>{cell(spending(r))}</Td>
                      <Td>{cell(taxes(r))}</Td>
                      <Td strong>
                        {r.shortfall ? '$0' : money(r.endTotal)}
                        {compareTo && <Delta now={r.shortfall ? 0 : r.endTotal} was={b ? (b.shortfall ? 0 : b.endTotal) : null} />}
                      </Td>
                    </>
                  ) : (
                    <td colSpan={5} className="p-2 text-center opacity-40">{ledger ? 'still working' : '…'}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const income = (r: LedgerRow) => r.socialSecurity + r.pension + r.otherIncome;
const fromSavings = (r: LedgerRow) => r.rmd + r.withdrawal;
const spending = (r: LedgerRow) => r.livingExpenses + r.healthcare + r.loanPayment;
const taxes = (r: LedgerRow) => r.federalTax + r.stateTax + r.irmaa + r.payrollTax;

function cell(v: number) {
  return v > 0 ? money(v) : <span className="opacity-30">—</span>;
}

function Delta({ now, was }: { now: number; was: number | null }) {
  if (was == null) return null;
  const d = now - was;
  if (Math.abs(d) < 1) return null;
  return (
    <span className={`block text-[10px] font-normal ${d > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
      {d > 0 ? '+' : '−'}{money(Math.abs(d))}
    </span>
  );
}

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={`p-2 font-medium opacity-60 ${left ? 'text-left' : 'text-right'}`}>{children}</th>;
}

function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={`p-2 align-top ${left ? 'text-left' : 'text-right'} ${strong ? 'font-semibold' : ''}`}>{children}</td>;
}

// ---- lever inputs ----------------------------------------------------------

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide opacity-60">{title}</div>
      {children}
    </div>
  );
}

// A changed lever gets a cyan border so it's clear what differs from the current plan.
const box = (changed: boolean) =>
  `flex items-center rounded-md border ${changed ? 'border-cyan-400' : 'border-black/15 dark:border-white/15'} focus-within:border-black/40 dark:focus-within:border-white/40`;

function Label({ text, changed }: { text: string; changed: boolean }) {
  return <span className={`mb-1 block ${changed ? 'text-cyan-400' : 'opacity-60'}`}>{text}</span>;
}

function Num({ label, value, onChange, changed, step = 1, prefix }: {
  label: string; value: number; onChange: (v: number) => void; changed: boolean; step?: number; prefix?: string;
}) {
  return (
    <label className="block text-xs">
      <Label text={label} changed={changed} />
      <div className={box(changed)}>
        {prefix && <span className="pl-2 opacity-50">{prefix}</span>}
        <NumericInput value={value} step={step} min={0} onChange={onChange} ariaLabel={label}
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none" />
      </div>
    </label>
  );
}

function Pct({ label, value, onChange, changed, max = 15 }: {
  label: string; value: number; onChange: (v: number) => void; changed: boolean; max?: number;
}) {
  return (
    <label className="block text-xs">
      <Label text={label} changed={changed} />
      <div className={box(changed)}>
        <input type="number" value={Math.round(value * 1000) / 10} step={0.1} min={0} max={max}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-2 py-1.5 text-sm outline-none" />
        <span className="pr-2 opacity-50">%</span>
      </div>
    </label>
  );
}

function Sel({ label, value, onChange, options, changed }: {
  label: string; value: number; onChange: (v: number) => void; options: number[]; changed: boolean;
}) {
  return (
    <label className="block text-xs">
      <Label text={label} changed={changed} />
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full bg-transparent px-2 py-1.5 text-sm outline-none ${box(changed)}`}>
        {options.map((o) => (
          <option key={o} value={o} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{o}</option>
        ))}
      </select>
    </label>
  );
}

function Choice({ label, value, onChange, options, changed }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][]; changed: boolean;
}) {
  return (
    <label className="block text-xs">
      <Label text={label} changed={changed} />
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-transparent px-2 py-1.5 text-sm outline-none ${box(changed)}`}>
        {options.map(([v, text]) => (
          <option key={v} value={v} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{text}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, value, onChange, changed }: {
  label: string; value: boolean; onChange: (v: boolean) => void; changed: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-xs ${changed ? 'text-cyan-400' : ''}`}>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
