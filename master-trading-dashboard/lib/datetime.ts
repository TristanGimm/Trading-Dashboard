/** Helpers for wall-clock <-> UTC conversion in a configured IANA timezone. */

function parts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date).map(part => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function wallClockMs(date: Date, timeZone: string): number {
  const value = parts(date, timeZone);
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
}

/** Offset of the timezone at a given instant, in milliseconds. */
function offsetAt(timestamp: number, timeZone: string): number {
  return wallClockMs(new Date(timestamp), timeZone) - timestamp;
}

/** Format an ISO instant for a datetime-local input in the configured timezone. */
export function isoToDateTimeInput(iso: string | null, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const value = parts(date, timeZone);
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}T${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}

/** Format an ISO instant for a date input in the configured timezone. */
export function isoToDateInput(iso: string | null, timeZone: string): string {
  const formatted = isoToDateTimeInput(iso, timeZone);
  return formatted ? formatted.slice(0, 10) : '';
}

/**
 * Convert a datetime-local wall clock in the configured timezone to an ISO instant.
 * Returns null for an empty or impossible local time (for example a DST gap).
 */
export function dateTimeInputToIso(value: string, timeZone: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match;
  const wall = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (!Number.isFinite(wall)) return null;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  // Two passes settle the offset around daylight-saving transitions.
  let timestamp = wall - offsetAt(wall, timeZone);
  timestamp = wall - offsetAt(timestamp, timeZone);
  const result = new Date(timestamp);
  if (!Number.isFinite(result.getTime())) return null;
  // Reject wall-clock values that do not exist in this timezone (DST gap).
  if (wallClockMs(result, timeZone) !== wall) return null;
  return result.toISOString();
}
