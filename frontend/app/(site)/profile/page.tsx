'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DEFAULT_PROFILE, type RetirementProfile } from '@/src/lib/api';
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
  const [mode, setMode] = useState<StorageMode>('server');
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

  async function onSave() {
    if (!user) return;
    setSaveState('saving');
    setError(null);
    try {
      // Keep the quick projection's total-savings figure in sync with the buckets.
      const toSave = { ...p, currentSavings: p.tradBalance + p.rothBalance + p.taxableBalance };
      const saved = await saveProfile(toSave, mode, user.userId);
      setP({ ...DEFAULT_PROFILE, ...saved });
      setSaveState('saved');
      if (isOnboarding) router.push('/');
    } catch (err) {
      setSaveState('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  const married = p.filingStatus === 'MARRIED_JOINT';

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
        <Num label="Your age" value={p.currentAge} onChange={set('currentAge')} min={18} max={100} />
        {married && <Num label="Spouse's age" value={p.spouseAge} onChange={set('spouseAge')} min={18} max={100} />}
        <Num label="Target retirement age" value={p.retirementAge} onChange={set('retirementAge')} min={p.currentAge + 1} max={100} />
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

      <Group title="Assumptions">
        <Pct label="Expected annual return" value={p.annualReturnRate} onChange={set('annualReturnRate')} max={15} />
        <Pct label="Inflation" value={p.inflationRate} onChange={set('inflationRate')} max={10} />
        <Pct label="State income tax" value={p.stateTaxRate} onChange={set('stateTaxRate')} max={15} />
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

function Pct({ label, value, onChange, max = 30 }: {
  label: string; value: number; onChange: (v: number) => void; max?: number;
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
    </label>
  );
}
