'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, type Health, type Projection } from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { money } from '@/src/lib/format';

export default function DashboardPage() {
  const { user, loading } = useUser();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [projection, setProjection] = useState<Projection | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealthError(true));
  }, []);

  // When signed in, load the saved profile and its projection for the cards.
  useEffect(() => {
    if (!user) { setHasProfile(null); setProjection(null); return; }
    api.getProfile()
      .then((p) => {
        if (!p) { setHasProfile(false); return; }
        setHasProfile(true);
        return api.computeProjection(p).then(setProjection);
      })
      .catch(() => setHasProfile(false));
  }, [user]);

  const showReal = projection != null;

  return (
    <div className="space-y-8">
      <section className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm opacity-70">
            {loading
              ? 'Checking your session…'
              : user
                ? hasProfile === false
                  ? 'You haven’t built a plan yet.'
                  : `Welcome back, ${user.firstName || user.email}.`
                : 'Sign in to build and save your retirement plan.'}
          </p>
        </div>
        <Link
          href="/plan"
          className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}
        >
          {showReal ? 'Open planner' : 'Start planning'}
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card
          title="Nest egg at retirement"
          value={showReal ? money(projection!.nestEgg) : '—'}
          hint={showReal ? `age ${projection!.retirementAge}, today's dollars` : 'Build a plan'}
        />
        <Card
          title="Years to retirement"
          value={showReal ? `${projection!.yearsToRetirement}` : '—'}
          hint={showReal ? 'until your target age' : 'Build a plan'}
        />
        <Card
          title="Plan outlook"
          value={
            showReal
              ? projection!.fundedThroughGoal
                ? `Funded to ${projection!.planThroughAge}`
                : `Runs out at ${projection!.moneyLastsToAge}`
              : '—'
          }
          hint={showReal ? (projection!.fundedThroughGoal ? 'on track' : 'shortfall') : 'Build a plan'}
        />
      </section>

      <section className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              health ? 'bg-green-500' : healthError ? 'bg-red-500' : 'bg-yellow-400'
            }`}
          />
          <span className="opacity-70">
            Backend:{' '}
            {health
              ? `${health.service} · ${health.status}`
              : healthError
                ? 'unreachable (is RetireServer running on :8083?)'
                : 'checking…'}
          </span>
        </div>
      </section>
    </div>
  );
}

function Card({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="text-xs uppercase tracking-wide opacity-60">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-50">{hint}</div>
    </div>
  );
}
