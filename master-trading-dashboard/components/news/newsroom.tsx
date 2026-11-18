'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bot, CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight,
  CircleAlert, Clock3, History, Landmark, Loader2, Newspaper, RefreshCw, Telescope,
} from 'lucide-react';
import type { NewsEdition, NewsPageData } from '@/lib/news/types';
import { longDate, shiftDate, shortDate, weekdayName } from '@/lib/news/dates';
import { cn } from '@/lib/utils';
import {
  BulletList, MoversList, OutlookGrid, PulseGrid, QuoteStrip, SectionCard,
  SourcePanel, WatchlistPanel, editionStamp,
} from './sections';

const POLL_INTERVAL_MS = 3_500;
const POLL_TIMEOUT_MS = 4 * 60_000;

function runningTooLong(edition: NewsEdition | null): boolean {
  if (!edition || edition.status !== 'running' || !edition.startedAt) return false;
  const age = Date.now() - Date.parse(edition.startedAt);
  return Number.isFinite(age) && age > 10 * 60_000;
}

function statusOf(edition: NewsEdition | null, selectedDate: string, today: string): {
  tone: 'ready' | 'stale' | 'running' | 'error' | 'missing';
  label: string;
} {
  if (!edition) return { tone: 'missing', label: selectedDate === today ? 'Noch kein Briefing' : 'Kein Briefing' };
  if (edition.status === 'running') return { tone: 'running', label: 'Wird erstellt' };
  if (edition.status === 'error') return { tone: 'error', label: 'Letzter Lauf fehlgeschlagen' };
  if (selectedDate !== today) return { tone: 'ready', label: 'Archiv' };
  const age = edition.generatedAt ? (Date.now() - Date.parse(edition.generatedAt)) / 3_600_000 : null;
  if (age !== null && Number.isFinite(age) && age > 20) return { tone: 'stale', label: 'Veraltet' };
  return { tone: 'ready', label: 'Heute aktualisiert' };
}

