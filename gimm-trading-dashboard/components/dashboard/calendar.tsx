'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { calendarCells, shiftMonth, type TradingDay } from '@/lib/journal';
import { compactMoney, money, rate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Panel } from './primitives';

export function TradingCalendar({ days, today, onTrade }: { days: TradingDay[]; today: string; onTrade: (trade: Trade) => void }) {
  const [month, setMonth] = useState(() => days.at(-1)?.date.slice(0, 7) ?? today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const lookup = useMemo(() => new Map(days.map(day => [day.date, day])), [days]);
  const monthDays = days.filter(day => day.date.startsWith(month));
  const total = monthDays.reduce((sum, day) => sum + day.pnl, 0);
  const closed = monthDays.reduce((sum, day) => sum + day.closed, 0);
  const active = selected ? lookup.get(selected) : null;
  const cells = calendarCells(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7).flatMap(date => date && lookup.has(date) ? [lookup.get(date)!] : []));
  const [display, setDisplay] = useState<'pnl' | 'winRate'>('pnl');
  const label = new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const navigate = (direction: number) => { setMonth(shiftMonth(month, direction)); setSelected(null); };

  return <Panel title="Trading calendar" subtitle="Your performance, one day at a time" footer={<><span className="legend"><span className="legend-item"><i className="legend-dot positive"/>Profit</span><span className="legend-item"><i className="legend-dot negative"/>Loss</span><span className="legend-item"><i className="legend-dot muted"/>Break-even / unrecorded</span></span><span>Click a trading day to review its trades</span></>}>
    <div className="panel-content"><div className="calendar-heading"><div className="calendar-controls"><button type="button" className="icon-button" aria-label="Previous month" onClick={() => navigate(-1)}><ChevronLeft size={15}/></button><strong aria-live="polite">{label}</strong><button type="button" className="icon-button" aria-label="Next month" onClick={() => navigate(1)}><ChevronRight size={15}/></button></div><div className="calendar-summary"><button type="button" className="button calendar-today" onClick={() => { setMonth(today.slice(0, 7)); setSelected(null); }}>This month</button><span>{closed} closed trades</span><strong className={total < 0 ? 'negative' : total > 0 ? 'positive' : ''}>{money(total)}</strong></div></div>
      <div className="calendar-display"><div className="segmented" aria-label="Calendar values"><button type="button" className={display === 'pnl' ? 'selected' : ''} aria-pressed={display === 'pnl'} onClick={() => setDisplay('pnl')}>Net P&L</button><button type="button" className={display === 'winRate' ? 'selected' : ''} aria-pressed={display === 'winRate'} onClick={() => setDisplay('winRate')}>Win rate</button></div><span>Weekly results →</span></div>
      <div className="calendar-with-weeks"><div>
      <div className="calendar-weekdays" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid" aria-label={`Trading performance in ${label}`}>
        {cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="calendar-cell blank" aria-hidden="true"/>;
          const day = lookup.get(date);
          return <button type="button" key={date} disabled={!day} aria-pressed={selected === date} aria-label={`${date}: ${day ? `${day.closed ? money(day.pnl) : 'unrecorded P&L'}, ${day.count} trades` : 'no trades'}`} className={cn('calendar-cell', day && 'has-trades', day && day.pnl > 0 && 'gain', day && day.pnl < 0 && 'loss', date === today && 'today', date === selected && 'selected')} onClick={() => setSelected(selected === date ? null : date)}><span>{Number(date.slice(-2))}</span>{day && <><strong>{day.closed ? display === 'pnl' ? compactMoney(day.pnl) : rate(day.wins / day.closed * 100) : '—'}</strong><small>{day.count} {day.count === 1 ? 'trade' : 'trades'}</small><small className="calendar-day-rate">{day.closed ? `${rate(day.wins / day.closed * 100)} wins` : day.trades.some(t=>t.recordedOutcome) ? `${day.trades.filter(t=>t.recordedOutcome==='win').length} wins · Net € missing` : 'No recorded outcome'}</small></>}</button>;
        })}
      </div>
      </div><div className="calendar-weeks">{weeks.map((week, index) => { const pnl = week.reduce((sum, day) => sum + day.pnl, 0); const activeDays = week.filter(day => day.closed > 0).length; return <div className="calendar-week" key={index}><span>Week {index + 1}</span><strong className={pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : ''}>{money(pnl)}</strong><small>{activeDays} {activeDays === 1 ? 'day' : 'days'}</small></div>; })}</div></div>
      {!monthDays.length && <p className="panel-subtitle" style={{ marginTop: 15 }}>No trades in this month for the selected account and period.</p>}
      {active && <div className="calendar-day-detail" aria-live="polite"><h3>{new Date(active.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}<span className="muted" style={{ fontWeight: 400 }}> · {active.count} trades</span></h3>{active.trades.map(trade => <button type="button" key={trade.id} className="day-trade" onClick={() => onTrade(trade)}><div>#{trade.tradeId} · {trade.pair || 'Unspecified pair'} <span> / {trade.position || '—'}</span></div><strong className={trade.netEur !== null && trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}>{trade.netEur === null ? trade.recordedOutcome ? `${trade.recordedOutcome} · Net € missing` : 'Unrecorded' : money(trade.netEur)}</strong></button>)}</div>}
    </div>
  </Panel>;
}
