'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Columns3, Download, PenLine, Search, X } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { filterJournal, tradesToCsv, type JournalFilters } from '@/lib/journal';
import { money, number } from '@/lib/format';
import { EmptyState } from './primitives';
import { QualityBadge } from '@/components/quality-badge';
import { PnlRing } from '@/components/journal/marks';
import { AlgorithmTag, ConditionTag, SessionTag, SetupTag, TimeframeTag } from '@/components/journal/tags';
import { ConfluenceToggles } from '@/components/journal/confluence-toggles';
import { ScreenshotCell } from '@/components/journal/screenshot-cell';

const defaultFilters: JournalFilters = { search: '', outcome: 'all', pair: 'all', setup: 'all', session: 'all', direction: 'all', tfType: 'all', setupQuality: 'all', marketCondition: 'all', algorithm: 'all', orderType: 'all', order: 'latest' };

function timestamp(trade: Trade): number {
  return trade.dateTime ? Date.parse(trade.dateTime) : 0;
}

export function outcomeOf(trade: Trade): 'win' | 'loss' | 'breakeven' | 'unrecorded' {
  if (trade.netEur === null) return trade.recordedOutcome ?? 'unrecorded';
  return trade.netEur > 0 ? 'win' : trade.netEur < 0 ? 'loss' : 'breakeven';
}

