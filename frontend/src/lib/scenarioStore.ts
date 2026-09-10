/**
 * Saved plan scenarios for the comparison view. Persisted the same way as the
 * profile — in the account (server) or only on this device — following the
 * storage mode the user chose. Each scenario carries a full RetirementProfile as
 * its inputs plus a display name.
 */
import { api, withDerivedAges, type RetirementProfile } from './api';
import { getStorageMode } from './profileStore';

export interface Scenario {
  id: number; // server id, or a negative client id for device-only scenarios
  name: string;
  inputs: RetirementProfile;
}

const key = (userId: number) => `retire_scenarios_${userId}`;

function readLocal(userId: number): Scenario[] {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as Scenario[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: number, scenarios: Scenario[]) {
  try { localStorage.setItem(key(userId), JSON.stringify(scenarios)); } catch { /* blocked */ }
}

export async function listScenarios(userId: number): Promise<Scenario[]> {
  if (getStorageMode(userId) === 'local') {
    return readLocal(userId).map((s) => ({ ...s, inputs: withDerivedAges(s.inputs) }));
  }
  const rows = await api.listScenarios();
  return rows.map((r) => ({ id: r.id, name: r.name, inputs: withDerivedAges(JSON.parse(r.inputsJson)) }));
}

/** Create or update a scenario; returns it with its persisted id. */
export async function saveScenario(userId: number, s: Scenario): Promise<Scenario> {
  if (getStorageMode(userId) === 'local') {
    const all = readLocal(userId);
    const id = s.id && s.id !== 0 ? s.id : -Date.now();
    const next = { ...s, id };
    const idx = all.findIndex((x) => x.id === id);
    if (idx >= 0) all[idx] = next; else all.push(next);
    writeLocal(userId, all);
    return next;
  }
  const json = JSON.stringify(s.inputs);
  const row = s.id && s.id > 0
    ? await api.updateScenario(s.id, s.name, json)
    : await api.createScenario(s.name, json);
  return { id: row.id, name: row.name, inputs: s.inputs };
}

export async function deleteScenario(userId: number, s: Scenario): Promise<void> {
  if (getStorageMode(userId) === 'local') {
    writeLocal(userId, readLocal(userId).filter((x) => x.id !== s.id));
    return;
  }
  if (s.id > 0) await api.deleteScenario(s.id);
}
