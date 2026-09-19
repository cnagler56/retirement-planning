/**
 * Where a user's financial profile lives. Their account (name/email) is always in
 * our database; the financial details can be kept either in the account (so they
 * sync across devices) or only on this device in the browser, never sent to our
 * servers. This module hides that choice behind a single load/save API.
 *
 * Local storage is namespaced by user id, so two accounts signed in from the same
 * browser never see each other's device-only data.
 */
import { api, withDerivedAges, type Account, type RetirementProfile } from './api';

export type StorageMode = 'server' | 'local';

const modeKey = (userId: number) => `retire_profile_mode_${userId}`;
const dataKey = (userId: number) => `retire_profile_data_${userId}`;

export function getStorageMode(userId: number): StorageMode {
  if (typeof window === 'undefined') return 'server';
  try {
    return localStorage.getItem(modeKey(userId)) === 'local' ? 'local' : 'server';
  } catch {
    return 'server';
  }
}

function setStorageMode(userId: number, mode: StorageMode) {
  try { localStorage.setItem(modeKey(userId), mode); } catch { /* storage blocked */ }
}

function readLocal(userId: number): RetirementProfile | null {
  try {
    const raw = localStorage.getItem(dataKey(userId));
    return raw ? (JSON.parse(raw) as RetirementProfile) : null;
  } catch {
    return null;
  }
}

function writeLocal(userId: number, p: RetirementProfile) {
  try { localStorage.setItem(dataKey(userId), JSON.stringify(p)); } catch { /* storage blocked */ }
}

function clearLocal(userId: number) {
  try { localStorage.removeItem(dataKey(userId)); } catch { /* storage blocked */ }
}

/** Load the profile from wherever this user chose to keep it, with ages refreshed from birth dates. */
export async function loadProfile(userId: number): Promise<RetirementProfile | null> {
  const p = getStorageMode(userId) === 'local' ? readLocal(userId) : await api.getProfile();
  return p ? withDerivedAges(p) : null;
}

/**
 * Fold itemized account balances into a profile's savings + buckets, so every
 * page (planner and ledger) starts the plan from the same real total. Returns the
 * profile unchanged when there are no accounts. `fromAccounts` says whether the
 * totals came from accounts, for a UI hint.
 */
export function applyAccountRollup(
  profile: RetirementProfile,
  accounts: Account[],
): { profile: RetirementProfile; fromAccounts: boolean } {
  const roll = (accounts || []).reduce(
    (r, a) => {
      const b = a.balance || 0;
      if (a.type === 'TRADITIONAL') r.trad += b;
      else if (a.type === 'ROTH') r.roth += b;
      else if (a.type === 'TAXABLE') r.taxable += b;
      else r.other += b;
      return r;
    },
    { trad: 0, roth: 0, taxable: 0, other: 0 },
  );
  const total = roll.trad + roll.roth + roll.taxable + roll.other;
  if (total <= 0) return { profile, fromAccounts: false };
  return {
    profile: {
      ...profile,
      currentSavings: Math.round(total),
      tradBalance: Math.round(roll.trad),
      rothBalance: Math.round(roll.roth),
      taxableBalance: Math.round(roll.taxable + roll.other),
    },
    fromAccounts: true,
  };
}

/** Load the profile and fold in the user's itemized accounts, if any. */
export async function loadProfileWithAccounts(
  userId: number,
): Promise<{ profile: RetirementProfile | null; fromAccounts: boolean }> {
  const [p, accounts] = await Promise.all([
    loadProfile(userId).catch(() => null),
    api.listAccounts().catch(() => [] as Account[]),
  ]);
  if (!p) return { profile: null, fromAccounts: false };
  return applyAccountRollup(p, accounts);
}

/**
 * Save the profile to the chosen location, and make sure it lives ONLY there:
 * choosing device-only deletes any server copy; choosing the account clears the
 * local copy. Returns the persisted profile.
 */
export async function saveProfile(
  p: RetirementProfile,
  mode: StorageMode,
  userId: number,
): Promise<RetirementProfile> {
  setStorageMode(userId, mode);
  if (mode === 'local') {
    writeLocal(userId, p);
    try { await api.deleteProfile(); } catch { /* nothing on server yet — fine */ }
    return p;
  }
  const saved = await api.saveProfile(p);
  clearLocal(userId);
  return saved;
}