export function exportTrades(trades: Trade[]) {
  const blob = new Blob([tradesToCsv(trades)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `gimm-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ColumnId =
  | 'trade' | 'date' | 'time' | 'exit' | 'pair' | 'direction' | 'chart' | 'confluences' | 'account'
  | 'setup' | 'quality' | 'algorithm' | 'entryTf' | 'tfType' | 'tfAlign' | 'session'
  | 'condition' | 'orderType' | 'lot' | 'r' | 'net' | 'pnlPercent' | 'balance'
  | 'outcome' | 'mfe' | 'mae' | 'learning';

type Column = {
  id: ColumnId;
  label: string;
  default: boolean;
  render: (trade: Trade, timeZone: string, onTrade: (trade: Trade) => void) => React.ReactNode;
  align?: 'right';
  wide?: boolean;
};

/** Exit carries its date: a trade closed after midnight must not look same-day. */
function exitLabel(iso: string, timeZone: string): { short: string; full: string } {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return { short: '—', full: '' };
  return {
    short: date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }),
    full: date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }),
  };
}

const dash = <span className="muted">—</span>;

function timeframeList(values: string[] | undefined): React.ReactNode {
  if (!values?.length) return dash;
  return <span className="tag-stack">{values.map(value => <TimeframeTag key={value} value={value}/>)}</span>;
}

/**
 * Column order is the reading order of a trade: what it was (identity), the
 * chart, how it was classified, when it happened, how it ended, and only then
 * the numbers. Reordering this array reorders the table and the column picker;
 * the CSV export keeps its own field order for re-imports.
 */
const columns: Column[] = [
  { id: 'trade', label: 'Trade', default: true, render: trade => <span className="trade-number">#{trade.tradeId || '—'}</span> },
  { id: 'date', label: 'Date', default: true, render: (trade, tz) => trade.dateTime ? new Date(trade.dateTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: tz }) : dash },
  { id: 'time', label: 'Entry', default: true, render: (trade, tz) => trade.dateTime && trade.timeRecorded !== false ? new Date(trade.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz }) : dash },
  { id: 'exit', label: 'Exit', default: true, render: (trade, tz) => { if (!trade.exitTime) return dash; const label = exitLabel(trade.exitTime, tz); return <span className="tabular" title={label.full}>{label.short}</span>; } },
  { id: 'pair', label: 'Instrument', default: true, render: trade => trade.pair ? <span className="pair-cell"><span className="pair-icon" aria-hidden="true">{trade.pair.startsWith('XAU') ? 'Au' : trade.pair.slice(0, 2)}</span>{trade.pair}</span> : dash },
  { id: 'direction', label: 'Direction', default: true, render: trade => trade.position ? <span className={`trade-tag ${trade.position.toLowerCase() === 'long' ? 'long' : trade.position.toLowerCase() === 'short' ? 'short' : ''}`}>{trade.position.toLowerCase() === 'long' ? <ArrowUpRight size={11}/> : trade.position.toLowerCase() === 'short' ? <ArrowDownLeft size={11}/> : null}{trade.position}</span> : dash },
  { id: 'chart', label: 'Screenshot', default: true, render: (trade, _tz, onTrade) => <ScreenshotCell trade={trade} onOpen={() => onTrade(trade)}/> },
  { id: 'algorithm', label: 'Algorithm', default: true, render: trade => trade.algorithm.length ? <span className="tag-stack">{trade.algorithm.map(value => <AlgorithmTag key={value} value={value}/>)}</span> : dash },
  { id: 'quality', label: 'Quality', default: true, render: trade => <QualityBadge value={trade.setupQuality} size="sm"/> },
  { id: 'setup', label: 'Setup', default: true, render: trade => trade.setup.length ? <span className="tag-stack">{trade.setup.map(value => <SetupTag key={value} value={value}/>)}</span> : dash, wide: true },
  { id: 'condition', label: 'Market Condition', default: true, render: trade => (trade.marketCondition ?? []).length ? <span className="tag-stack">{(trade.marketCondition ?? []).map(value => <ConditionTag key={value} value={value}/>)}</span> : dash },
  { id: 'confluences', label: 'Confluences', default: true, render: trade => <ConfluenceToggles trade={trade}/> },
  { id: 'entryTf', label: 'Entry TF', default: true, render: trade => timeframeList(trade.entryTf) },
  { id: 'tfType', label: 'TF Type', default: true, render: trade => timeframeList(trade.tfType) },
  { id: 'tfAlign', label: 'TF Align', default: true, render: trade => timeframeList(trade.tfAlign) },
  { id: 'session', label: 'Session', default: true, render: trade => trade.sessionTime.length ? <span className="tag-stack">{trade.sessionTime.map(value => <SessionTag key={value} value={value}/>)}</span> : dash },
  { id: 'outcome', label: 'Outcome', default: true, render: trade => { const value = outcomeOf(trade); return <span className={`trade-tag outcome-${value}`}>{trade.outcomeTag || value}</span>; } },
  { id: 'pnlPercent', label: 'PnL %', default: true, render: trade => <PnlRing percent={trade.pnlPercent}/> },
  { id: 'net', label: 'Net P&L', default: true, align: 'right', render: trade => trade.netEur === null ? (trade.recordedOutcome ? <span className="muted">{trade.outcomeTag || trade.recordedOutcome} · no amount</span> : dash) : <span className={trade.netEur < 0 ? 'negative' : trade.netEur ? 'positive' : ''}>{money(trade.netEur)}</span> },
  { id: 'r', label: 'R', default: true, align: 'right', render: trade => trade.rMultiple === null ? dash : `${number(trade.rMultiple)}R` },
  { id: 'lot', label: 'Lots', default: true, align: 'right', render: trade => trade.lotSize === null || trade.lotSize === undefined ? dash : number(trade.lotSize) },
  { id: 'orderType', label: 'Order', default: true, render: trade => trade.orderType || dash },
  { id: 'balance', label: 'Balance', default: false, align: 'right', render: trade => trade.accountBalance === null ? dash : money(trade.accountBalance) },
  { id: 'mfe', label: 'MFE', default: true, align: 'right', render: trade => trade.mfe30m == null ? dash : number(trade.mfe30m) },
  { id: 'mae', label: 'MAE', default: true, align: 'right', render: trade => trade.mae30m == null ? dash : number(trade.mae30m) },
  { id: 'account', label: 'Account', default: false, render: trade => trade.account.join(', ') || dash },
  { id: 'learning', label: 'Learning', default: false, render: trade => trade.learning ? <span className="learning-cell" title={trade.learning}>{trade.learning}</span> : dash, wide: true },
];

type ViewMode = 'all' | 'paged';
const VIEW_KEY = 'gimm-journal-view';
const PAGE_SIZE = 25;

const STORAGE_KEY = 'gimm-journal-columns';
const STORAGE_VERSION_KEY = 'gimm-journal-columns-version';
const COLUMN_VERSION = '2';
const defaultColumnIds = new Set(columns.filter(column => column.default).map(column => column.id));

function readStoredColumns(): Set<ColumnId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(defaultColumnIds);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set(defaultColumnIds);
    const valid = parsed.filter((value): value is ColumnId => typeof value === 'string' && columns.some(column => column.id === value));
    if (!valid.length) return new Set(defaultColumnIds);
    // The chart and confluence columns arrived later. Add them once for a
    // browser that saved its column choice before they existed, without
    // resurrecting them after a deliberate hide.
    if (localStorage.getItem(STORAGE_VERSION_KEY) !== COLUMN_VERSION) {
      const migrated = [...new Set<ColumnId>([...valid, 'chart', 'confluences'])];
      localStorage.setItem(STORAGE_VERSION_KEY, COLUMN_VERSION);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return new Set(migrated);
    }
    return new Set(valid);
  } catch {
    return new Set(defaultColumnIds);
  }
}

export function TradeTable({ trades, timeZone, onTrade, visible }: { trades: Trade[]; timeZone: string; onTrade: (trade: Trade) => void; visible?: Set<ColumnId> }) {
  const shown = visible ? columns.filter(column => visible.has(column.id)) : columns.filter(column => column.default);
  return <div className="trade-table-scroll"><table className="trade-table"><caption className="sr-only">Trades in your journal, shown in {timeZone}. Select a trade ID for details.</caption>
    <thead><tr>{shown.map(column => <th scope="col" key={column.id} className={column.align === 'right' ? 'align-right' : undefined}>{column.label}</th>)}</tr></thead>
    <tbody>{trades.map(trade => <tr key={trade.id}>
      {shown.map(column => column.id === 'trade'
        ? <td key={column.id}><button type="button" className="trade-id" onClick={() => onTrade(trade)} aria-label={`View trade ${trade.tradeId}`}>#{trade.tradeId || '—'}</button></td>
        : <td key={column.id} className={column.align === 'right' ? 'align-right tabular' : column.wide ? 'cell-wide' : column.id === 'chart' || column.id === 'confluences' ? 'cell-tight' : undefined}>{column.render(trade, timeZone, onTrade)}</td>)}
    </tr>)}</tbody></table></div>;
}

export function TradeJournal({ trades, timeZone, onTrade, demo = false }: { trades: Trade[]; timeZone: string; onTrade: (trade: Trade) => void; demo?: boolean }) {
  const [filters, setFilters] = useState<JournalFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>('paged');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() => new Set(defaultColumnIds));

  useEffect(() => {
    setVisibleColumns(readStoredColumns());
    try { if (localStorage.getItem(VIEW_KEY) === 'all') setMode('all'); } catch {}
  }, []);

  const changeMode = (next: ViewMode) => {
    setMode(next);
    setPage(1);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
  };

  useEffect(() => {
    if (!columnsOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('.column-picker') || target?.closest('[data-columns-trigger]')) return;
      setColumnsOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setColumnsOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [columnsOpen]);

  const resetColumns = () => {
    setVisibleColumns(new Set(defaultColumnIds));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...defaultColumnIds])); } catch {}
  };

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns(previous => {
      const next = new Set(previous);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const filtered = useMemo(() => filterJournal(trades, filters), [trades, filters]);
  const options = useMemo(() => ({
    pairs: [...new Set(trades.flatMap(trade => trade.pair ? [trade.pair] : []))].sort(),
    setups: [...new Set(trades.flatMap(trade => trade.setup))].sort(),
    sessions: [...new Set(trades.flatMap(trade => trade.sessionTime))].sort(),
    timeframes: [...new Set(trades.flatMap(trade => trade.tfType))].sort(),
    qualities: [...new Set(trades.flatMap(trade => trade.setupQuality ? [trade.setupQuality] : []))].sort(),
    conditions: [...new Set(trades.flatMap(trade => trade.marketCondition ?? []))].sort(),
    algorithms: [...new Set(trades.flatMap(trade => trade.algorithm))].sort(),
  }), [trades]);
  const showingAll = mode === 'all';
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = showingAll ? filtered : filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const update = (values: Partial<JournalFilters>) => { setFilters(previous => ({ ...previous, ...values })); setPage(1); };
  const net = filtered.reduce((sum, trade) => sum + (trade.netEur ?? 0), 0);
  const activeCount = Object.entries(filters).filter(([key, value]) => key !== 'order' && key !== 'search' && value !== 'all').length;

  const emptyTitle = trades.length ? 'No trades match your filters' : 'Your journal starts with your next trade';
  const emptyDescription = trades.length ? 'Try another search, outcome or instrument.' : 'Journal your first trade to get started.';
  const emptyAction = trades.length
    ? <button type="button" className="button" onClick={() => { setFilters(defaultFilters); setPage(1); }}>Reset filters</button>
    : demo ? undefined : <Link href="/journal/new" className="button button-primary">Journal a trade</Link>;

  return (
    <section className="panel" aria-label="Trading Journal">
      <div className="journal-toolbar">
        <div className="search-control">
          <Search size={14}/>
          <input type="search" aria-label="Search trades" placeholder="Search trade, pair, setup, learning…" value={filters.search} onChange={event => update({ search: event.target.value })}/>
          {filters.search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => update({ search: '' })}><X size={12}/></button>}
        </div>
        <div className="toolbar-group">
          <select className="select-control" aria-label="Trade outcome" value={filters.outcome} onChange={event => update({ outcome: event.target.value as JournalFilters['outcome'] })}>
            <option value="all">All outcomes</option><option value="win">Wins</option><option value="loss">Losses</option><option value="breakeven">Break-even</option><option value="unrecorded">Unrecorded</option>
          </select>
          <select className="select-control" aria-label="Instrument" value={filters.pair} onChange={event => update({ pair: event.target.value })}>
            <option value="all">All instruments</option>{options.pairs.map(pair => <option key={pair}>{pair}</option>)}
          </select>
          <select className="select-control" aria-label="Setup" value={filters.setup} onChange={event => update({ setup: event.target.value })}>
            <option value="all">All setups</option>{options.setups.map(setup => <option key={setup}>{setup}</option>)}
          </select>
          <select className="select-control" aria-label="Setup quality" value={filters.setupQuality} onChange={event => update({ setupQuality: event.target.value })}>
            <option value="all">All qualities</option>{options.qualities.map(quality => <option key={quality}>{quality}</option>)}
          </select>
          <select className="select-control" aria-label="Market condition" value={filters.marketCondition} onChange={event => update({ marketCondition: event.target.value })}>
            <option value="all">All conditions</option>{options.conditions.map(condition => <option key={condition}>{condition}</option>)}
          </select>
          <select className="select-control" aria-label="Session" value={filters.session} onChange={event => update({ session: event.target.value })}>
            <option value="all">All sessions</option>{options.sessions.map(session => <option key={session}>{session}</option>)}
          </select>
          <select className="select-control" aria-label="Algorithm" value={filters.algorithm} onChange={event => update({ algorithm: event.target.value })}>
            <option value="all">All algorithms</option>{options.algorithms.map(algorithm => <option key={algorithm}>{algorithm}</option>)}
          </select>
          <select className="select-control" aria-label="Timeframe" value={filters.tfType} onChange={event => update({ tfType: event.target.value })}>
            <option value="all">All timeframes</option>{options.timeframes.map(tf => <option key={tf}>{tf}</option>)}
          </select>
          <select className="select-control" aria-label="Direction" value={filters.direction} onChange={event => update({ direction: event.target.value })}>
            <option value="all">All directions</option><option value="Long">Long</option><option value="Short">Short</option>
          </select>
          <select className="select-control" aria-label="Sort trades" value={filters.order} onChange={event => update({ order: event.target.value as JournalFilters['order'] })}>
            <option value="latest">Newest first</option><option value="oldest">Oldest first</option><option value="profit">Highest P&amp;L</option><option value="loss">Lowest P&amp;L</option>
          </select>
          <div className="column-picker-wrap">
            <button type="button" data-columns-trigger className={columnsOpen ? 'button is-open' : 'button'} aria-expanded={columnsOpen} aria-controls="column-picker" onClick={() => setColumnsOpen(!columnsOpen)}>
              <Columns3 size={13}/>Columns<span className="column-count">{visibleColumns.size}</span>
            </button>
            {columnsOpen && (
              <div id="column-picker" className="column-picker" role="group" aria-label="Visible columns">
                <div className="column-picker-heading"><strong>Visible columns</strong><button type="button" className="button button-link" onClick={resetColumns}>Reset</button></div>
                {columns.map(column => (
                  <label key={column.id} className="column-option">
                    <input type="checkbox" checked={visibleColumns.has(column.id)} onChange={() => toggleColumn(column.id)}/>
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="button" disabled={!filtered.length} onClick={() => exportTrades(filtered)}><Download size={13}/>Export CSV</button>
          {!demo && <Link href="/journal/new" className="button button-primary"><PenLine size={13}/>New trade</Link>}
        </div>
      </div>
      {activeCount > 0 && (
        <div className="active-filter-note">
          <span>{filtered.length} of {trades.length} trades</span>
          <span>{activeCount} filters active<button type="button" className="button button-link" onClick={() => setFilters(defaultFilters)}>Clear</button></span>
        </div>
      )}
      {visible.length
        ? <TradeTable trades={visible} timeZone={timeZone} onTrade={onTrade} visible={visibleColumns}/>
        : <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction}/>}
      <div className="table-footer">
        <span aria-live="polite">{filtered.length ? (showingAll ? `all ${filtered.length}` : `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} of ${filtered.length}`) : '0'} trades <span className="hide-mobile"> · Net {money(net)}</span></span>
        <div className="table-footer-actions">
          <div className="segmented view-mode" aria-label="Rows per view">
            <button type="button" aria-pressed={showingAll} className={showingAll ? 'selected' : ''} onClick={() => changeMode('all')}>All trades</button>
            <button type="button" aria-pressed={!showingAll} className={!showingAll ? 'selected' : ''} onClick={() => changeMode('paged')}>25 per page</button>
          </div>
          {!showingAll && <div className="pagination">
            <button type="button" className="icon-button" aria-label="Previous trade page" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft size={14}/></button>
            <span>{current} / {pages}</span>
            <button type="button" className="icon-button" aria-label="Next trade page" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={14}/></button>
          </div>}
        </div>
      </div>
    </section>
  );
}
