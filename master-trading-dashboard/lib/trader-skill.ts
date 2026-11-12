import type { Performance, Trade } from './types.ts';
import type { TradingDay } from './journal.ts';

const clamp = (value: number) => Math.max(0, Math.min(100, value));
export function traderSkill(p: Performance, days: TradingDay[]) {
  const active = days.filter(day => day.closed > 0);
  const avgWin = p.wins ? p.grossProfit / p.wins : 0;
  const avgLoss = p.losses ? p.grossLoss / p.losses : 0;
  const payoff = avgLoss ? avgWin / avgLoss : avgWin ? Infinity : 0;
  const recovery = p.maxDrawdown ? p.netPnl / p.maxDrawdown : p.netPnl > 0 ? Infinity : 0;
  // Amount-independent scores; capital is deliberately not inferred from transfers.
  const riskBase = Math.max(p.grossProfit, p.grossLoss);
  const dimensions = [
    { label: 'Win rate', value: clamp(p.winRate), detail: `${p.winRate.toFixed(1)}% winning closed trades`, formula: 'Win rate in percent' },
    { label: 'Consistency', value: active.length ? active.filter(day => day.pnl > 0).length / active.length * 100 : 0, detail: `${active.filter(day => day.pnl > 0).length} / ${active.length} profitable trading days`, formula: 'Profitable days / days with recorded outcomes × 100' },
    { label: 'Profit factor', value: clamp((p.profitFactor ?? (p.grossProfit ? Infinity : 0)) / 3 * 100), detail: p.profitFactor === null ? p.grossProfit ? 'No recorded losses' : 'No gross profit or loss' : `${p.profitFactor.toFixed(2)} profit factor`, formula: 'Gross profit / absolute gross loss; 3.0 earns 100 points' },
    { label: 'Win / loss', value: clamp(payoff / 3 * 100), detail: `${Number.isFinite(payoff) ? payoff.toFixed(2) : '∞'} average win / loss`, formula: 'Average win / average absolute loss; 3.0 earns 100 points' },
    { label: 'Recovery', value: clamp(recovery / 3 * 100), detail: `${Number.isFinite(recovery) ? recovery.toFixed(2) : '∞'} net P&L / drawdown`, formula: 'Net P&L / maximum drawdown; 3.0 earns 100 points' },
    { label: 'Drawdown control', value: riskBase ? clamp((1 - p.maxDrawdown / riskBase) * 100) : 0, detail: 'Drawdown relative to gross profit or loss', formula: '(1 − max drawdown / max(gross profit, absolute gross loss)) × 100' },
  ];
  const score = p.closed ? Math.round(dimensions.reduce((sum, item) => sum + item.value, 0) / dimensions.length * 10) / 10 : null;
  return { score, dimensions, provisional: p.closed < 30, avgWin, avgLoss, payoff };
}

export function streakStats(values: number[]) {
  let current = 0, bestWin = 0, bestLoss = 0;
  for (const value of values) {
    if (value > 0) { current = current > 0 ? current + 1 : 1; bestWin = Math.max(bestWin, current); }
    else if (value < 0) { current = current < 0 ? current - 1 : -1; bestLoss = Math.max(bestLoss, -current); }
    else current = 0;
  }
  return { current, bestWin, bestLoss };
}

export function tradingStreaks(trades: Trade[], days: TradingDay[]) {
  const dated = trades.filter((trade): trade is Trade & { netEur: number; dateTime: string } => trade.netEur !== null && Number.isFinite(trade.netEur) && !!trade.dateTime && Number.isFinite(Date.parse(trade.dateTime)))
    .sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime) || a.id.localeCompare(b.id));
  return {
    trades: streakStats(dated.map(trade => trade.netEur)),
    days: streakStats([...days].filter(day => day.closed > 0).sort((a, b) => a.date.localeCompare(b.date)).map(day => day.pnl)),
  };
}
