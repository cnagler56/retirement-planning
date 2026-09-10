'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, DEFAULT_PROFILE, type Account, type AccountType } from '@/src/lib/api';
import { useUser } from '@/src/lib/UserContext';
import { getStorageMode, loadProfile, saveProfile } from '@/src/lib/profileStore';
import { money } from '@/src/lib/format';

const TYPES: AccountType[] = ['TRADITIONAL', 'ROTH', 'TAXABLE', 'OTHER'];
const TYPE_LABEL: Record<AccountType, string> = {
  TRADITIONAL: 'Traditional (pre-tax)',
  ROTH: 'Roth',
  TAXABLE: 'Taxable',
  OTHER: 'Other',
};
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8083';

export default function AccountsPage() {
  const { user, loading } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user || loaded) return;
    api.listAccounts().then(setAccounts).catch(() => {}).finally(() => setLoaded(true));
  }, [user, loaded]);

  const today = new Date().toISOString().slice(0, 10);
  const addRow = () =>
    setAccounts((a) => [...a, { name: '', type: 'TRADITIONAL', balance: 0, asOfDate: today }]);
  const patch = (i: number, c: Partial<Account>) =>
    setAccounts((a) => a.map((x, idx) => (idx === i ? { ...x, ...c } : x)));
  const removeRow = async (i: number) => {
    const row = accounts[i];
    if (row.id) await api.deleteAccount(row.id).catch(() => {});
    setAccounts((a) => a.filter((_, idx) => idx !== i));
  };

  async function save() {
    setStatus('Saving…');
    try {
      const saved = await api.saveAccounts(accounts.filter((a) => a.name.trim()));
      setAccounts(saved);
      setStatus('Saved.');
    } catch {
      setStatus('Could not save.');
    }
  }

  async function pullIntoPlan() {
    if (!user) return;
    setStatus('Updating your plan…');
    try {
      const sum = await api.accountSummary();
      const base = (await loadProfile(user.userId).catch(() => null)) ?? DEFAULT_PROFILE;
      const updated = {
        ...base,
        tradBalance: Math.round(sum.traditional),
        rothBalance: Math.round(sum.roth),
        taxableBalance: Math.round(sum.taxable + sum.other),
        currentSavings: Math.round(sum.total),
      };
      await saveProfile(updated, getStorageMode(user.userId), user.userId);
      setStatus(`Plan updated from ${money(sum.total)} across your accounts.`);
    } catch {
      setStatus('Could not update the plan.');
    }
  }

  function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const parsed: Account[] = [];
      for (const line of rows) {
        const [name, type, balance, asOf] = line.split(',').map((s) => s.trim());
        if (!name || name.toLowerCase() === 'name') continue; // skip header
        const t = (type || '').toUpperCase();
        parsed.push({
          name,
          type: (TYPES.includes(t as AccountType) ? t : 'OTHER') as AccountType,
          balance: Number(balance) || 0,
          asOfDate: asOf || today,
        });
      }
      if (parsed.length) setAccounts((a) => [...a, ...parsed]);
      setStatus(`Imported ${parsed.length} account(s) — review and Save.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  if (!loading && !user) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-2 text-sm opacity-70">Sign in to track your account balances.</p>
        <Link href="/signin" className="mt-4 inline-block rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm opacity-70">
            Keep your balances current here, import a CSV, or push them from a script via the API. Then pull the
            totals into your plan.
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="opacity-60">Total</div>
          <div className="text-xl font-semibold">{money(total)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left opacity-60 dark:border-white/10">
              <th className="p-2 font-medium">Account</th>
              <th className="p-2 font-medium">Type</th>
              <th className="p-2 font-medium">Balance</th>
              <th className="p-2 font-medium">As of</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr key={i} className="border-b border-black/5 last:border-0 dark:border-white/5">
                <td className="p-2">
                  <input value={a.name} placeholder="e.g. Fidelity 401k" onChange={(e) => patch(i, { name: e.target.value })}
                    className="w-full bg-transparent outline-none" />
                </td>
                <td className="p-2">
                  <select value={a.type} onChange={(e) => patch(i, { type: e.target.value as AccountType })}
                    className="bg-transparent outline-none">
                    {TYPES.map((t) => (
                      <option key={t} value={t} className="bg-white text-black dark:bg-neutral-900 dark:text-white">{TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <div className="flex items-center">
                    <span className="opacity-50">$</span>
                    <input type="number" value={Number.isFinite(a.balance) ? a.balance : ''} step={1000}
                      onChange={(e) => patch(i, { balance: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="w-28 bg-transparent px-1 outline-none" />
                  </div>
                </td>
                <td className="p-2">
                  <input type="date" value={a.asOfDate ?? ''} onChange={(e) => patch(i, { asOfDate: e.target.value })}
                    className="bg-transparent outline-none" />
                </td>
                <td className="p-2 text-right">
                  <button onClick={() => removeRow(i)} className="text-xs text-red-500">Remove</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={5} className="p-4 text-center opacity-50">No accounts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={addRow} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">+ Add account</button>
        <label className="cursor-pointer rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Import CSV
          <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
        </label>
        <button onClick={save} className="rounded-md px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--foreground)', color: 'var(--background)' }}>Save</button>
        <button onClick={pullIntoPlan} className="rounded-md border border-cyan-500/50 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-400">
          Pull totals into my plan →
        </button>
        {status && <span className="text-sm opacity-70">{status}</span>}
      </div>

      <p className="text-xs opacity-50">
        CSV format: <code>name,type,balance,asOfDate</code> — type is Traditional, Roth, Taxable, or Other; date is
        YYYY-MM-DD. A header row is skipped.
      </p>

      {/* Script / API access */}
      <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Update from a script (API key)</div>
          <button onClick={() => api.generateApiKey().then((r) => setApiKey(r.apiKey)).catch(() => {})}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/15">
            {apiKey ? 'Regenerate key' : 'Generate key'}
          </button>
        </div>
        {apiKey ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-md bg-black/5 p-2 font-mono text-xs break-all dark:bg-white/10">{apiKey}</div>
            <p className="text-xs opacity-55">Copy it now — regenerating replaces it. Then push balances anytime:</p>
            <pre className="overflow-x-auto rounded-md bg-black/5 p-3 text-xs dark:bg-white/10">{`curl -X POST ${apiBase}/api/accounts/bulk \\
  -H "X-Api-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '[{"name":"Fidelity 401k","type":"TRADITIONAL","balance":512000,"asOfDate":"${today}"}]'`}</pre>
          </div>
        ) : (
          <p className="mt-2 text-xs opacity-55">
            Generate a personal key to push balances from a script or cron job, keeping the plan always current —
            without sharing your login.
          </p>
        )}
      </div>
    </div>
  );
}
