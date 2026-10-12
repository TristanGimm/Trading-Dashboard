import { recordedOutcome } from './execution.ts';
import type { Trade } from './types.ts';

export type TradingDay = { date: string; pnl: number; count: number; closed: number; wins: number; trades: Trade[] };
export type JournalOutcome = 'all' | 'win' | 'loss' | 'breakeven' | 'unrecorded';
export type JournalFilters = { search: string; outcome: JournalOutcome; pair: string; order: 'latest' | 'oldest' | 'profit' | 'loss' };

export function groupTradingDays(trades: Trade[], timeZone: string): TradingDay[] {
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = new Map<string, TradingDay>();
  for (const trade of trades) {
    if (!trade.dateTime || !Number.isFinite(Date.parse(trade.dateTime))) continue;
    const parts = Object.fromEntries(format.formatToParts(new Date(trade.dateTime)).map(part => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const day = days.get(date) ?? { date, pnl: 0, count: 0, closed: 0, wins: 0, trades: [] };
    day.count++;
    day.trades.push(trade);
    if (trade.netEur !== null && Number.isFinite(trade.netEur)) {
      day.pnl += trade.netEur;
      day.closed++;
      if (trade.netEur > 0) day.wins++;
    }
    days.set(date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(day => ({ ...day, pnl: Math.round(day.pnl * 100) / 100 }));
}

export function calendarCells(month: string): (string | null)[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, number] = month.split('-').map(Number);
  if (year < 1000) return [];
  const first = new Date(Date.UTC(year, number - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= length; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function shiftMonth(month: string, amount: number): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function filterJournal(trades: Trade[], filters: JournalFilters): Trade[] {
  const search = filters.search.trim().toLocaleLowerCase();
  return trades.filter(trade => {
    if (filters.pair !== 'all' && trade.pair !== filters.pair) return false;
    const outcome = recordedOutcome(trade) ?? 'unrecorded';
    if (filters.outcome !== 'all' && filters.outcome !== outcome) return false;
    return !search || [trade.tradeId, trade.pair, trade.position, ...trade.setup, ...trade.sessionTime, ...trade.account].filter(Boolean).join(' ').toLocaleLowerCase().includes(search);
  }).sort((a, b) => {
    if (filters.order === 'profit' || filters.order === 'loss') {
      if (a.netEur === null) return b.netEur === null ? a.id.localeCompare(b.id) : 1;
      if (b.netEur === null) return -1;
      return (filters.order === 'profit' ? b.netEur - a.netEur : a.netEur - b.netEur) || a.id.localeCompare(b.id);
    }
    const timestamp = (trade: Trade) => trade.dateTime && Number.isFinite(Date.parse(trade.dateTime)) ? Date.parse(trade.dateTime) : null;
    const left = timestamp(a), right = timestamp(b);
    if (left === null) return right === null ? a.id.localeCompare(b.id) : 1;
    if (right === null) return -1;
    return (filters.order === 'latest' ? right - left : left - right) || a.id.localeCompare(b.id);
  });
}

function csvCell(value: string | number | null): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value ?? '';
  // Spreadsheet exports must not interpret journal text as a formula.
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function tradesToCsv(trades: Trade[]): string {
  const rows: (string | number | null)[][] = [['Trade', 'Entry time (ISO)', 'Account', 'Pair', 'Direction', 'Setup', 'Session', 'Net EUR', 'R multiple', 'Recorded outcome', 'TF Type', 'Fractal Shift', 'MFE (30 min)', 'MAE (30 min)']];
  for (const trade of trades) rows.push([trade.tradeId, trade.dateTime, trade.account.join(' / '), trade.pair, trade.position, trade.setup.join(' / '), trade.sessionTime.join(' / '), trade.netEur, trade.rMultiple, trade.recordedOutcome??null, trade.tfType.join(' / '), trade.fractalShift?'Yes':'No', trade.mfe30m??null, trade.mae30m??null]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function journalSummary(trades: Trade[], days: TradingDay[]) {
  const closed = trades.filter((trade): trade is Trade & { netEur: number } => trade.netEur !== null && Number.isFinite(trade.netEur));
  const wins = closed.filter(trade => trade.netEur > 0), losses = closed.filter(trade => trade.netEur < 0);
  const averageWin = wins.length ? wins.reduce((sum, trade) => sum + trade.netEur, 0) / wins.length : null;
  const averageLoss = losses.length ? Math.abs(losses.reduce((sum, trade) => sum + trade.netEur, 0) / losses.length) : null;
  const active = days.filter(day => day.closed > 0);
  const ranked = [...active].sort((a, b) => b.pnl - a.pnl);
  return {
    averageWin, averageLoss,
    payoff: averageWin !== null && averageLoss !== null ? averageWin / averageLoss : null,
    activeDays: active.length,
    profitableDays: active.filter(day => day.pnl > 0).length,
    bestDay: ranked[0] ?? null,
    worstDay: ranked.at(-1) ?? null,
  };
}

export function drawdownPoints(cumulative: { time: string; value: number }[]) {
  let peak = 0;
  return cumulative.map(point => { peak = Math.max(peak, point.value); return { time: point.time, value: Math.round((point.value - peak) * 100) / 100 }; });
}
