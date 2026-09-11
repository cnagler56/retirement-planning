'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, DEFAULT_PROFILE, type LedgerResult, type RetirementProfile } from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { loadProfile } from '@/src/lib/profileStore';
import { money, percent } from '@/src/lib/format';

export default function LedgerPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<RetirementProfile>(DEFAULT_PROFILE);
  const [ledger, setLedger] = useState<LedgerResult | null>(null);

  useEffect(() => {
    if (!user) return;
    loadProfile(user.userId).then((p) => { if (p) setProfile({ ...DEFAULT_PROFILE, ...p }); }).catch(() => {});
  }, [user]);

  useEffect(() => {
    api.ledger(profile).then(setLedger).catch(() => setLedger(null));
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Year-by-year plan</h1>
          <p className="mt-1 text-sm opacity-70">
            Every retirement year in today&apos;s dollars — income, expenses, RMDs, taxes, Medicare, and the balance
            that&apos;s left. Edit the inputs on your{' '}
            <Link href="/profile" className="underline underline-offset-4">profile</Link>.
          </p>
        </div>
        <Link href="/plan" className="text-sm underline underline-offset-4">← Planner</Link>
      </div>

      {ledger && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <Pill label="Real return" value={percent(ledger.realReturn)} />
            <Pill label="RMDs begin" value={`age ${ledger.rmdStartAge}`} />
            <Pill label="Outcome"
              value={ledger.moneyLastsToAge ? `runs out at ${ledger.moneyLastsToAge}` : `funded through ${ledger.rows.at(-1)?.age}`}
              danger={ledger.moneyLastsToAge != null} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full whitespace-nowrap text-right text-xs">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <Th left>Age</Th>
                  <Th>Soc. Sec.</Th>
                  <Th>Pension</Th>
                  <Th>Other inc.</Th>
                  <Th>RMD</Th>
                  <Th>Withdraw</Th>
                  <Th>Living exp.</Th>
                  <Th>Healthcare</Th>
                  <Th>Loan pmt</Th>
                  <Th>Loan bal.</Th>
                  <Th>Fed tax</Th>
                  <Th>State tax</Th>
                  <Th>IRMAA</Th>
                  <Th>End balance</Th>
                </tr>
              </thead>
              <tbody>
                {ledger.rows.map((r) => (
                  <tr key={r.age} className={`border-b border-black/5 last:border-0 dark:border-white/5 ${r.shortfall ? 'bg-red-500/10' : ''}`}>
                    <Td left strong>{r.age}</Td>
                    <Td>{cell(r.socialSecurity)}</Td>
                    <Td>{cell(r.pension)}</Td>
                    <Td>{cell(r.otherIncome)}</Td>
                    <Td>{cell(r.rmd)}</Td>
                    <Td>{cell(r.withdrawal)}</Td>
                    <Td>{cell(r.livingExpenses)}</Td>
                    <Td>{cell(r.healthcare)}</Td>
                    <Td>{cell(r.loanPayment)}</Td>
                    <Td>{cell(r.loanBalance)}</Td>
                    <Td>{cell(r.federalTax)}</Td>
                    <Td>{cell(r.stateTax)}</Td>
                    <Td>{cell(r.irmaa)}</Td>
                    <Td strong>{r.shortfall ? '$0' : money(r.endTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs opacity-50">
            Today&apos;s dollars at your {percent(profile.annualReturnRate)} expected return and {percent(profile.inflationRate)} inflation.
            Withdrawals are drawn taxable → pre-tax → Roth; taxes include the Social Security worksheet, capital gains,
            NIIT, a flat state tax, and Medicare IRMAA. Deterministic (not Monte Carlo). Not tax advice.
          </p>
        </>
      )}
    </div>
  );
}

function cell(v: number) {
  return v > 0 ? money(v) : <span className="opacity-30">—</span>;
}

function Pill({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-1.5 ${danger ? 'border-red-500/40 bg-red-500/10' : 'border-black/10 dark:border-white/10'}`}>
      <span className="opacity-60">{label}:</span> <span className="font-medium">{value}</span>
    </div>
  );
}

function Th({ children, left = false }: { children: React.ReactNode; left?: boolean }) {
  return <th className={`p-2 font-medium opacity-60 ${left ? 'text-left' : 'text-right'}`}>{children}</th>;
}

function Td({ children, left = false, strong = false }: { children: React.ReactNode; left?: boolean; strong?: boolean }) {
  return <td className={`p-2 ${left ? 'text-left' : 'text-right'} ${strong ? 'font-semibold' : ''}`}>{children}</td>;
}
