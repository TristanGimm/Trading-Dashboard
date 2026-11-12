import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { calculatePerformance, filterTrades } from '@/lib/analytics';
import { lastTradeUpdate, listTrades } from '@/lib/db';
import { makeDemoTrades } from '@/lib/demo';
import type { DashboardPayload, DashboardView, Trade } from '@/lib/types';

export type DashboardQuery = { period?: string; account?: string };

export function isDemoMode(): boolean {
  return process.env.GIMM_DEMO_MODE === 'true' && process.env.PGHOST === '127.0.0.1' && process.env.PGPORT === '1';
}

export async function loadDashboardData(view: DashboardView, query: DashboardQuery, path: string): Promise<{ data: DashboardPayload; loadError: string | null }> {
  await requireSession(path);
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  const account = ['Forwardtesting', 'Backtest', 'all'].includes(query.account || '') ? query.account! : 'Forwardtesting';
  const period = ['all', '30d', '90d', '365d'].includes(query.period || '') ? query.period! : 'all';
  const now = new Date();
  const todayParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  const demo = isDemoMode();
  let trades: Trade[] = [];
  let lastUpdated: string | null = null;
  let loadError: string | null = null;
  try {
    if (demo) {
      trades = filterTrades(makeDemoTrades(now), account, period, now);
      lastUpdated = now.toISOString();
    } else {
      [trades, lastUpdated] = await Promise.all([listTrades({ account, period }), lastTradeUpdate()]);
    }
  } catch {
    loadError = 'Trading data is currently unavailable.';
  }

  const recent = [...trades].sort((a, b) => (b.dateTime ? Date.parse(b.dateTime) : 0) - (a.dateTime ? Date.parse(a.dateTime) : 0));
  const data: DashboardPayload = {
    view, demo, generatedAt: now.toISOString(),
    today: `${todayParts.year}-${todayParts.month}-${todayParts.day}`,
    timeZone,
    performance: calculatePerformance(trades, timeZone),
    trades: recent,
    lastUpdated,
    selectedAccount: account,
    selectedPeriod: period,
  };
  return { data, loadError };
}
