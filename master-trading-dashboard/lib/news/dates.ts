const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The briefing's day is always the reader's day in the dashboard timezone. */
export function dateInZone(timeZone: string, now = new Date()): string {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Calendar arithmetic on a date-only string; never touches the local clock. */
export function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function startOfWeek(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  const weekday = parsed.getUTCDay(); // 0 Sunday … 6 Saturday
  return shiftDate(date, -(weekday === 0 ? 6 : weekday - 1));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function startOfYear(date: string): string {
  return `${date.slice(0, 4)}-01-01`;
}

export function isoWeek(date: string): number {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(parsed.getUTCFullYear(), 0, 1));
  return Math.ceil((((parsed.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function monthName(date: string, locale = 'de-DE'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' });
}

export function weekdayName(date: string, locale = 'de-DE'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' });
}

export function shortDate(date: string, locale = 'de-DE'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

export function longDate(date: string, locale = 'de-DE'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function monthYear(date: string, locale = 'de-DE'): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** German label for a set of period boundaries, used in the prompt. */
export function periodContext(date: string): {
  today: string;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  yearStart: string;
  yearEnd: string;
  weekNumber: number;
} {
  const [year, month] = date.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    today: date,
    weekStart: startOfWeek(date),
    weekEnd: shiftDate(startOfWeek(date), 6),
    monthStart: startOfMonth(date),
    monthEnd,
    yearStart: `${date.slice(0, 4)}-01-01`,
    yearEnd: `${date.slice(0, 4)}-12-31`,
    weekNumber: isoWeek(date),
  };
}
