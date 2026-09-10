/**
 * Where a user's financial profile lives. Their account (name/email) is always in
 * our database; the financial details can be kept either in the account (so they
 * sync across devices) or only on this device in the browser, never sent to our
 * servers. This module hides that choice behind a single load/save API.
 *
 * Local storage is namespaced by user id, so two accounts signed in from the same
 * browser never see each other's device-only data.
 */
import { api, withDerivedAges, type RetirementProfile } from './api';

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
