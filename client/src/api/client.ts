/**
 * Local-only data layer — all tax data stays in the browser's localStorage.
 * No server, no network requests, no tracking. Your data never leaves your computer.
 *
 * Storage key layout:
 *   telostax:returns          → string[] of return IDs
 *   telostax:return:{id}      → encrypted TaxReturn JSON (or plaintext for unencrypted)
 *   telostax:chat:{id}        → encrypted chat history JSON (per-return)
 *   telostax:salt             → PBKDF2 salt for key derivation
 *   telostax:verify           → encrypted verification token
 *
 * Encryption: When active, returns are encrypted with AES-256-GCM before storage.
 * An in-memory cache holds decrypted returns after unlock for synchronous access.
 */

import { TaxReturn, migrateReturn, needsMigration, CURRENT_SCHEMA_VERSION } from '@telostax/engine';
import { toast } from 'sonner';
import {
  getActiveKey,
  isEncryptedPayload,
  encrypt as encryptStr,
  decrypt as decryptStr,
  isEncryptionSetup,
  lock,
} from '../services/crypto';
import { deleteChatHistory, deleteAllChatHistory } from '../services/chatPersistence';

const RETURNS_KEY = 'telostax:returns';
const returnKey = (id: string) => `telostax:return:${id}`;

// ─── In-Memory Cache (populated on unlock) ──────

const returnCache = new Map<string, TaxReturn>();

/** Populate cache by decrypting all returns from localStorage. Called on unlock. */
export async function loadAllReturns(): Promise<void> {
  returnCache.clear();
  const ids = getReturnIds();
  const key = getActiveKey();

  for (const id of ids) {
    const raw = localStorage.getItem(returnKey(id));
    if (!raw) continue;

    try {
      let parsed: TaxReturn;

      if (isEncryptedPayload(raw) && key) {
        // Decrypt
        const json = await decryptStr(raw, key);
        parsed = JSON.parse(json);
      } else if (!isEncryptedPayload(raw)) {
        // Plaintext (pre-encryption migration)
        parsed = JSON.parse(raw);

        // Migrate to encrypted storage if key is available
        if (key) {
          const encrypted = await encryptStr(JSON.stringify(parsed), key);
          localStorage.setItem(returnKey(id), encrypted);
        }
      } else {
        continue; // Encrypted but no key — skip
      }

      // Lazy schema migration
      if (needsMigration(parsed)) {
        const migrated = migrateReturn(parsed) as unknown as TaxReturn;
        if (migrated) parsed = migrated;
      }

      returnCache.set(id, parsed);
    } catch { /* skip corrupted entries */ }
  }
}

export function clearReturnCache(): void {
  returnCache.clear();
}

// ─── Helpers ─────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function getArrayField(tr: TaxReturn, field: keyof TaxReturn): Record<string, unknown>[] {
  return (tr[field] as Record<string, unknown>[] | undefined) ?? [];
}

function setArrayField(tr: TaxReturn, field: keyof TaxReturn, arr: Record<string, unknown>[]): void {
  (tr as unknown as Record<string, unknown>)[field] = arr;
}

function setField(tr: TaxReturn, key: string, value: unknown): void {
  (tr as unknown as Record<string, unknown>)[key] = value;
}