export function Newsroom({ data }: { data: NewsPageData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(data.edition?.status === 'running' && !runningTooLong(data.edition));
  const [error, setError] = useState<string | null>(
    data.edition?.status === 'error' ? data.edition.error || 'Die Analyse ist fehlgeschlagen.' : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const autoRan = useRef(false);
  const isToday = data.selectedDate === data.today;
  const payload = data.edition?.payload ?? null;
  const unsupportedNumbers = payload?.meta.unsupportedNumbers ?? [];
  const status = statusOf(data.edition, data.selectedDate, data.today);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const poll = useCallback(async () => {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (alive.current && Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS));
      if (!alive.current) return;
      try {
        const response = await fetch(`/api/news/status?date=${data.today}`, { cache: 'no-store' });
        if (!response.ok) continue;
        const body = await response.json() as { edition?: { status?: string; error?: string | null } | null };
        if (body.edition?.status === 'ready') {
          setPolling(false);
          setBusy(false);
          setError(null);
          setNotice('Briefing aktualisiert.');
          router.refresh();
          return;
        }
        if (body.edition?.status === 'error') {
          setPolling(false);
          setBusy(false);
          setError(body.edition.error || 'Die Analyse ist fehlgeschlagen.');
          router.refresh();
          return;
        }
      } catch {
        // A transient network error while the server is analysing is expected.
      }
    }
    if (!alive.current) return;
    setPolling(false);
    setBusy(false);
    setError('Die Analyse dauert länger als erwartet. Bitte in einigen Minuten erneut versuchen.');
  }, [data.today, router]);

  const generate = useCallback(async (force: boolean) => {
    if (busy || polling) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/news/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: data.today, force }),
      });
      if (response.status === 401) {
        setBusy(false);
        setError('Die Sitzung ist abgelaufen. Bitte neu anmelden.');
        return;
      }
      if (response.status === 409) {
        setPolling(true);
        void poll();
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        setBusy(false);
        setError(body.error || 'Die Analyse konnte nicht gestartet werden.');
        return;
      }
      setPolling(true);
      void poll();
    } catch {
      setBusy(false);
      setError('Netzwerkfehler: Die Analyse konnte nicht gestartet werden.');
    }
  }, [busy, polling, data.today, poll]);

  // Open the page in the morning and the briefing starts itself. A session
  // guard stops a reload loop if the upstream API is having a bad day.
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (data.demo || data.loadError) return;

    if (data.edition?.status === 'running' && !runningTooLong(data.edition)) {
      setPolling(true);
      void poll();
      return;
    }
    if (!data.autoGenerate) return;

    const key = `gimm-news-auto-${data.today}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch { /* private mode */ }
    void generate(false);
    // The run flag is deliberately one-shot; data.autoGenerate describes the
    // server render and should not retrigger on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (date: string) => {
    router.push(date === data.today ? '/news' : `/news?date=${date}`, { scroll: false });
  };

  const working = busy || polling || data.edition?.status === 'running';

  return <div className="page-body news-page">
    <header className="page-heading news-heading">
      <div>
        <p className="eyebrow">Tägliche Analyse</p>
        <h1>News</h1>
        <p>Fundamentale Tageslage für XAU/USD, Tech und KI — aus öffentlichen Quellen, jeden Morgen neu.</p>
      </div>
      <div className="heading-actions">
        {isToday && !data.demo && <button type="button" className="button button-primary" onClick={() => generate(true)} disabled={working}>
          {working ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
          <span>{working ? 'Analysiert …' : 'Aktualisieren'}</span>
        </button>}
        {!isToday && <Link className="button" href="/news">Heute öffnen</Link>}
      </div>
    </header>

    <div className="news-toolbar">
      <div className="news-date-nav">
        <button type="button" className="icon-button" aria-label="Vorheriger Tag" onClick={() => go(shiftDate(data.selectedDate, -1))}>
          <ChevronLeft size={15}/>
        </button>
        <input
          className="select-control news-date-input"
          type="date"
          aria-label="Briefing-Datum"
          value={data.selectedDate}
          max={data.today}
          onChange={event => event.target.value && go(event.target.value)}
        />
        <button type="button" className="icon-button" aria-label="Nächster Tag" disabled={data.selectedDate >= data.today} onClick={() => go(shiftDate(data.selectedDate, 1))}>
          <ChevronRight size={15}/>
        </button>
      </div>
      <div className="news-status">
        <span className={cn('news-status-pill', status.tone)}><i/>{status.label}</span>
        {data.edition?.generatedAt && <span className="news-stamp"><Clock3 size={11}/>Stand: {editionStamp(data.edition.generatedAt, data.timeZone)}</span>}
        {payload && <span className="news-stamp hide-mobile">{payload.meta.itemCount} Schlagzeilen · {payload.meta.feedCount} Feeds</span>}
      </div>
    </div>

    {data.archive.length > 1 && <div className="news-archive" aria-label="Briefing-Archiv">
      {data.archive.slice(0, 14).map(entry => <button
        type="button"
        key={entry.date}
        className={cn('news-archive-chip', entry.date === data.selectedDate && 'active', entry.status === 'error' && 'failed')}
        onClick={() => go(entry.date)}
        title={entry.headline || undefined}
      >
        <span>{weekdayName(entry.date).slice(0, 2)}</span>
        <strong>{shortDate(entry.date)}</strong>
      </button>)}
    </div>}

    {data.loadError && <div className="notice" role="status"><CircleAlert size={15}/><p>{data.loadError}</p></div>}

    {working && <div className="news-working" role="status">
      <div className="news-working-head"><Loader2 size={16} className="animate-spin"/><strong>Briefing wird erstellt</strong></div>
      <p>Quellen werden gesammelt, DeepSeek liest die Lage und schreibt die Einschätzung. Das dauert in der Regel 60–120 Sekunden.</p>
      <div className="news-working-bar" aria-hidden="true"><span/></div>
    </div>}

    {error && !working && <div className="notice notice-error" role="alert">
      <CircleAlert size={15}/>
      <p><strong>Analyse fehlgeschlagen.</strong> {error}</p>
      {isToday && <button type="button" className="button" onClick={() => generate(true)}>Erneut versuchen</button>}
    </div>}

    {notice && <p className="news-notice" role="status">{notice}</p>}

    {payload ? <>
      <section className="panel news-hero">
        <div className="news-hero-main">
          <span className="news-kicker"><Newspaper size={12}/>{longDate(data.selectedDate)}</span>
          <h2>{payload.headline}</h2>
          {payload.today.summary && <p className="news-summary news-summary-lead">{payload.today.summary}</p>}
          <BulletList bullets={payload.today.bullets}/>
        </div>
        <aside className="news-hero-side">
          <h3 className="news-side-title"><Telescope size={13}/>Lage</h3>
          <PulseGrid pulses={payload.marketPulse}/>
        </aside>
        <QuoteStrip quotes={payload.meta.quotes}/>
      </section>

      <div className="news-grid-2">
        <SectionCard title="Diese Woche" kicker="Was in den letzten sieben Tagen wichtig war und diese Woche noch ansteht" icon={CalendarDays} section={payload.week}/>
        <SectionCard title="Dieser Monat" kicker="Welche Themen sich im laufenden Monat aufbauen" icon={CalendarRange} section={payload.month}/>
      </div>

      <div className="news-grid-2">
        <SectionCard title={`${payload.date.slice(0, 4)} · Jahresbild`} kicker="Die großen Linien des laufenden Jahres" icon={CalendarClock} section={payload.year}/>
        <SectionCard title="2025 · Rückblick" kicker="Die Wendepunkte, die das heutige Bild erklären" icon={History} section={payload.lastYear}/>
      </div>

      <section className="panel news-section news-outlook-panel">
        <header className="news-section-head">
          <span className="news-section-icon"><Landmark size={15} strokeWidth={1.7}/></span>
          <div><h2>Ausblick</h2><p>Nächste Woche, nächster Monat und bis Jahresende — jeweils mit dem Punkt, der die Einschätzung kippen würde</p></div>
        </header>
        <OutlookGrid outlook={payload.outlook}/>
      </section>

      <div className="news-grid-2">
        <SectionCard title="KI & Modelle" kicker="Nur was den Tech- und Infrastrukturzyklus wirklich bewegt" icon={Bot} section={payload.ai}/>
        <section className="panel news-section">
          <header className="news-section-head">
            <span className="news-section-icon"><CircleAlert size={15} strokeWidth={1.7}/></span>
            <div><h2>Wichtige Veränderungen</h2><p>Führungswechsel, Übernahmen, Krisen und Strategiewechsel</p></div>
          </header>
          <MoversList movers={payload.movers}/>
        </section>
      </div>

      <WatchlistPanel items={payload.watchlist}/>
      <SourcePanel sources={payload.sources} failedFeeds={payload.meta.failedFeeds}/>

      <footer className="news-footer">
        <span>Erstellt mit {payload.meta.model} · {payload.meta.itemCount} Schlagzeilen aus {payload.meta.feedCount} Feeds · {payload.meta.sourceCount} verlinkte Quellen</span>
        {unsupportedNumbers.length > 0 && <span className="news-audit" title={`Nicht wörtlich in den Quellen gefunden: ${unsupportedNumbers.join(', ')}`}>
          <CircleAlert size={11}/>{unsupportedNumbers.length} Zahlenangabe{unsupportedNumbers.length === 1 ? '' : 'n'} ohne direkten Beleg
        </span>}
        <span>Stand {editionStamp(payload.meta.generatedAt, data.timeZone)} · Zeitzone {data.timeZone}</span>
      </footer>
    </> : !working && !error && !data.loadError && <section className="panel news-empty">
      <span className="news-empty-icon"><Newspaper size={20}/></span>
      <h2>Für diesen Tag liegt kein Briefing vor</h2>
      <p>Briefings entstehen immer für den aktuellen Tag. Das Archiv zeigt die Tage, an denen die Analyse gelaufen ist.</p>
      <Link className="button button-primary" href="/news">Heute öffnen</Link>
    </section>}
  </div>;
}
