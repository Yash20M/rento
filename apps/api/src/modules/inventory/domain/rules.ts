/** Lower-case URL slug: `Game Consoles & VR` → `game-consoles-vr`. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ASSET_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;

export const MAX_PRICE_PAISE = 10_000_000; // ₹100,000 per slot / deposit: a sanity bound, not a business rule
export const MAX_SLOT_MINUTES = 24 * 60;
export const MAX_DURATION_MINUTES = 7 * 24 * 60;
export const MAX_BUFFER_MINUTES = 12 * 60;

export interface ModelRules {
  slotMinutes: number;
  minDurationMin: number;
  maxDurationMin: number;
  bufferMin: number;
}

/** Cross-field rules of an item model's booking parameters (README §9.7). Returns problems keyed by field. */
export function modelRuleProblems(rules: ModelRules): Array<{ field: string; message: string }> {
  const problems: Array<{ field: string; message: string }> = [];
  if (rules.minDurationMin % rules.slotMinutes !== 0) {
    problems.push({ field: 'minDurationMin', message: 'must be a multiple of slotMinutes' });
  }
  if (rules.maxDurationMin % rules.slotMinutes !== 0) {
    problems.push({ field: 'maxDurationMin', message: 'must be a multiple of slotMinutes' });
  }
  if (rules.maxDurationMin < rules.minDurationMin) {
    problems.push({ field: 'maxDurationMin', message: 'must be at least minDurationMin' });
  }
  return problems;
}

export type AssetStatus = 'available' | 'maintenance' | 'in_transfer' | 'retired';

/** Statuses an administrator may move an asset between. `in_transfer` is set by the transfer workflow only. */
const TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  available: ['maintenance', 'retired'],
  maintenance: ['available', 'retired'],
  in_transfer: [],
  retired: [],
};

export const canTransition = (from: AssetStatus, to: AssetStatus): boolean =>
  from === to || TRANSITIONS[from].includes(to);

/** Leaving `available` makes the asset unbookable, so it must have no upcoming bookings. */
export const needsNoFutureBookings = (from: AssetStatus, to: AssetStatus): boolean =>
  from === 'available' && (to === 'maintenance' || to === 'retired');