function getReturnIds(): string[] {
  const raw = localStorage.getItem(RETURNS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveReturnIds(ids: string[]) {
  localStorage.setItem(RETURNS_KEY, JSON.stringify(ids));
}

function readReturn(id: string): TaxReturn | null {
  // Try cache first (populated on unlock via loadAllReturns)
  if (returnCache.has(id)) return returnCache.get(id)!;

  // No cache hit — only allow plaintext reads during the brief window before
  // encryption is first configured (initial app load / migration).
  if (!getActiveKey()) return null; // Locked or not yet set up — refuse direct reads
  return null;
}

// ─── Pending Write Tracking ─────────────────────

let pendingWrites = 0;

/** Per-return write version counter — prevents stale async writes from overwriting newer data. */
const writeVersions = new Map<string, number>();

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (pendingWrites > 0) {
    e.preventDefault();
    // Legacy browsers need returnValue set
    e.returnValue = '';
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', handleBeforeUnload);
}

/** Write a TaxReturn to cache + localStorage. Encrypts if key is available. */
export function writeReturn(tr: TaxReturn) {
  // Always update cache synchronously
  returnCache.set(tr.id, tr);

  // Bump write version for this return
  const version = (writeVersions.get(tr.id) || 0) + 1;
  writeVersions.set(tr.id, version);

  // Persist to localStorage (encrypted if possible)
  const key = getActiveKey();
  if (key) {
    // Async encrypted write — only persist if this is still the latest version
    pendingWrites++;
    encryptStr(JSON.stringify(tr), key).then((encrypted) => {
      if (writeVersions.get(tr.id) !== version) return; // stale write — skip
      try {
        localStorage.setItem(returnKey(tr.id), encrypted);
      } catch (e) {
        console.error('Failed to save encrypted return:', e);
        toast.error('Storage is nearly full — consider exporting your data.', {
          id: 'storage-quota',
          duration: 10000,
        });
      }
    }).finally(() => { pendingWrites--; });
  } else {
    // Encryption is not set up OR key is missing — refuse to write plaintext.
    // The app gate forces encryption setup before any data entry, so this
    // branch should never be reached in normal operation.
    console.warn('writeReturn: encryption not available — data not persisted');
  }
}

// ─── Public API (same signatures as the old server client) ───

export function createReturn(): TaxReturn {
  const now = new Date().toISOString();
  const id = generateId();
  const tr: TaxReturn = {
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    taxYear: 2025,
    status: 'in_progress',
    currentStep: 0,
    currentSection: 'my_info',
    dependents: [],
    w2Income: [],
    income1099NEC: [],
    income1099K: [],
    income1099INT: [],
    income1099DIV: [],
    income1099R: [],
    income1099G: [],
    income1099MISC: [],
    income1099B: [],
    rentalProperties: [],
    royaltyProperties: [],
    incomeK1: [],
    income1099SA: [],
    incomeW2G: [],
    income1099DA: [],
    income1099C: [],
    income1099Q: [],
    businesses: [],
    otherIncome: 0,
    expenses: [],
    deductionMethod: 'standard',
    educationCredits: [],
    incomeDiscovery: {},
    createdAt: now,
    updatedAt: now,
  };
  writeReturn(tr);
  const ids = getReturnIds();
  ids.push(id);
  saveReturnIds(ids);
  return tr;
}

/** Import a fully-formed TaxReturn (e.g. from a .telostax file). Saves to localStorage. */
export function importReturn(tr: TaxReturn): TaxReturn {
  if (isEncryptionSetup() && !getActiveKey()) {
    throw new Error('Cannot import while the vault is locked. Please unlock first.');
  }
  writeReturn(tr);
  const ids = getReturnIds();
  if (!ids.includes(tr.id)) {
    ids.push(tr.id);
    saveReturnIds(ids);
  }
  return tr;
}

export function listReturns(): TaxReturn[] {
  return getReturnIds()
    .map(readReturn)
    .filter((r): r is TaxReturn => r !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Export all returns as an encrypted .telostax download (data portability).
 * Uses PBKDF2 key derivation + AES-256-GCM, same pattern as fileTransfer.ts.
 */
export async function exportAllData(password: string): Promise<void> {
  const returns = listReturns();
  const data = {
    exportedAt: new Date().toISOString(),
    version: CURRENT_SCHEMA_VERSION,
    returns,
  };

  const plaintext = JSON.stringify(data, null, 2);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive encryption key from password via PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const file = {
    format: 'telostax-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    salt: Array.from(salt),
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
  };

  const blob = new Blob([JSON.stringify(file)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `telostax-export-${new Date().toISOString().slice(0, 10)}.telostax`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getReturn(id: string): TaxReturn {
  const tr = readReturn(id);
  if (!tr) throw new Error(`Return ${id} not found`);
  return tr;
}

/** Keys that must never be merged into a TaxReturn (prototype pollution + immutable fields). */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'id', 'createdAt', 'schemaVersion', 'taxYear']);

/** Prototype-pollution-only keys — used for sub-object sanitization (income items, upserts). */
const PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!FORBIDDEN_KEYS.has(key)) cleaned[key] = value;
  }
  return cleaned;
}

/** Strip prototype-pollution keys from a sub-object body (income items, upsert patches). */
function sanitizePatch<T extends object>(body: T): T {
  const cleaned = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(body)) {
    if (!PROTO_KEYS.has(key)) cleaned[key] = value;
  }
  return cleaned as T;
}

export function updateReturn(id: string, body: Record<string, unknown>): TaxReturn {
  const tr = readReturn(id);
  if (!tr) throw new Error(`Return ${id} not found`);
  const updated = { ...tr, ...sanitizeBody(body), updatedAt: new Date().toISOString() };
  writeReturn(updated);
  return updated;
}

export function deleteReturn(id: string): { success: boolean } {
  // Invalidate any pending async encrypted writes so they don't resurrect this return
  writeVersions.set(id, (writeVersions.get(id) || 0) + 1);
  localStorage.removeItem(returnKey(id));
  returnCache.delete(id);
  deleteChatHistory(id);
  const ids = getReturnIds().filter((i) => i !== id);
  saveReturnIds(ids);
  return { success: true };
}

/**
 * Wipe ALL TelosTax data: localStorage, sessionStorage, IndexedDB,
 * service worker caches, and SW registrations.
 * Intended for privacy-critical "delete everything" scenarios.
 */
export async function wipeAllData(): Promise<void> {
  // 0. Clear in-memory cache, lock vault, and invalidate pending writes
  returnCache.clear();
  lock();
  const ids = getReturnIds();
  for (const id of ids) writeVersions.set(id, Number.MAX_SAFE_INTEGER);

  // 1. Remove all TelosTax localStorage keys (returns + encryption + chat + AI)
  for (const id of ids) localStorage.removeItem(returnKey(id));
  localStorage.removeItem(RETURNS_KEY);
  localStorage.removeItem('telostax:salt');
  localStorage.removeItem('telostax:verify');
  localStorage.removeItem('telostax:ai-settings');
  localStorage.removeItem('telostax:expense-scanner');
  localStorage.removeItem('telostax:ai-key-enc');
  localStorage.removeItem('telostax:ai-key-migrate');
  localStorage.removeItem('telostax:expense-scanner-enc');
  deleteAllChatHistory();

  // 2. Clear sessionStorage
  sessionStorage.clear();

  // 3. Clear IndexedDB databases (pdfjs-dist may create these)
  if ('indexedDB' in window && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    } catch { /* databases() not supported in all browsers */ }
  }

  // 4. Clear service worker caches
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* caches API may fail in some environments */ }
  }

  // 5. Unregister service workers
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch { /* SW unregistration may fail */ }
  }

  // 6. Force a full page reload to destroy all in-memory Zustand state.
  // Without this, persist middleware can re-create wiped localStorage keys
  // from the still-alive in-memory store on the next state change.
  window.location.replace('/');
}

