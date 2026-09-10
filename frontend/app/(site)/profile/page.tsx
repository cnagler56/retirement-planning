'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ageFromBirthDate, api, DEFAULT_PROFILE, type IncomeStream, type MedicareEstimateResult, type RetirementProfile, type StateTaxInfo } from '@/src/lib/api';
import { money } from '@/src/lib/format';
import { getStorageMode, loadProfile, saveProfile, type StorageMode } from '@/src/lib/profileStore';
import { useUser } from '@/src/lib/UserContext';

export default function ProfilePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isOnboarding, setIsOnboarding] = useState(false);

  useEffect(() => {
    setIsOnboarding(new URLSearchParams(window.location.search).get('welcome') === '1');
  }, []);

  const [p, setP] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [states, setStates] = useState<StateTaxInfo[]>([]);
  const [mode, setMode] = useState<StorageMode>('server');

  useEffect(() => {
    api.listStates().then(setStates).catch(() => {});
  }, []);

  // Selecting a state defaults the tax rate (still editable afterward).
  const onStateChange = (code: string) => {
    const rate = states.find((s) => s.code === code)?.rate ?? 0;
    setP((prev) => ({ ...prev, state: code, stateTaxRate: rate }));
  };

  // Medicare cost estimator (local to this page; only feeds the healthcare-cost field).
  const [med, setMed] = useState({
    magi: 80000,
    coverage: 'MEDIGAP' as 'MEDIGAP' | 'ADVANTAGE',
    supplementMonthly: 160,
    partDMonthly: 40,
    outOfPocketAnnual: 1500,
  });
  const [medResult, setMedResult] = useState<MedicareEstimateResult | null>(null);
  const medDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const married = p.filingStatus === 'MARRIED_JOINT';

  useEffect(() => {
    if (medDebounce.current) clearTimeout(medDebounce.current);
    medDebounce.current = setTimeout(() => {
      api.medicareEstimate({
        filingStatus: p.filingStatus,
        peopleOnMedicare: married ? 2 : 1,
        ...med,
      }).then(setMedResult).catch(() => setMedResult(null));
    }, 300);
    return () => { if (medDebounce.current) clearTimeout(medDebounce.current); };
  }, [med, p.filingStatus, married]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || loaded) return;
    setMode(getStorageMode(user.userId));
    loadProfile(user.userId)
      .then((saved) => { if (saved) setP({ ...DEFAULT_PROFILE, ...saved }); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [user, loaded]);

  const set = <K extends keyof RetirementProfile>(key: K) => (value: RetirementProfile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const addStream = () =>
    setP((prev) => ({
      ...prev,
      incomeStreams: [
        ...(prev.incomeStreams || []),
        { label: '', annualAmount: 0, startAge: ageFromBirthDate(prev.birthDate), endAge: 0, inflationAdjusted: true },
      ],
    }));
  const updateStream = (i: number, patch: Partial<IncomeStream>) =>
    setP((prev) => ({
      ...prev,
      incomeStreams: prev.incomeStreams.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));
  const removeStream = (i: number) =>
    setP((prev) => ({ ...prev, incomeStreams: prev.incomeStreams.filter((_, idx) => idx !== i) }));

  async function onSave() {
    if (!user) return;
    setSaveState('saving');
    setError(null);
    try {
      // Keep the quick projection's total-savings figure in sync with the buckets,
      // and refresh the derived ages from the birth dates before saving.
      const toSave = {
        ...p,
        currentSavings: p.tradBalance + p.rothBalance + p.taxableBalance,
        currentAge: ageFromBirthDate(p.birthDate),
        spouseAge: ageFromBirthDate(p.spouseBirthDate),
      };
      const saved = await saveProfile(toSave, mode, user.userId);
      setP({ ...DEFAULT_PROFILE, ...saved });
      setSaveState('saved');
      if (isOnboarding) router.push('/');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Your information</h1>
        <p className="mt-2 text-sm opacity-70">Sign in to set up your profile — every calculator will use it.</p>
        <Link href="/signin" className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isOnboarding ? 'Welcome — tell us about you' : 'Your information'}
        </h1>
        <p className="mt-1 text-sm opacity-70">
          Enter this once. The planner and the Social Security and Roth calculators all start from it —
          you can still adjust anything on each page. All amounts in today&apos;s dollars.
        </p>
      </div>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-40">Where to store your financial details</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <StorageChoice
            active={mode === 'server'}
            onClick={() => setMode('server')}
            title="In my account"
            desc="Saved to your account so it syncs across your devices."
          />
          <StorageChoice
            active={mode === 'local'}
            onClick={() => setMode('local')}
            title="Only on this device"
            desc="Kept in this browser and never stored on our servers. Won't follow you to other devices, and clearing your browser erases it."
          />
        </div>
        <p className="mt-2 text-xs opacity-50">
          Your name and email always live in your account. This choice only affects the financial numbers below.
          {mode === 'local' && ' Saving will remove any copy already on our servers.'}
        </p>
      </section>

      <Group title="Household">
        <div className="text-sm sm:col-span-2">
          <span className="mb-1 block opacity-70">Filing status</span>
          <div className="grid max-w-sm grid-cols-2 gap-2">
            <Toggle label="Married filing jointly" active={married} onClick={() => set('filingStatus')('MARRIED_JOINT')} />
            <Toggle label="Single" active={!married} onClick={() => set('filingStatus')('SINGLE')} />
          </div>
        </div>
        <DateField label="Your date of birth" value={p.birthDate} onChange={set('birthDate')} />
        {married && <DateField label="Spouse's date of birth" value={p.spouseBirthDate} onChange={set('spouseBirthDate')} />}
        <Num label="Target retirement age" value={p.retirementAge} onChange={set('retirementAge')} min={ageFromBirthDate(p.birthDate) + 1} max={100} />
        <Num label="Plan through age" value={p.planThroughAge} onChange={set('planThroughAge')} min={p.retirementAge + 1} max={110} />
      </Group>

      <Group title="Savings & accounts">
        <Num label="Traditional / pre-tax (IRA, 401k)" value={p.tradBalance} onChange={set('tradBalance')} min={0} step={5000} prefix="$" />
        <Num label="Roth" value={p.rothBalance} onChange={set('rothBalance')} min={0} step={5000} prefix="$" />
        <Num label="Taxable brokerage" value={p.taxableBalance} onChange={set('taxableBalance')} min={0} step={5000} prefix="$" />
        <Num label="Monthly contribution" value={p.monthlyContribution} onChange={set('monthlyContribution')} min={0} step={50} prefix="$" />
      </Group>

      <Group title="Retirement income">
        <Num label="Desired annual income" value={p.desiredAnnualIncome} onChange={set('desiredAnnualIncome')} min={0} step={1000} prefix="$" />
        <Num label="Annual pension" value={p.annualPension} onChange={set('annualPension')} min={0} step={1000} prefix="$" />
        <Num label="Social Security at full retirement age (monthly)" value={p.ssMonthlyAtFra} onChange={set('ssMonthlyAtFra')} min={0} step={50} prefix="$"
          hint="From your SSA statement (ssa.gov/myaccount)." />
        <Num label="Plan to claim Social Security at age" value={p.ssClaimAge} onChange={set('ssClaimAge')} min={62} max={70} />
      </Group>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide opacity-40">Other income streams</h2>
          <button type="button" onClick={addStream} className="text-sm underline underline-offset-4">+ Add income</button>
        </div>
        <p className="mb-3 text-xs opacity-55">
          Anything beyond savings and Social Security — a pension, rental income, an annuity, or future income
          like rent from inherited land. Set a start age, and mark it inflation-adjusted if it keeps pace with
          inflation. Leave &quot;until age&quot; at 0 for lifelong income.
        </p>
        {(p.incomeStreams || []).length === 0 && (
          <p className="text-sm opacity-50">No extra income streams yet.</p>
        )}
        <div className="space-y-3">
          {(p.incomeStreams || []).map((s, i) => (
            <div key={i} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Label" value={s.label} placeholder="e.g. Inherited land rent"
                  onChange={(v) => updateStream(i, { label: v })} />
                <Num label="Amount per year" value={s.annualAmount} onChange={(v) => updateStream(i, { annualAmount: v })} min={0} step={1000} prefix="$" />
                <Num label="Starts at age" value={s.startAge} onChange={(v) => updateStream(i, { startAge: v })} min={0} max={110} />
                <Num label="Until age (0 = for life)" value={s.endAge} onChange={(v) => updateStream(i, { endAge: v })} min={0} max={110} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.inflationAdjusted}
                    onChange={(e) => updateStream(i, { inflationAdjusted: e.target.checked })} />
                  <span className="opacity-70">Keeps pace with inflation</span>
                </label>
                <button type="button" onClick={() => removeStream(i)} className="text-sm text-red-500 underline underline-offset-4">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Group title="Healthcare">
        <Num label="Annual healthcare cost" value={p.annualHealthcareCost} onChange={set('annualHealthcareCost')} step={500} prefix="$"
          hint="Premiums + out-of-pocket in retirement, today's dollars." />
        <Pct label="Healthcare inflation" value={p.healthcareInflationRate} onChange={set('healthcareInflationRate')} max={12}
          hint="Usually higher than general inflation (~5%)." />
        <div className="text-sm sm:col-span-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={p.ltcEnabled} onChange={(e) => set('ltcEnabled')(e.target.checked)} />
            <span className="opacity-80">Model a long-term-care event late in life</span>
          </label>
        </div>
        {p.ltcEnabled && (
          <>
            <Num label="LTC cost per year" value={p.ltcAnnualCost} onChange={set('ltcAnnualCost')} step={5000} prefix="$" />
            <div className="grid grid-cols-2 gap-2">
              <Num label="Starting at age" value={p.ltcStartAge} onChange={set('ltcStartAge')} />
              <Num label="For years" value={p.ltcYears} onChange={set('ltcYears')} />
            </div>
          </>
        )}

        <details className="rounded-lg border border-black/10 p-3 text-sm sm:col-span-2 dark:border-white/10">
          <summary className="cursor-pointer font-medium">Not sure? Estimate from Medicare costs</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Num label="Retirement income (MAGI, for IRMAA)" value={med.magi} onChange={(v) => setMed((m) => ({ ...m, magi: v }))} step={5000} prefix="$" />
            <label className="block text-sm">
              <span className="mb-1 block opacity-70">Coverage</span>
              <select value={med.coverage} onChange={(e) => setMed((m) => ({ ...m, coverage: e.target.value as 'MEDIGAP' | 'ADVANTAGE' }))}
                className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none dark:border-white/15">
                <option value="MEDIGAP" className="bg-white text-black dark:bg-neutral-900 dark:text-white">Original + Medigap</option>
                <option value="ADVANTAGE" className="bg-white text-black dark:bg-neutral-900 dark:text-white">Medicare Advantage</option>
              </select>
            </label>
            <Num label={med.coverage === 'MEDIGAP' ? 'Medigap premium /mo (per person)' : 'Advantage premium /mo (per person)'}
              value={med.supplementMonthly} onChange={(v) => setMed((m) => ({ ...m, supplementMonthly: v }))} prefix="$" />
            <Num label="Part D premium /mo (per person)" value={med.partDMonthly} onChange={(v) => setMed((m) => ({ ...m, partDMonthly: v }))} prefix="$" />
            <Num label="Out-of-pocket /yr (per person)" value={med.outOfPocketAnnual} onChange={(v) => setMed((m) => ({ ...m, outOfPocketAnnual: v }))} step={250} prefix="$" />
          </div>

          {medResult && (
            <div className="mt-3 rounded-md bg-black/5 p-3 text-xs dark:bg-white/10">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <Split label={`Part B${medResult.peopleOnMedicare > 1 ? ' (×2)' : ''}`} value={medResult.partB} />
                <Split label="Supplement" value={medResult.supplement} />
                <Split label="Part D" value={medResult.partD} />
                <Split label="Out-of-pocket" value={medResult.outOfPocket} />
                <Split label="IRMAA surcharge" value={medResult.irmaa} />
                <Split label="Total / year" value={medResult.total} bold />
              </div>
              <button type="button" onClick={() => set('annualHealthcareCost')(medResult.total)}
                className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
                Use {money(medResult.total)} as my healthcare cost
              </button>
            </div>
          )}
          <p className="mt-2 text-xs opacity-45">
            Approximate 2025 figures. IRMAA uses the income above; in reality it&apos;s based on your income from two years prior.{' '}
            <Link href="/medicare" className="underline underline-offset-2">How Medicare works →</Link>
          </p>
        </details>
      </Group>

      <Group title="Assumptions">
        <Pct label="Expected annual return" value={p.annualReturnRate} onChange={set('annualReturnRate')} max={15} />
        <Pct label="Inflation" value={p.inflationRate} onChange={set('inflationRate')} max={10} />
        <label className="block text-sm">
          <span className="mb-1 block opacity-70">State of residence</span>
          <select value={p.state || ''} onChange={(e) => onStateChange(e.target.value)}
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40">
            <option value="" className="bg-white text-black dark:bg-neutral-900 dark:text-white">Select…</option>
            {states.map((s) => (
              <option key={s.code} value={s.code} className="bg-white text-black dark:bg-neutral-900 dark:text-white">
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <Pct label="State income tax" value={p.stateTaxRate} onChange={set('stateTaxRate')} max={15} hint="Auto-filled from your state; edit to override." />
      </Group>

      <div className="flex items-center gap-4">
        <button onClick={onSave} disabled={saveState === 'saving'}
          className="rounded-md px-5 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : isOnboarding ? 'Save & continue' : 'Save'}
        </button>
        {!isOnboarding && <Link href="/" className="text-sm underline underline-offset-4">Back to dashboard</Link>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function Split({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="opacity-60">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function StorageChoice({ active, onClick, title, desc }: {
  active: boolean; onClick: () => void; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md border p-3 text-left ${
        active ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-black/15 hover:border-black/30 dark:border-white/15 dark:hover:border-white/30'
      }`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={`inline-block h-3 w-3 rounded-full border ${active ? 'border-emerald-500 bg-emerald-500' : 'border-black/30 dark:border-white/30'}`} />
        {title}
      </div>
      <div className="mt-1 text-xs opacity-60">{desc}</div>
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-40">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
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

function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  const age = ageFromBirthDate(value);
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <input type="date" value={value || ''} max="2015-12-31"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40" />
      {value && <span className="mt-1 block text-xs opacity-45">Age {age}</span>}
    </label>
  );
}

function TextField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <input type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40" />
    </label>
  );
}

function Num({ label, value, onChange, min, max, step = 1, prefix, hint }: {
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

function Pct({ label, value, onChange, max = 30, hint }: {
  label: string; value: number; onChange: (v: number) => void; max?: number; hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block opacity-70">{label}</span>
      <div className="flex items-center rounded-md border border-black/15 focus-within:border-black/40 dark:border-white/15 dark:focus-within:border-white/40">
        <input type="number" value={Math.round(value * 1000) / 10} min={0} max={max} step={0.1}
          onChange={(e) => onChange((e.target.value === '' ? 0 : Number(e.target.value)) / 100)}
          className="w-full bg-transparent px-3 py-2 outline-none" />
        <span className="pr-3 text-sm opacity-50">%</span>
      </div>
      {hint && <span className="mt-1 block text-xs opacity-45">{hint}</span>}
    </label>
  );
}
