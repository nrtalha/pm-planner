/** Calendar-day helpers on ISO dates (YYYY-MM-DD). All maths is in UTC, so no time-zone drift. */

const DAY_MS = 86_400_000

export function toDayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS)
}

export function fromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(toDayNumber(iso) + days)
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** The first Monday–Friday strictly after `iso`. */
export function nextWeekday(iso: string): string {
  let day = toDayNumber(iso) + 1
  // 1970-01-01 was a Thursday, so (day + 4) % 7 gives 0 = Sunday … 6 = Saturday.
  while ([0, 6].includes((((day + 4) % 7) + 7) % 7)) day += 1
  return fromDayNumber(day)
}