// ─── Income Items (generic CRUD for arrays) ──────

const ARRAY_FIELD_MAP: Record<string, keyof TaxReturn> = {
  w2: 'w2Income',
  '1099nec': 'income1099NEC',
  '1099k': 'income1099K',
  '1099int': 'income1099INT',
  '1099div': 'income1099DIV',
  '1099r': 'income1099R',
  '1099g': 'income1099G',
  '1099misc': 'income1099MISC',
  '1099b': 'income1099B',
  'rental-properties': 'rentalProperties',
  'royalty-properties': 'royaltyProperties',
  dependents: 'dependents',
  expenses: 'expenses',
  businesses: 'businesses',
  'education-credits': 'educationCredits',
  k1: 'incomeK1',
  '1099sa': 'income1099SA',
  '1099da': 'income1099DA',
  '1099oid': 'income1099OID',
  w2g: 'incomeW2G',
  '1099c': 'income1099C',
  '1099q': 'income1099Q',
  'depreciation-assets': 'depreciationAssets',
  form4797: 'form4797Properties',
};

export function addIncomeItem<T extends object>(
  returnId: string,
  type: string,
  body: T,
): { id: string; [key: string]: unknown } {
  const tr = getReturn(returnId);
  const field = ARRAY_FIELD_MAP[type];
  if (!field) throw new Error(`Unknown item type: ${type}`);

  const item = { ...sanitizePatch(body), id: generateId() };
  // Clone to avoid mutating the shared reference held by the Zustand store
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  setArrayField(updated, field, [...getArrayField(tr, field), item]);
  writeReturn(updated);
  return item;
}

