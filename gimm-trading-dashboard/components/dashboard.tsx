'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, Clock3, FlaskConical, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Sun, Moon, Filter, SlidersHorizontal, Sparkles, TableProperties, Target, Timer, TrendingUp } from 'lucide-react';
import { logout } from '@/app/login/actions';
import type { DashboardPayload, DashboardView, Trade } from '@/lib/types';
import { calculatePerformance } from '@/lib/analytics';
import { groupTradingDays, journalSummary } from '@/lib/journal';
import { JOURNAL_URL, money, number, rate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Brand, EmptyState, Panel } from '@/components/dashboard/primitives';
import { DailyPanel, EquityPanel, OutcomePanel, SetupPanel, TimePanel } from '@/components/dashboard/charts';
import { TradingCalendar } from '@/components/dashboard/calendar';
import { TradeJournal, TradeTable } from '@/components/dashboard/journal';
import { TradeDetail } from '@/components/dashboard/trade-detail';
import { DayPlan } from '@/components/dashboard/day-plan';
import { TraderSkill, PerformanceExtras } from '@/components/dashboard/trader-skill';
import { ExecutionAnalytics } from '@/components/dashboard/execution';
import { Metrics } from '@/components/dashboard/metrics';

const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'journal', label: 'Trade journal', icon: TableProperties },
  { id: 'calendar', label: 'Trading calendar', icon: CalendarDays },
  { id: 'analytics', label: 'Analytics', icon: SlidersHorizontal },
] as const;
const titles: Record<DashboardView, { title: string; description: string }> = {
  overview: { title: 'Master Trading Dashboard', description: 'Less noise. More clarity. Every trade tells part of the story.' },
  journal: { title: 'Every trade. Every lesson.', description: 'Explore your journal, review your execution and find the details that matter.' },
  calendar: { title: 'Build a better trading rhythm.', description: 'A day-by-day perspective on your realized performance.' },
  analytics: { title: 'Understand your edge.', description: 'Look beyond the outcome. Find the setups and sessions behind it.' },
};

