'use client';

import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { filterJournal, tradesToCsv, type JournalFilters } from '@/lib/journal';
import { money, number } from '@/lib/format';
import { EmptyState } from './primitives';

const defaultFilters: JournalFilters = { search: '', outcome: 'all', pair: 'all', order: 'latest' };

export function exportTrades(trades: Trade[]) {
  const blob = new Blob([tradesToCsv(trades)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `gimm-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TradeTable({ trades, timeZone, onTrade }: { trades: Trade[]; timeZone: string; onTrade: (trade: Trade) => void }) {
  return <div className="trade-table-scroll"><table className="trade-table"><caption className="sr-only">Trades from your Notion journal, shown in {timeZone}. Select a trade ID for details.</caption><thead><tr>{['Trade', 'Instrument', 'Entry date', 'Direction', 'Setup', 'R multiple', 'Net P&L'].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{trades.map(trade => <tr key={trade.id}>
    <td><button type="button" className="trade-id" onClick={() => onTrade(trade)} aria-label={`View trade ${trade.tradeId}`}>#{trade.tradeId || '—'}</button></td>
    <td><div className="pair-cell"><span className="pair-icon" aria-hidden="true">{trade.pair?.startsWith('XAU') ? 'Au' : trade.pair?.slice(0, 2) || '—'}</span>{trade.pair || '—'}</div></td>
    <td>{trade.dateTime ? new Date(trade.dateTime).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone }) : 'Unrecorded'}</td>
    <td><span className={`trade-tag ${trade.position?.toLowerCase() === 'long' ? 'long' : trade.position?.toLowerCase() === 'short' ? 'short' : ''}`}>{trade.position?.toLowerCase() === 'long' ? <ArrowUpRight size={11}/> : trade.position?.toLowerCase() === 'short' ? <ArrowDownLeft size={11}/> : null}{trade.position || '—'}</span></td>
    <td><span className="trade-tag" title={trade.setup.join(', ')}>{trade.setup[0] || 'Untagged'}{trade.setup.length > 1 ? ` +${trade.setup.length - 1}` : ''}</span></td>
    <td className="tabular">{trade.rMultiple === null ? '—' : `${number(trade.rMultiple)}R`}</td>
    <td className={`table-pnl ${trade.netEur !== null && trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}`}>{trade.netEur === null ? trade.recordedOutcome ? `${trade.recordedOutcome} · Net € missing` : 'Unrecorded' : money(trade.netEur)}</td>
  </tr>)}</tbody></table></div>;
}

export function TradeJournal({ trades, timeZone, onTrade }: { trades: Trade[]; timeZone: string; onTrade: (trade: Trade) => void }) {
  const [filters, setFilters] = useState<JournalFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterJournal(trades, filters), [trades, filters]);
  const pairs = useMemo(() => [...new Set(trades.flatMap(trade => trade.pair ? [trade.pair] : []))].sort(), [trades]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 12, current * 12);
  const update = (values: Partial<JournalFilters>) => { setFilters(previous => ({ ...previous, ...values })); setPage(1); };
  const net = filtered.reduce((sum, trade) => sum + (trade.netEur ?? 0), 0);

  return <section className="panel" aria-label="Trade journal"><div className="journal-toolbar"><div className="search-control"><Search size={14}/><input type="search" aria-label="Search trades" placeholder="Search trade, pair, setup…" value={filters.search} onChange={event => update({ search: event.target.value })}/>{filters.search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => update({ search: '' })}><X size={12}/></button>}</div><div className="toolbar-group">
    <select className="select-control" aria-label="Trade outcome" value={filters.outcome} onChange={event => update({ outcome: event.target.value as JournalFilters['outcome'] })}><option value="all">All outcomes</option><option value="win">Wins</option><option value="loss">Losses</option><option value="breakeven">Break-even</option><option value="unrecorded">Unrecorded</option></select>
    <select className="select-control" aria-label="Instrument" value={filters.pair} onChange={event => update({ pair: event.target.value })}><option value="all">All instruments</option>{pairs.map(pair => <option key={pair}>{pair}</option>)}</select>
    <select className="select-control" aria-label="Sort trades" value={filters.order} onChange={event => update({ order: event.target.value as JournalFilters['order'] })}><option value="latest">Newest first</option><option value="oldest">Oldest first</option><option value="profit">Highest P&L</option><option value="loss">Lowest P&L</option></select>
    <button type="button" className="button" disabled={!filtered.length} onClick={() => exportTrades(filtered)}><Download size={13}/>Export CSV</button>
  </div></div>{visible.length ? <TradeTable trades={visible} timeZone={timeZone} onTrade={onTrade}/> : <EmptyState title={trades.length ? 'No trades match your filters' : 'Your journal starts with your next trade'} description={trades.length ? 'Try another search, outcome or instrument.' : 'Your synced Notion trades will appear here.'} action={trades.length ? <button type="button" className="button" onClick={() => { setFilters(defaultFilters); setPage(1); }}>Reset filters</button> : undefined}/>}
    <div className="table-footer"><span aria-live="polite">{filtered.length ? `${(current - 1) * 12 + 1}–${Math.min(current * 12, filtered.length)} of ${filtered.length}` : '0'} trades <span className="hide-mobile"> · Net {money(net)}</span></span><div className="pagination"><button type="button" className="icon-button" aria-label="Previous trade page" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={14}/></button><span>{current} / {pages}</span><button type="button" className="icon-button" aria-label="Next trade page" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={14}/></button></div></div>
  </section>;
}
