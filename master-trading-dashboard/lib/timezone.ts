export function getDashboardTimezone(value?: string): string {
  try {
    const timeZone = value || 'Europe/Berlin';
    new Intl.DateTimeFormat('en', { timeZone }).format();
    return timeZone;
  } catch { return 'Europe/Berlin'; }
}
