import { AppError } from '../../../common/errors/app-error';
import type { ClosureRow, HoursRow } from '../data/drawer.repository';
import { localParts } from './time';

export const drawerNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Drawer not found' });
export const closureNotFound = (): AppError =>
  new AppError({ status: 404, code: 'NOT_FOUND', detail: 'Closure not found' });

export const invalidDrawerField = (field: string, message: string): AppError =>
  new AppError({
    status: 422,
    code: 'VALIDATION_FAILED',
    detail: 'Request validation failed',
    errors: [{ field, message }],
  });

export const outsideServiceArea = (): AppError =>
  new AppError({
    status: 422,
    code: 'OUTSIDE_SERVICE_AREA',
    detail: 'There is no Rento drawer near this location yet',
  });

export const permissionDenied = (): AppError =>
  new AppError({
    status: 403,
    code: 'PERMISSION_DENIED',
    detail: 'You do not have permission for this drawer',
  });

/** `HH:MM:SS` from the database or `HH:MM` from the API → minutes since midnight. */
export const minutesOf = (time: string): number => {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m);
};

export function validateHours(
  hours: ReadonlyArray<{ weekday: number; opensAt: string; closesAt: string }>,
): Array<{ field: string; message: string }> {
  const problems: Array<{ field: string; message: string }> = [];
  const seen = new Set<number>();
  hours.forEach((h, index) => {
    if (seen.has(h.weekday)) {
      problems.push({
        field: `hours.${index}.weekday`,
        message: 'each weekday can appear only once',
      });
    }
    seen.add(h.weekday);
    if (minutesOf(h.opensAt) >= minutesOf(h.closesAt)) {
      problems.push({
        field: `hours.${index}.closesAt`,
        message: 'must be later than opensAt (overnight hours are not supported)',
      });
    }
  });
  return problems;
}

/** Is the drawer open at this instant: inside that weekday's opening window (drawer-local) and not in a closure? */
export function isOpenAt(
  instant: Date,
  timeZone: string,
  hours: readonly HoursRow[],
  closures: readonly ClosureRow[],
): boolean {
  const local = localParts(instant, timeZone);
  const today = hours.find((h) => h.weekday === local.weekday);
  if (!today) return false;
  const now = minutesOf(local.time);
  if (now < minutesOf(today.opens_at) || now >= minutesOf(today.closes_at)) return false;
  return !closures.some(
    (c) => c.starts_at.getTime() <= instant.getTime() && instant.getTime() < c.ends_at.getTime(),
  );
}
