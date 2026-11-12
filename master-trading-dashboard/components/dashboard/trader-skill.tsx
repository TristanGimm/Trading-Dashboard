'use client';

import { Flame, Shield, Sparkles } from 'lucide-react';
import type { Trade, Performance } from '@/lib/types';
import type { TradingDay } from '@/lib/journal';
import { traderSkill, tradingStreaks } from '@/lib/trader-skill';
import { money, number } from '@/lib/format';
import { Panel } from './primitives';

const point = (index: number, radius: number) => {
  const angle = index * Math.PI / 3 - Math.PI / 2;
  return [180 + Math.cos(angle) * radius, 144 + Math.sin(angle) * radius];
};

export function TraderSkill({ performance, days }: { performance: Performance; days: TradingDay[] }) {
  const skill = traderSkill(performance, days);
  const polygon = (radius: number) => skill.dimensions.map((_, index) => point(index, radius).join(',')).join(' ');
  return <Panel className="skill-panel" title="Traders Skill Level"  aside={<Shield size={17} className="skill-accent"/>}>
    <div className="skill-rank"><span className="rank-emblem"><Sparkles size={21}/></span><div><span className="eyebrow">PERFORMANCE SCORE</span><h3>{skill.score === null ? 'Building your sample' : 'Your trading skill'}</h3><p>{!performance.closed ? 'Record a closed trade to begin.' : skill.provisional ? `${performance.closed} / 30 trades · provisional score` : `${performance.closed} closed trades · selected period`}</p></div><strong>{skill.score === null ? '—' : number(skill.score)}<small>/ 100</small></strong></div>
    <svg className="skill-radar" viewBox="0 0 360 290" role="img" aria-label={skill.score === null ? 'Traders Skill Level radar: no closed trades' : `Traders Skill Level ${skill.score} out of 100. ${skill.dimensions.map(item => `${item.label}: ${Math.round(item.value)}`).join(', ')}`}>
      <defs><linearGradient id="skill-fill" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ac7dff" stopOpacity=".55"/><stop offset="1" stopColor="#4a8fff" stopOpacity=".18"/></linearGradient></defs>
      {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={polygon(94 * scale)} className="radar-ring"/>)}
      {skill.dimensions.map((item, index) => { const [x, y] = point(index, 94); const [lx, ly] = point(index, 122); return <g key={item.label}><line x1="180" y1="144" x2={x} y2={y} className="radar-ring"/><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle">{item.label}</text></g>; })}
      {skill.score !== null && <><polygon points={skill.dimensions.map((item, index) => point(index, item.value / 100 * 94).join(',')).join(' ')} fill="url(#skill-fill)" stroke="#a68bff" strokeWidth="2"/>{skill.dimensions.map((item, index) => { const [x, y] = point(index, item.value / 100 * 94); return <circle key={item.label} cx={x} cy={y} r="3" fill="#c9baff"/>; })}</>}
    </svg>
    <div className="skill-progress"><div><span>Traders Skill Level</span><strong>{skill.score === null ? 'No recorded outcomes' : `${number(skill.score)} / 100`}</strong></div><div className="rank-track"><span style={{ width: `${skill.score ?? 0}%` }}/></div><div className="rank-scale">{[0, 20, 40, 60, 80, 100].map(value => <span key={value}>{value}</span>)}</div></div>
    <details className="skill-method"><summary>How your score works</summary><p>A descriptive score: the equal-weight average of six dimensions, each capped between 0 and 100. It reflects the selected account and period. Scores below 30 closed trades are provisional.</p>{skill.dimensions.map(item => <div key={item.label}><strong>{item.label} · {Math.round(item.value)}/100</strong><p>{item.formula}. {item.detail}.</p></div>)}<p>Break-even trades count in win rate; days without recorded outcomes are excluded. This is a descriptive score for your recorded performance, using a fixed formula.</p></details>
  </Panel>;
}

export function PerformanceExtras({ performance, trades, days }: { performance: Performance; trades: Trade[]; days: TradingDay[] }) {
  const skill = traderSkill(performance, days);
  const streaks = tradingStreaks(trades, days);
  return <div className="performance-extras">
    <article className="panel payoff-card"><div className="metric-top">Average win / loss<Sparkles size={15}/></div><strong className="extra-value">{skill.avgLoss ? `${number(skill.payoff)} : 1` : skill.avgWin ? '∞ : 1' : '—'}</strong><div className="payoff-values"><span className="positive">{performance.wins ? money(skill.avgWin) : '—'}<small>Average win</small></span><span className="negative">{performance.losses ? money(-skill.avgLoss) : '—'}<small>Average loss</small></span></div><div className="payoff-track"><span style={{ width: `${skill.avgWin + skill.avgLoss ? skill.avgWin / (skill.avgWin + skill.avgLoss) * 100 : 0}%` }}/></div></article>
    <article className="panel streak-card"><div className="metric-top">Current streak<Flame size={16}/></div><div className="streak-columns">{(['days', 'trades'] as const).map(key => { const stats = streaks[key]; return <div key={key}><span className={`streak-orbit ${stats.current > 0 ? 'positive' : stats.current < 0 ? 'negative' : ''}`}>{Math.abs(stats.current)}</span><div><strong>{key === 'days' ? 'Trading days' : 'Closed trades'}</strong><small>{stats.current > 0 ? 'Winning streak' : stats.current < 0 ? 'Losing streak' : 'No active streak'}</small><p><span className="positive">Best win · {stats.bestWin}</span><span className="negative">Longest loss · {stats.bestLoss}</span></p></div></div>; })}</div><p className="streak-note">Break-even resets streaks · trade streaks use recorded entry dates</p></article>
  </div>;
}