/**
 * Batch-add multiple income items at once (single localStorage write).
 * Used by the CSV import feature for bulk 1099-B / 1099-DA inserts.
 */
export function batchAddIncomeItems(
  returnId: string,
  type: string,
  items: Record<string, unknown>[],
): { ids: string[]; count: number } {
  const tr = getReturn(returnId);
  const field = ARRAY_FIELD_MAP[type];
  if (!field) throw new Error(`Unknown item type: ${type}`);

  const newArr = [...getArrayField(tr, field)];
  const ids: string[] = [];
  for (const body of items) {
    const item = { ...sanitizePatch(body), id: generateId() };
    newArr.push(item);
    ids.push(item.id as string);
  }
  // Clone to avoid mutating the shared reference held by the Zustand store
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  setArrayField(updated, field, newArr);
  writeReturn(updated);
  return { ids, count: ids.length };
}

export function updateIncomeItem<T extends object>(
  returnId: string,
  type: string,
  itemId: string,
  body: T,
): { id: string; [key: string]: unknown } {
  const tr = getReturn(returnId);
  const field = ARRAY_FIELD_MAP[type];
  if (!field) throw new Error(`Unknown item type: ${type}`);

  const arr = getArrayField(tr, field);
  const idx = arr.findIndex((i) => i.id === itemId);
  if (idx === -1) throw new Error(`Item ${itemId} not found`);
  const updatedItem = { ...arr[idx], ...sanitizePatch(body), id: itemId };
  // Clone to avoid mutating the shared reference held by the Zustand store
  const updatedTR = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  setArrayField(updatedTR, field, arr.map((item, i) => i === idx ? updatedItem : item));
  writeReturn(updatedTR);
  return updatedItem;
}

export function deleteIncomeItem(
  returnId: string,
  type: string,
  itemId: string,
): { success: boolean } {
  const tr = getReturn(returnId);
  const field = ARRAY_FIELD_MAP[type];
  if (!field) throw new Error(`Unknown item type: ${type}`);

  // Clone to avoid mutating the shared reference held by the Zustand store
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  setArrayField(updated, field, getArrayField(tr, field).filter((i) => i.id !== itemId));
  writeReturn(updated);
  return { success: true };
}

// ─── Business ───────────────────────────────────

/** Fields that belong to each sub-object, used to prevent data pollution. */
const BUSINESS_FIELDS = new Set(['businessName', 'businessEin', 'accountingMethod', 'didStartThisYear', 'naicsCode', 'businessType']);
const HOME_OFFICE_FIELDS = new Set(['homeOfficeMethod', 'method', 'squareFeet', 'totalHomeSqFt', 'homeExpenses', 'hoursUsed', 'monthsUsed']);
const VEHICLE_FIELDS = new Set(['vehicleMethod', 'businessMiles', 'commutingMiles', 'otherMiles', 'totalMiles', 'dateInService', 'availableForPersonalUse']);

