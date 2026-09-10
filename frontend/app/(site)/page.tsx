'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Health, type Projection } from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfile } from '@/src/lib/profileStore';
import { money } from '@/src/lib/format';

export default function DashboardPage() {
  const { user, loading } = useUser();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [projection, setProjection] = useState<Projection | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealthError(true));
  }, []);

  useEffect(() => {
    if (!user) { setProjection(null); return; }
    loadProfile(user.userId)
      .then((p) => (p ? api.computeProjection(p).then(setProjection) : undefined))
      .catch(() => setProjection(null));
  }, [user]);

  const showReal = projection != null;

  return (
    <div className="space-y-6">
      <div className="grid auto-rows-[minmax(0,auto)] grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Welcome / CTA — wide tile */}
        <div className="bento col-span-2 flex flex-col justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Retirement Planner</h1>
            <p className="mt-1 text-sm opacity-70">
              {loading
                ? 'Checking your session…'
                : user
                  ? `Welcome back, ${user.firstName || user.email}.`
                  : 'Sign in to build and save your retirement plan.'}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/plan" className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}>
              {showReal ? 'Open planner' : 'Start planning'}
            </Link>
            {!user && (
              <Link href="/signin" className="rounded-md border border-white/20 px-4 py-2 text-sm">Sign in</Link>
            )}
          </div>
        </div>

        {/* Metric tiles */}
        <Metric label="Nest egg at retirement" value={showReal ? money(projection!.nestEgg) : '—'}
          hint={showReal ? `age ${projection!.retirementAge}, today's $` : 'Build a plan'} />
        <Metric label="Years to retirement" value={showReal ? `${projection!.yearsToRetirement}` : '—'}
          hint={showReal ? 'until your target age' : 'Build a plan'} />

        {/* Plan outlook — wide */}
        <div className="bento col-span-2">
          <div className="text-xs uppercase tracking-wide opacity-55">Plan outlook</div>
          <div className="mt-1 text-2xl font-semibold">
            {showReal
              ? projection!.fundedThroughGoal
                ? `Funded through ${projection!.planThroughAge}`
                : `Runs out at ${projection!.moneyLastsToAge}`
              : '—'}
          </div>
          <div className="mt-1 text-sm opacity-60">
            {showReal
              ? projection!.fundedThroughGoal ? 'On track in today’s dollars.' : 'Shortfall — try the planner.'
              : 'Set up your profile to see your outlook.'}
          </div>
        </div>

        {/* Est. monthly income */}
        <Metric label="Social Security" value={showReal && projection!.ssAnnualIncome > 0 ? `${money(projection!.ssAnnualIncome)}/yr` : '—'}
          hint={showReal && projection!.ssClaimAge > 0 ? `from age ${projection!.ssClaimAge}` : 'Build a plan'} />

        {/* Backend health */}
        <div className="bento flex items-center gap-2 text-sm">
          <span className={`inline-block h-2 w-2 rounded-full ${health ? 'bg-cyan-400' : healthError ? 'bg-red-400' : 'bg-amber-400'}`} />
          <span className="opacity-70">{health ? 'Backend online' : healthError ? 'Backend offline' : 'Checking…'}</span>
        </div>
      </div>

      {/* Tools — bento of quick links */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide opacity-50">Tools</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Tool href="/plan" title="Planner" desc="Projection, drawdown, Monte Carlo" icon="📈" />
          <Tool href="/scenarios" title="Compare" desc="Scenarios side by side" icon="⚖️" />
          <Tool href="/social-security" title="Social Security" desc="Claiming breakeven" icon="🧾" />
          <Tool href="/roth" title="Roth" desc="Conversion tax & lifetime strategy" icon="🔄" />
          <Tool href="/medicare" title="Medicare" desc="Costs, IRMAA, how it works" icon="🏥" />
          <Tool href="/accounts" title="Accounts" desc="Balances & upload API" icon="🏦" />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bento">
      <div className="text-xs uppercase tracking-wide opacity-55">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-50">{hint}</div>
    </div>
  );
}

function Tool({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: string }) {
  return (
    <Link href={href} className="bento block">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-medium">{title}</div>
      <div className="mt-0.5 text-xs opacity-55">{desc}</div>
    </Link>
  );
}
