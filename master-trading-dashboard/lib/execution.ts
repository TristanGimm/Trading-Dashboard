import type { Trade, Outcome } from './types.ts';
export function recordedOutcome(trade: Trade): Outcome | null {
  return trade.netEur != null && Number.isFinite(trade.netEur) ? trade.netEur > 0 ? 'win' : trade.netEur < 0 ? 'loss' : 'breakeven' : trade.recordedOutcome ?? null;
}
export function executionStats(trades: Trade[]) {
  const average = (key: 'mfe30m' | 'mae30m') => {
    const values = trades.flatMap(t => typeof t[key] === 'number' && Number.isFinite(t[key]) ? [t[key]!] : []);
    return { count: values.length, average: values.length ? values.reduce((a,b)=>a+b,0)/values.length : null };
  };
  const labels = [...new Set(['Fractal Shift', '1m Type 3', '5s Type 3', ...trades.flatMap(t=>t.tfType)])];
  const conditions = labels.flatMap(label => [true, false].map(present => {
    const tagged = trades.filter(t => (label === 'Fractal Shift' ? t.fractalShift : t.tfType.includes(label)) === present);
    const outcomes = tagged.map(recordedOutcome).filter(o=>o!==null);
    const wins = outcomes.filter(o=>o==='win').length;
    return { label: `${label} · ${present?'Yes':'No / untagged'}`, count: outcomes.length, wins, missing: tagged.filter(t=>recordedOutcome(t)!==null&&t.netEur==null).length, winRate: outcomes.length ? wins/outcomes.length*100 : null };
  }));
  return { mfe: average('mfe30m'), mae: average('mae30m'), conditions };
}
