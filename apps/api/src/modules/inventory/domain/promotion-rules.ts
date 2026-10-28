/** Banners ("promotions") on the customer app's home screen (M29). Pure rules; the clock is passed in. */

export const PROMOTION_THEMES = ['orange', 'ink', 'teal', 'plum'] as const;
export type PromotionTheme = (typeof PROMOTION_THEMES)[number];

export type PromotionState = 'live' | 'scheduled' | 'ended' | 'off';

export interface PromotionWindow {
  active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
}

/**
 * What customers see right now: `off` when staff switched it off, `scheduled` before it begins, `ended` once the end
 * instant has passed, otherwise `live`. The window is half-open like a booking: the start is in, the end is out.
 */
export function promotionState(p: PromotionWindow, now: Date): PromotionState {
  if (!p.active) return 'off';
  if (p.starts_at && now < p.starts_at) return 'scheduled';
  if (p.ends_at && now >= p.ends_at) return 'ended';
  return 'live';
}

export const promotionWindowProblem = (
  startsAt: Date | null,
  endsAt: Date | null,
): { field: 'endsAt'; message: string } | undefined =>
  startsAt && endsAt && endsAt <= startsAt
    ? { field: 'endsAt', message: 'must be after the start' }
    : undefined;