function pickFields(body: Record<string, unknown>, allowedKeys: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

export function upsertBusiness(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  // Clone to avoid mutating the shared reference held by the Zustand store
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  // Body may contain business fields, homeOffice fields, or vehicle fields.
  // Only spread the relevant subset into each sub-object to prevent data pollution.
  const businessPatch = pickFields(body, BUSINESS_FIELDS);
  if (Object.keys(businessPatch).length > 0) {
    updated.business = {
      ...(tr.business || { id: generateId(), accountingMethod: 'cash', didStartThisYear: false }),
      ...businessPatch,
    } as TaxReturn['business'];
  }
  const homeOfficePatch = pickFields(body, HOME_OFFICE_FIELDS);
  if (Object.keys(homeOfficePatch).length > 0) {
    updated.homeOffice = { ...(tr.homeOffice || { method: null }), ...homeOfficePatch } as TaxReturn['homeOffice'];
  }
  const vehiclePatch = pickFields(body, VEHICLE_FIELDS);
  if (Object.keys(vehiclePatch).length > 0) {
    updated.vehicle = { ...(tr.vehicle || { method: null }), ...vehiclePatch } as TaxReturn['vehicle'];
  }
  // Also allow direct top-level fields (sanitize nested objects)
  const topLevelKeys = ['business', 'homeOffice', 'vehicle', 'costOfGoodsSold', 'returnsAndAllowances'];
  for (const key of topLevelKeys) {
    if (body[key] !== undefined) {
      const raw = body[key];
      const sanitized = typeof raw === 'object' && raw !== null
        ? sanitizePatch(raw as Record<string, unknown>)
        : raw;
      setField(updated, key, sanitized);
    }
  }
  writeReturn(updated);
  return updated;
}

// ─── Itemized Deductions ────────────────────────

export function upsertItemized(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.itemizedDeductions = {
    ...(tr.itemizedDeductions || {
      medicalExpenses: 0, stateLocalIncomeTax: 0, realEstateTax: 0,
      personalPropertyTax: 0, mortgageInterest: 0, mortgageInsurancePremiums: 0,
      charitableCash: 0, charitableNonCash: 0, casualtyLoss: 0, otherDeductions: 0,
    }),
    ...sanitizePatch(body),
  } as TaxReturn['itemizedDeductions'];
  writeReturn(updated);
  return updated;
}

// ─── Child Tax Credit ───────────────────────────

export function upsertChildTaxCredit(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.childTaxCredit = {
    ...(tr.childTaxCredit || { qualifyingChildren: 0, otherDependents: 0 }),
    ...sanitizePatch(body),
  } as TaxReturn['childTaxCredit'];
  writeReturn(updated);
  return updated;
}

// ─── SSA-1099 (one per return, upsert) ─────────

export function upsertSSA1099(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.incomeSSA1099 = {
    ...(tr.incomeSSA1099 || { id: generateId(), totalBenefits: 0, federalTaxWithheld: 0 }),
    ...sanitizePatch(body),
  } as TaxReturn['incomeSSA1099'];
  writeReturn(updated);
  return updated;
}

export function deleteSSA1099(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, incomeSSA1099: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Dependent Care Credit ──────────────────────

export function upsertDependentCare(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.dependentCare = {
    ...(tr.dependentCare || { totalExpenses: 0, qualifyingPersons: 1 }),
    ...sanitizePatch(body),
  } as TaxReturn['dependentCare'];
  writeReturn(updated);
  return updated;
}

export function deleteDependentCare(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, dependentCare: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Saver's Credit ─────────────────────────────

export function upsertSaversCredit(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.saversCredit = {
    ...(tr.saversCredit || { totalContributions: 0 }),
    ...sanitizePatch(body),
  } as TaxReturn['saversCredit'];
  writeReturn(updated);
  return updated;
}

export function deleteSaversCredit(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, saversCredit: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Clean Energy Credit ────────────────────────

export function upsertCleanEnergy(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.cleanEnergy = {
    ...(tr.cleanEnergy || {
      solarElectric: 0, solarWaterHeating: 0, smallWindEnergy: 0,
      geothermalHeatPump: 0, batteryStorage: 0, fuelCell: 0, fuelCellKW: 0,
    }),
    ...sanitizePatch(body),
  } as TaxReturn['cleanEnergy'];
  writeReturn(updated);
  return updated;
}

export function deleteCleanEnergy(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, cleanEnergy: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── EV Credit ─────────────────────────────────

export function upsertEVCredit(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.evCredit = {
    ...(tr.evCredit || {
      vehicleDescription: '', vehicleMSRP: 0, purchasePrice: 0,
      isNewVehicle: true, finalAssemblyUS: true,
      meetsBatteryComponentReq: true, meetsMineralReq: true,
    }),
    ...sanitizePatch(body),
  } as TaxReturn['evCredit'];
  writeReturn(updated);
  return updated;
}

export function deleteEVCredit(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, evCredit: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Energy Efficiency Credit ──────────────────

export function upsertEnergyEfficiency(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.energyEfficiency = {
    ...(tr.energyEfficiency || {
      heatPump: 0, centralAC: 0, waterHeater: 0, furnaceBoiler: 0,
      insulation: 0, windows: 0, doors: 0, electricalPanel: 0, homeEnergyAudit: 0,
    }),
    ...sanitizePatch(body),
  } as TaxReturn['energyEfficiency'];
  writeReturn(updated);
  return updated;
}

export function deleteEnergyEfficiency(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, energyEfficiency: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Adoption Credit ───────────────────────────

export function upsertAdoptionCredit(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.adoptionCredit = {
    ...(tr.adoptionCredit || { qualifiedExpenses: 0, numberOfChildren: 1, isSpecialNeeds: false }),
    ...sanitizePatch(body),
  } as TaxReturn['adoptionCredit'];
  writeReturn(updated);
  return updated;
}

export function deleteAdoptionCredit(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, adoptionCredit: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Premium Tax Credit ────────────────────────

export function upsertPremiumTaxCredit(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.premiumTaxCredit = {
    ...(tr.premiumTaxCredit || { forms1095A: [], familySize: 1 }),
    ...sanitizePatch(body),
  } as TaxReturn['premiumTaxCredit'];
  writeReturn(updated);
  return updated;
}

export function deletePremiumTaxCredit(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, premiumTaxCredit: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Schedule R (Elderly/Disabled Credit) ──────

export function upsertScheduleR(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.scheduleR = {
    ...(tr.scheduleR || {
      isAge65OrOlder: false, isSpouseAge65OrOlder: false,
      isDisabled: false, isSpouseDisabled: false,
      nontaxableSocialSecurity: 0, nontaxablePensions: 0,
    }),
    ...sanitizePatch(body),
  } as TaxReturn['scheduleR'];
  writeReturn(updated);
  return updated;
}

export function deleteScheduleR(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, scheduleR: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Form 8801 (Prior Year Minimum Tax Credit) ──

export function upsertForm8801(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.form8801 = {
    ...(tr.form8801 || { netPriorYearMinimumTax: 0, priorYearCreditCarryforward: 0 }),
    ...sanitizePatch(body),
  } as TaxReturn['form8801'];
  writeReturn(updated);
  return updated;
}

export function deleteForm8801(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, form8801: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Archer MSA (Form 8853) ─────────────────────

export function upsertArcherMSA(
  returnId: string,
  body: Record<string, unknown>,
): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, updatedAt: new Date().toISOString() } as TaxReturn;
  updated.archerMSA = {
    ...(tr.archerMSA || { coverageType: 'self_only', hdhpDeductible: 0, personalContributions: 0, coverageMonths: 12 }),
    ...sanitizePatch(body),
  } as TaxReturn['archerMSA'];
  writeReturn(updated);
  return updated;
}

export function deleteArcherMSA(returnId: string): TaxReturn {
  const tr = getReturn(returnId);
  const updated = { ...tr, archerMSA: undefined, updatedAt: new Date().toISOString() } as TaxReturn;
  writeReturn(updated);
  return updated;
}

// ─── Expense Categories (static reference data) ─

export interface ExpenseCategory {
  schedule_c_line: number;
  category_key: string;
  display_name: string;
  description: string;
  examples: string;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { schedule_c_line: 8,  category_key: 'advertising',         display_name: 'Advertising',                   description: 'Business advertising and marketing costs',         examples: 'Google Ads, Facebook ads, business cards, flyers' },
  { schedule_c_line: 9,  category_key: 'car_truck',           display_name: 'Car & Truck Expenses',          description: 'Business use of your vehicle',                     examples: 'Gas, maintenance, insurance (business portion)' },
  { schedule_c_line: 10, category_key: 'commissions_fees',    display_name: 'Commissions & Fees',            description: 'Fees paid to agents, sales commissions',           examples: 'Platform fees (Fiverr, Upwork), agent commissions' },
  { schedule_c_line: 11, category_key: 'contract_labor',      display_name: 'Contract Labor',                description: 'Payments to non-employee contractors',             examples: 'Subcontractors, outside help' },
  { schedule_c_line: 12, category_key: 'depletion',           display_name: 'Depletion',                     description: 'Depletion of natural resources',                   examples: 'Rarely used by small businesses' },
  { schedule_c_line: 13, category_key: 'depreciation',        display_name: 'Depreciation & Section 179',    description: 'Depreciation of business assets',                  examples: 'Computer, camera, equipment over $2,500' },
  { schedule_c_line: 14, category_key: 'employee_benefits',   display_name: 'Employee Benefit Programs',     description: 'Benefits for employees (not yourself)',            examples: 'Health insurance for employees' },
  { schedule_c_line: 15, category_key: 'insurance',           display_name: 'Insurance',                     description: 'Business insurance premiums',                      examples: 'Liability insurance, E&O insurance' },
  { schedule_c_line: 16, category_key: 'interest_mortgage',    display_name: 'Mortgage Interest (16a)',        description: 'Interest on mortgages paid to financial institutions for business property',  examples: 'Business property mortgage, warehouse mortgage' },
  { schedule_c_line: 16, category_key: 'interest_other',      display_name: 'Other Interest (16b)',           description: 'All other business interest not paid on a mortgage to a financial institution',  examples: 'Business credit card interest, business loan interest, line of credit' },
  { schedule_c_line: 17, category_key: 'legal_professional',  display_name: 'Legal & Professional Services', description: 'Fees for lawyers, accountants',                    examples: 'Tax prep fees, legal consultation' },
  { schedule_c_line: 18, category_key: 'office_expense',      display_name: 'Office Expenses',               description: 'Office supplies and postage',                      examples: 'Printer ink, paper, stamps' },
  { schedule_c_line: 19, category_key: 'pension',             display_name: 'Pension & Profit-Sharing Plans', description: 'Contributions to plans for your employees (not yourself)',  examples: 'Employee 401(k) match, employee pension' },
  { schedule_c_line: 20, category_key: 'rent_equipment',      display_name: 'Rent — Equipment (20a)',         description: 'Rent or lease payments for vehicles, machinery, and equipment used in your business',  examples: 'Equipment lease, vehicle lease, machinery rental' },
  { schedule_c_line: 20, category_key: 'rent_property',       display_name: 'Rent — Business Property (20b)', description: 'Rent or lease payments for other business property such as office space or land',  examples: 'Office rent, coworking space, warehouse, studio' },
  { schedule_c_line: 21, category_key: 'repairs_maintenance', display_name: 'Repairs & Maintenance',         description: 'Repairs to business property',                     examples: 'Computer repair, equipment maintenance' },
  { schedule_c_line: 22, category_key: 'supplies',            display_name: 'Supplies',                      description: 'Supplies used in your business',                   examples: 'Raw materials, packaging' },
  { schedule_c_line: 23, category_key: 'taxes_licenses',      display_name: 'Taxes & Licenses',              description: 'Business taxes and license fees',                  examples: 'Business license, professional license' },
  { schedule_c_line: 24, category_key: 'travel',              display_name: 'Travel',                        description: 'Business travel expenses (100% deductible)',       examples: 'Flights, hotels, rental cars, Uber to client' },
  { schedule_c_line: 24, category_key: 'meals',               display_name: 'Business Meals (50%)',           description: 'Standard business meals \u2014 enter the full amount you spent and we\u2019ll apply the 50% limit automatically. This is the most common meals category and applies to the vast majority of filers.',  examples: 'Client dinners, meals while traveling, team lunches' },
  { schedule_c_line: 24, category_key: 'meals_dot',            display_name: 'DOT Meals (80%)',                description: 'Meals during DOT hours-of-service \u2014 enter the full amount and we\u2019ll apply the 80% limit automatically. Only for workers subject to Dept. of Transportation hours-of-service limits (long-haul truckers, airline pilots, interstate bus drivers, railroad workers). If unsure, use Business Meals (50%) instead.', examples: 'Meals while on the road under DOT hours-of-service rules' },
  { schedule_c_line: 24, category_key: 'meals_full',           display_name: 'Fully Deductible Meals (100%)',  description: 'Meals that are 100% deductible \u2014 rare situations only. Includes meals provided on your premises for employee convenience, company-wide recreational events (holiday parties, picnics), and meals sold to customers. Most self-employed filers will not use this category.', examples: 'Staff holiday party, company picnic, meals sold to customers' },
  { schedule_c_line: 25, category_key: 'utilities',           display_name: 'Utilities',                     description: 'Business utility costs',                           examples: 'Phone bill (business %), internet' },
  { schedule_c_line: 26, category_key: 'wages',               display_name: 'Wages',                         description: 'Wages paid to employees',                          examples: 'Employee salaries' },
  { schedule_c_line: 27, category_key: 'other_expenses',      display_name: 'Other Expenses',                description: 'Business expenses not listed above',               examples: 'Software subscriptions, education' },
];

export function getExpenseCategories(): ExpenseCategory[] {
  return EXPENSE_CATEGORIES;
}

// ─── Calculate (client-side via engine) ─────────

import { calculateForm1040, FilingStatus } from '@telostax/engine';

export function calculateReturn(returnId: string) {
  const tr = getReturn(returnId);
  const returnWithDefaults = {
    ...tr,
    filingStatus: tr.filingStatus || FilingStatus.Single,
  };
  return calculateForm1040(returnWithDefaults);
}

// ─── PDF (client-side via pdf-lib) ──────────────

export async function downloadPDF(returnId: string, password?: string): Promise<Blob> {
  const { generateFullReturnPDF } = await import('../services/pdfService');
  const tr = getReturn(returnId);
  const calc = calculateReturn(returnId);
  let pdfBytes = await generateFullReturnPDF(tr, calc);
  if (password) {
    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
    pdfBytes = await encryptPDF(new Uint8Array(pdfBytes), password);
  }
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export async function downloadIRSFormsPDF(returnId: string, password?: string): Promise<Blob> {
  const { generateFilingPacketPDF } = await import('../services/irsFormFiller');
  const tr = getReturn(returnId);
  const calc = calculateReturn(returnId);
  let pdfBytes = await generateFilingPacketPDF(tr, calc);
  if (password) {
    const { encryptPDF } = await import('@pdfsmaller/pdf-encrypt-lite');
    pdfBytes = await encryptPDF(new Uint8Array(pdfBytes), password);
  }
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

export default {};