export function Dashboard({ data, loadError }: { data: DashboardPayload; loadError: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { localStorage.setItem('gimm-theme', next); } catch {}
    window.dispatchEvent(new Event('gimm-theme-change'));
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ pair: 'all', setup: 'all', session: 'all', outcome: 'all', from: '', to: '' });
  const filterOptions = useMemo(() => ({ pairs: [...new Set(data.trades.flatMap(trade => trade.pair ? [trade.pair] : []))].sort(), setups: [...new Set(data.trades.flatMap(trade => trade.setup))].sort(), sessions: [...new Set(data.trades.flatMap(trade => trade.sessionTime))].sort() }), [data.trades]);
  const allDays = useMemo(() => groupTradingDays(data.trades, data.timeZone), [data.trades, data.timeZone]);
  const tradeDates = useMemo(() => new Map(allDays.flatMap(day => day.trades.map(trade => [trade.id, day.date] as const))), [allDays]);
  const activeFilters = Object.values(filters).filter(value => value && value !== 'all').length;
  const trades = useMemo(() => data.trades.filter(trade => {
    if (filters.pair !== 'all' && trade.pair !== filters.pair) return false;
    if (filters.setup !== 'all' && !trade.setup.includes(filters.setup)) return false;
    if (filters.session !== 'all' && !trade.sessionTime.includes(filters.session)) return false;
    const outcome = trade.netEur === null ? 'unrecorded' : trade.netEur > 0 ? 'win' : trade.netEur < 0 ? 'loss' : 'breakeven';
    if (filters.outcome !== 'all' && filters.outcome !== outcome) return false;
    const date = tradeDates.get(trade.id);
    if (filters.from && (!date || date < filters.from)) return false;
    if (filters.to && (!date || date > filters.to)) return false;
    return true;
  }), [data.trades, filters, tradeDates]);
  const p = useMemo(() => activeFilters ? calculatePerformance(trades, data.timeZone) : data.performance, [activeFilters, trades, data.timeZone, data.performance]);
  const days = useMemo(() => groupTradingDays(trades, data.timeZone), [trades, data.timeZone]);
  const closedDays = useMemo(() => days.filter(day => day.closed > 0), [days]);
  const summary = useMemo(() => journalSummary(trades, days), [trades, days]);
  const recent = useMemo(() => [...trades].sort((a, b) => (b.dateTime ? Date.parse(b.dateTime) : 0) - (a.dateTime ? Date.parse(a.dateTime) : 0)).slice(0, 6), [trades]);
  const bestSetup = [...p.comparisons].filter(item => item.group === 'Setup' && item.count >= 5).sort((a, b) => b.avgPnl - a.avgPnl)[0];
  const bestSession = [...p.sessions].filter(item => item.count >= 5).sort((a, b) => b.avgPnl - a.avgPnl)[0];
  const view = data.view;
  const href = (changes: Partial<{ view: DashboardView; period: string; account: string }> = {}) => {
    const params = new URLSearchParams({ view: changes.view ?? view, period: changes.period ?? data.selectedPeriod, account: changes.account ?? data.selectedAccount });
    return `/dashboard?${params}`;
  };
  const changeFilter = (changes: Partial<{ period: string; account: string }>) => startTransition(() => router.push(href(changes), { scroll: false }));
  const refresh = () => startTransition(() => router.refresh());
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible') startTransition(() => router.refresh()); }, 90000);
    return () => clearInterval(timer);
  }, [router]);
  const syncParts = data.status?.lastSyncedAt ? Object.fromEntries(new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: data.timeZone }).formatToParts(new Date(data.status.lastSyncedAt)).map(part => [part.type, part.value])) : null;
  const synced = syncParts ? `${syncParts.month} ${syncParts.day}, ${syncParts.hour}:${syncParts.minute}` : 'Waiting for first sync';
  const stale = data.status?.lastSyncedAt ? Date.parse(data.generatedAt) - Date.parse(data.status.lastSyncedAt) > 10 * 60000 : false;
  const healthy = data.status?.state === 'ok' && !stale && !loadError;
  const status = data.demo ? 'Demo workspace' : loadError ? 'Data unavailable' : data.status?.state === 'error' ? 'Sync error' : data.status?.state === 'warning' ? 'Sync warning' : stale ? 'Sync delayed' : healthy ? 'Notion connected' : 'Sync pending';
  const heading = titles[view];

  return <div className="workspace">
    <a href="#workspace-content" className="skip-link">Skip to dashboard content</a>
    {pending && <div className="loading-progress" role="progressbar" aria-label="Updating dashboard"/>}
    <aside className="app-sidebar" aria-label="Workspace sidebar"><Link href={href({ view: 'overview' })} aria-label="GIMM dashboard home"><Brand/></Link>
      <div className="workspace-switch"><span className="workspace-avatar">GH</span><div><strong>GIMM Holding</strong><small>{data.demo ? 'Demo trading workspace' : 'Personal workspace'}</small></div><ShieldCheck size={14} className="muted" style={{ marginLeft: 'auto' }}/></div>
      <p className="nav-caption">WORKSPACE</p><nav aria-label="Main navigation">{navigation.map(item => <Link key={item.id} href={href({ view: item.id })} prefetch={false} aria-current={view === item.id ? 'page' : undefined} className={cn('nav-item', view === item.id && 'active')}><item.icon size={17} strokeWidth={1.7}/>{item.label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="source-card"><h3><span className="legend-dot positive"/>Your journal. Connected.</h3><p>Keep journaling in Notion.<br/>Your insights follow automatically.</p><a href={JOURNAL_URL} target="_blank" rel="noopener noreferrer">Open Notion journal<ArrowUpRight size={12}/></a></div><div className="sidebar-profile"><span className="workspace-avatar" >G</span><div><strong>Private account</strong><small>GIMM Trading</small></div><form action={logout}><button type="submit" className="icon-button" aria-label="Log out"><LogOut size={14}/></button></form></div></div>
    </aside>
    <div className="workspace-main"><header className="page-topbar"><div className="mobile-brand"><Brand/></div><div className="breadcrumbs"><LayoutDashboard size={13}/><span>Trading Dashboard</span><ChevronRight size={11}/><strong>{navigation.find(item => item.id === view)?.label}</strong></div><div className="topbar-actions"><button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>{theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}</button><span className={cn('status-pill', healthy && !data.demo && 'status-ok')}><span className="status-dot"/>{status}</span><span className="sync-caption hide-mobile"><Clock3 size={12}/>{data.timeZone}</span><form action={logout} className="mobile-brand"><button type="submit" className="icon-button" aria-label="Log out"><LogOut size={14}/></button></form></div></header>
      <main id="workspace-content" className="dashboard-content" aria-busy={pending}>
        <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE / {navigation.find(item => item.id === view)?.label}</div><h1>{heading.title}</h1><p>{heading.description}</p></div><div className="heading-actions"><button type="button" className="button" disabled={pending} onClick={refresh} aria-label="Refresh dashboard"><RefreshCw size={13} className={pending ? 'animate-spin' : ''}/><span className="hide-mobile">Refresh</span></button><a className="button button-primary hide-mobile" href={JOURNAL_URL} target="_blank" rel="noopener noreferrer">Open journal<ArrowUpRight size={13}/></a></div></div>
        <div className="toolbar"><div className="toolbar-group"><button type="button" className={cn('button filter-toggle', activeFilters > 0 && 'has-filters')} aria-expanded={filtersOpen} aria-controls="dashboard-filters" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={13}/>Filters{activeFilters > 0 && <span>{activeFilters}</span>}</button><label className="filter-label"><span className="hide-mobile">Account</span><select className="select-control" aria-label="Account filter" value={data.selectedAccount} disabled={pending} onChange={event => changeFilter({ account: event.target.value })}><option value="Forwardtesting">Forwardtesting</option><option value="Backtest">Backtest</option><option value="all">All accounts</option></select></label><div className="segmented" aria-label="Date range">{[['30d', '30D'], ['90d', '90D'], ['365d', '1Y'], ['all', 'All time']].map(([period, label]) => <button type="button" key={period} aria-pressed={period === data.selectedPeriod} className={period === data.selectedPeriod ? 'selected' : ''} disabled={pending} onClick={() => changeFilter({ period })}>{label}</button>)}</div></div><span className="sync-caption"><RefreshCw size={11}/>Last sync: {synced}</span></div>
        {filtersOpen && <section id="dashboard-filters" className="advanced-filters" aria-label="Dashboard filters"><div className="filter-intro"><strong>Refine selected account & period</strong><button type="button" className="button button-link" onClick={() => setFilters({ pair: 'all', setup: 'all', session: 'all', outcome: 'all', from: '', to: '' })}>Clear filters</button></div><div className="advanced-filter-grid">{([{ key: 'pair', label: 'Instrument', values: filterOptions.pairs }, { key: 'setup', label: 'Setup', values: filterOptions.setups }, { key: 'session', label: 'Session', values: filterOptions.sessions }, { key: 'outcome', label: 'Outcome', values: ['win', 'loss', 'breakeven', 'unrecorded'] }] as const).map(field => <label key={field.key}>{field.label}<select className="select-control" aria-label={`Dashboard ${field.label.toLowerCase()}`} value={filters[field.key]} onChange={event => setFilters({ ...filters, [field.key]: event.target.value })}><option value="all">All {field.label.toLowerCase()}s</option>{field.values.map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}<label>From<input type="date" aria-label="Dashboard from date" className="select-control" value={filters.from} max={filters.to || data.today} onChange={event => setFilters({ ...filters, from: event.target.value })}/></label><label>To<input type="date" aria-label="Dashboard to date" className="select-control" value={filters.to} min={filters.from} max={data.today} onChange={event => setFilters({ ...filters, to: event.target.value })}/></label></div><p role="status">{trades.length} of {data.trades.length} trades · dates in {data.timeZone}{filters.from && filters.to && filters.from > filters.to ? ' · Start date must precede end date' : ''}</p></section>}
        {activeFilters > 0 && !filtersOpen && <div className="active-filter-note">{trades.length} matching trades · {activeFilters} active filters<button type="button" className="button button-link" onClick={() => setFiltersOpen(true)}>Edit filters</button></div>}
        {data.demo && <div className="notice demo-notice"><FlaskConical size={15}/><p><strong>Demo workspace.</strong> You are exploring synthetic sample trades. These are not your trading results.</p></div>}
        {(loadError || data.status?.state === 'error' || data.status?.state === 'warning' || stale) && !data.demo && <div className="notice" role="status"><AlertCircle size={15}/><p>{loadError || (stale ? 'Your last synchronization is older than expected.' : 'Synchronization needs attention.')} {loadError ? 'Your trades will appear when the connection is available.' : 'The displayed data may be incomplete or outdated.'}</p></div>}
        {trades.some(t=>t.netEur===null&&t.recordedOutcome) && <div className="notice" role="status"><AlertCircle size={15}/><p><strong>Notion results need Net €.</strong> {trades.filter(t=>t.netEur===null&&t.recordedOutcome).map(t=>`#${t.tradeId} (${t.recordedOutcome})`).join(', ')}: outcome recorded, net amount missing. Enter Net € in Notion to update P&L, equity and financial statistics. Recorded outcomes are visible in Analytics.</p></div>}
        <div key={`${view}-${data.selectedAccount}-${data.selectedPeriod}`} className={cn('reveal', pending && 'loading-overlay')}>
          {view !== 'overview' && <Metrics performance={p}/>}
          {view === 'overview' && <>
            <div className="command-kpis"><Metrics performance={p} variant="primary"/><PerformanceExtras performance={p} trades={trades} days={days}/></div>
            <DayPlan today={data.today} account={data.selectedAccount}/>
            <div className="command-grid"><div className="command-charts"><EquityPanel performance={p} balanceAvailable={data.selectedAccount !== 'all'}/><TraderSkill performance={p} days={days}/></div><div className="command-calendar"><TradingCalendar days={days} today={data.today} onTrade={setSelectedTrade}/></div></div>
            <Metrics performance={p} variant="secondary"/>
            <div className="overview-grid"><DailyPanel days={closedDays}/><OutcomePanel performance={p}/></div>
            <div className="section-heading"><div><h2>A little perspective goes a long way.</h2><p>Highlights from your selected trading history.</p></div><Link href={href({ view: 'analytics' })} className="button button-link">Explore analytics<ArrowRight size={12}/></Link></div>
            <div className="insights-grid"><article className="insight-card"><span className="insight-icon"><Target size={16}/></span><div><h3>Best setup by average P&L</h3><strong>{bestSetup?.label.replace('Setup · ', '') || 'Building your sample'}</strong><p>{bestSetup ? `${money(bestSetup.avgPnl)} average · ${bestSetup.count} trades` : 'At least 5 closed trades per setup.'}</p></div></article><article className="insight-card"><span className="insight-icon"><Timer size={16}/></span><div><h3>Strongest session by average P&L</h3><strong>{bestSession?.label || 'Patterns take practice'}</strong><p>{bestSession ? `${rate(bestSession.winRate)} win rate · ${bestSession.count} trades` : 'At least 5 closed trades per session.'}</p></div></article><article className="insight-card"><span className="insight-icon"><TrendingUp size={16}/></span><div><h3>Profitable trading days</h3><strong>{summary.activeDays ? `${summary.profitableDays} of ${summary.activeDays} days` : 'The bigger picture is coming'}</strong><p>{summary.activeDays ? `${rate(summary.profitableDays / summary.activeDays * 100)} positive days in this period` : 'Daily results appear after your first sync.'}</p></div></article></div>
            <div className="two-column"><TimePanel title="Session performance" subtitle="Average realized P&L per closed trade" items={p.sessions}/><TimePanel title="Monthly performance" subtitle="Average realized P&L per closed trade" items={p.monthly}/></div>
            <div className="section-heading"><div><h2>Recent trades</h2><p>Fresh from your journal. Ready for review.</p></div><Link href={href({ view: 'journal' })} className="button button-link">View all trades<ArrowRight size={12}/></Link></div>
            <section className="panel" aria-label="Recent trades">{recent.length ? <TradeTable trades={recent} timeZone={data.timeZone} onTrade={setSelectedTrade}/> : <EmptyState title="Your journal is ready when you are" description="Select another account, or let your Notion trades synchronize."/>}</section>
          </>}
          {view === 'journal' && <TradeJournal trades={trades} timeZone={data.timeZone} onTrade={setSelectedTrade}/>}
          {view === 'calendar' && <><TradingCalendar days={days} today={data.today} onTrade={setSelectedTrade}/><div className="section-heading"><div><h2>The rhythm behind your results</h2><p>Dates and hours use {data.timeZone}.</p></div></div><div className="two-column"><DailyPanel days={closedDays}/><TimePanel title="Performance by weekday" subtitle="Average realized P&L for each entry weekday" items={p.weekdays}/></div></>}
          {view === 'analytics' && <>
            <PerformanceExtras performance={p} trades={trades} days={days}/>
            <div className="two-column"><TraderSkill performance={p} days={days}/><OutcomePanel performance={p}/></div>
            <div className="insights-grid"><article className="insight-card"><span className="insight-icon"><ArrowUpRight size={17}/></span><div><h3>Average winning trade</h3><strong className="positive">{summary.averageWin === null ? '—' : money(summary.averageWin)}</strong><p>{p.wins} profitable closed trades</p></div></article><article className="insight-card"><span className="insight-icon"><TrendingUp size={17}/></span><div><h3>Average losing trade</h3><strong className="negative">{summary.averageLoss === null ? '—' : money(-summary.averageLoss)}</strong><p>{p.losses} losing closed trades</p></div></article><article className="insight-card"><span className="insight-icon"><Sparkles size={17}/></span><div><h3>Realized win / loss size</h3><strong>{summary.payoff === null ? '—' : `${number(summary.payoff)} : 1`}</strong><p>Average win divided by average absolute loss</p></div></article></div>
            <ExecutionAnalytics trades={trades} onTrade={setSelectedTrade}/><SetupPanel comparisons={p.comparisons}/><div className="section-heading"><div><h2>Timing is part of your process.</h2><p>Descriptive statistics · entry times in {data.timeZone}</p></div></div><div className="two-column"><TimePanel title="Win rate by weekday" subtitle="Check the sample size as well as the percentage" items={p.weekdays} metric="winRate"/><TimePanel title="Win rate by entry hour" subtitle="The hour of entry, rather than exit time" items={p.hours} metric="winRate"/></div><div className="two-column"><TimePanel title="Session performance" subtitle="Average realized P&L per closed trade" items={p.sessions}/><TimePanel title="Monthly performance" subtitle="Average realized P&L per closed trade, grouped by entry month" items={p.monthly}/></div>
          </>}
        </div>
        <footer className="dashboard-footer"><span>GIMM Holding / Trading Intelligence</span><span>Private workspace · Notion source · {data.timeZone}</span></footer>
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map(item => <Link key={item.id} href={href({ view: item.id })} prefetch={false} aria-current={view === item.id ? 'page' : undefined} className={view === item.id ? 'active' : ''}><item.icon size={18} strokeWidth={1.7}/>{item.id === 'calendar' ? 'Calendar' : item.id === 'journal' ? 'Journal' : item.label}</Link>)}</nav>
    <TradeDetail trade={selectedTrade} timeZone={data.timeZone} demo={data.demo} onClose={() => setSelectedTrade(null)}/>
  </div>;
}
