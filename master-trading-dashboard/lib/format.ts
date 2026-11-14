export const money = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(value);
export const compactMoney = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', notation: 'compact', minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
export const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
export const rate = (value: number) => `${value.toFixed(1)}%`;

/**
 * Realised P&L as a percentage of the recorded account balance.
 *
 * This is the single definition used by the form, the API and the detail
 * views, so the stored number can never drift from the two inputs it is made
 * of. Missing inputs or a zero balance return null instead of inventing a
 * percentage.
 */
export function pnlPercentOf(
  netEur: number | null | undefined,
  accountBalance: number | null | undefined,
): number | null {
  if (netEur === null || netEur === undefined) return null;
  if (accountBalance === null || accountBalance === undefined) return null;
  if (!Number.isFinite(netEur) || !Number.isFinite(accountBalance) || accountBalance === 0) return null;
  return Math.round((netEur / accountBalance) * 10000) / 100;
}

/** Format a derived PnL percentage for display, with an explicit sign. */
export function pnlPercentLabel(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return '—';
  return `${percent > 0 ? '+' : ''}${percent.toFixed(2)} %`;
}
