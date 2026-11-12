import { ArrowDownRight, ArrowUpRight, Gauge, Target, TrendingUp } from 'lucide-react';
import type { Performance } from '@/lib/types';
import { money, number, rate } from '@/lib/format';
import { Sparkline } from './primitives';

export function Metrics({ performance: p, variant = 'all' }: { performance: Performance; variant?: 'all' | 'primary' | 'secondary' }) {
  return <div className={`metrics-grid metrics-${variant}`}>
    {variant !== 'secondary' && <>
    <article className="metric-card highlight"><div className="metric-top">Net P&L<TrendingUp size={15}/></div><div className={`metric-value ${p.netPnl < 0 ? 'negative' : 'positive'}`}>{money(p.netPnl)}</div><p className="metric-description">{p.closed} closed trades · excluding transfers</p><div className="metric-bottom"><Sparkline values={p.cumulative.map(point => point.value)} color={p.netPnl < 0 ? 'var(--negative)' : 'var(--positive)'}/></div></article>
    <article className="metric-card"><div className="metric-top">Trade win rate<Target size={15}/></div><div className="metric-value">{p.closed ? rate(p.winRate) : '—'}</div><p className="metric-description">{p.wins} wins · {p.losses} losses · {p.breakeven} break-even</p><div className="metric-bottom"><div className="mini-progress"><span style={{ width: `${p.winRate}%`, background: 'var(--positive)' }}/><span style={{ width: `${p.closed ? p.losses / p.closed * 100 : 0}%`, background: 'var(--negative)' }}/></div></div></article>
    <article className="metric-card"><div className="metric-top">Profit factor<Gauge size={15}/></div><div className="metric-value">{p.profitFactor !== null ? number(p.profitFactor) : p.grossProfit ? '∞' : '—'}</div><p className="metric-description">Gross profit ÷ absolute gross loss</p><div className="metric-bottom"><div className="mini-progress"><span style={{ width: `${p.grossProfit + p.grossLoss ? p.grossProfit / (p.grossProfit + p.grossLoss) * 100 : 0}%`, background: '#9985ff' }}/></div></div></article>
    </>}
    {variant !== 'primary' && <>
    <article className="metric-card"><div className="metric-top">Average trade<ArrowUpRight size={15}/></div><div className={`metric-value ${p.avgPnl < 0 ? 'negative' : ''}`}>{p.closed ? money(p.avgPnl) : '—'}</div><p className="metric-description">Realized P&L per closed trade</p><div className="metric-bottom"><span className="metric-caption">Avg. R</span><span className="trade-tag">{p.avgR === null ? 'Unrecorded' : `${number(p.avgR)}R`}</span></div></article>
    <article className="metric-card"><div className="metric-top">Max drawdown<ArrowDownRight size={15}/></div><div className={`metric-value ${p.maxDrawdown > 0 ? 'negative' : ''}`}>{p.closed ? money(-p.maxDrawdown) : '—'}</div><p className="metric-description">From cumulative realized P&L</p><div className="metric-bottom"><span className="metric-caption">Best trade</span><span className="metric-caption positive">{p.bestTrade === null ? '—' : money(p.bestTrade)}</span></div></article>
    </>}
  </div>;
}
