import type { ComponentType } from 'react';
import { ArrowUpRight, ExternalLink, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type {
  NewsBullet, NewsMover, NewsOutlook, NewsPulse, NewsQuote, NewsSection,
  NewsWatchItem, NewsRef, NewsImpact,
} from '@/lib/news/types';
import { cn } from '@/lib/utils';

const IMPACT_LABEL: Record<NewsImpact, string> = {
  bullish: 'stützend',
  bearish: 'belastend',
  neutral: 'neutral',
};

function signed(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function price(value: number, symbol: string): string {
  const digits = symbol === 'XAU/USD' ? 2 : symbol === '^TNX' ? 3 : symbol === 'EURUSD=X' ? 4 : 2;
  return value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function ImpactBadge({ value, subtle = false }: { value: NewsImpact; subtle?: boolean }) {
  return <span className={cn('news-impact', value, subtle && 'subtle')}>
    {value === 'bullish' ? <TrendingUp size={10}/> : value === 'bearish' ? <TrendingDown size={10}/> : <Minus size={10}/>}
    {IMPACT_LABEL[value]}
  </span>;
}

export function BulletList({ bullets }: { bullets: NewsBullet[] }) {
  if (!bullets.length) return null;
  return <ul className="news-bullets">
    {bullets.map((bullet, index) => <li key={`${bullet.text.slice(0, 24)}-${index}`} className="news-bullet">
      <span className={cn('news-bullet-mark', bullet.impact)} aria-hidden="true"/>
      <div className="news-bullet-body">
        <p>{bullet.text}</p>
        <div className="news-bullet-meta">
          <ImpactBadge value={bullet.impact} subtle/>
          {bullet.assets.map(asset => <span key={asset} className="news-asset">{asset}</span>)}
          {bullet.refs.map(ref => <a key={ref.url} className="news-ref" href={ref.url} target="_blank" rel="noreferrer noopener" title={ref.title}>
            {ref.source}<ExternalLink size={9}/>
          </a>)}
        </div>
      </div>
    </li>)}
  </ul>;
}

export function SectionCard({ title, kicker, icon: Icon, section, className }: {
  title: string;
  kicker?: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  section: NewsSection;
  className?: string;
}) {
  return <section className={cn('panel news-section', className)}>
    <header className="news-section-head">
      <span className="news-section-icon"><Icon size={15} strokeWidth={1.7}/></span>
      <div><h2>{title}</h2>{kicker && <p>{kicker}</p>}</div>
    </header>
    {section.summary && <p className="news-summary">{section.summary}</p>}
    <BulletList bullets={section.bullets}/>
  </section>;
}

export function PulseGrid({ pulses }: { pulses: NewsPulse[] }) {
  return <div className="news-pulse-grid">
    {pulses.map(pulse => <div key={pulse.label} className={cn('news-pulse', pulse.stance)}>
      <div className="news-pulse-top"><span>{pulse.label}</span><i aria-hidden="true"/></div>
      <p>{pulse.note}</p>
      <small>{IMPACT_LABEL[pulse.stance]}</small>
    </div>)}
  </div>;
}

export function QuoteStrip({ quotes }: { quotes: NewsQuote[] }) {
  if (!quotes.length) return null;
  return <div className="news-quotes" aria-label="Marktlage">
    {quotes.map(quote => {
      const change = quote.changeBp !== null && quote.changeBp !== undefined
        ? `${signed(quote.changeBp, 1)} bp`
        : quote.changePercent !== null && quote.changePercent !== undefined
          ? `${signed(quote.changePercent)} %`
          : '—';
      const tone = quote.changeBp !== null && quote.changeBp !== undefined
        ? quote.changeBp
        : quote.changePercent ?? 0;
      return <div key={quote.symbol} className="news-quote">
        <span>{quote.label}</span>
        <strong>{price(quote.price, quote.symbol)}</strong>
        <small className={tone > 0 ? 'positive' : tone < 0 ? 'negative' : ''}>{change}</small>
      </div>;
    })}
  </div>;
}

export function OutlookGrid({ outlook }: { outlook: NewsOutlook[] }) {
  return <div className="news-outlook">
    {outlook.map(item => <article key={item.horizon} className={cn('news-outlook-card', item.bias)}>
      <div className="news-outlook-top"><span>{item.horizon}</span><ImpactBadge value={item.bias} subtle/></div>
      <p>{item.summary}</p>
    </article>)}
  </div>;
}

export function MoversList({ movers }: { movers: NewsMover[] }) {
  if (!movers.length) return <p className="news-empty-line">Keine Strukturveränderungen mit belastbarer Quelle gefunden.</p>;
  return <ul className="news-movers">
    {movers.map((mover, index) => <li key={`${mover.title}-${index}`}>
      <span className={cn('news-mover-dot', mover.impact)} aria-hidden="true"/>
      <div><strong>{mover.title}</strong><p>{mover.detail}</p></div>
      <ImpactBadge value={mover.impact} subtle/>
    </li>)}
  </ul>;
}

export function WatchlistPanel({ items }: { items: NewsWatchItem[] }) {
  return <section className="panel news-section news-watchlist">
    <header className="news-section-head">
      <span className="news-section-icon"><ArrowUpRight size={15} strokeWidth={1.7}/></span>
      <div><h2>Watchlist</h2><p>Nur Namen mit einem konkreten Signal in den letzten Tagen</p></div>
    </header>
    {items.length ? <div className="news-watch-rows">
      {items.map(item => <div key={item.symbol} className="news-watch-row">
        <span className="news-watch-symbol">{item.symbol}</span>
        <div className="news-watch-copy"><strong>{item.name}</strong><p>{item.note}</p></div>
        <ImpactBadge value={item.sentiment} subtle/>
      </div>)}
    </div> : <p className="news-empty-line">Heute kein Watchlist-Name mit klarem Signal. Das ist auch eine Information.</p>}
  </section>;
}

export function SourcePanel({ sources, failedFeeds }: { sources: NewsRef[]; failedFeeds: string[] }) {
  if (!sources.length && !failedFeeds.length) return null;
  return <details className="panel news-sources">
    <summary>
      <span>Quellen</span>
      <small>{sources.length} Artikel · öffentlich verlinkt</small>
    </summary>
    {sources.length > 0 && <ol>
      {sources.map(source => <li key={source.url}>
        <a href={source.url} target="_blank" rel="noreferrer noopener">{source.title}</a>
        <span>{source.source}</span>
      </li>)}
    </ol>}
    {failedFeeds.length > 0 && <p className="news-source-note">Nicht erreichbar beim letzten Lauf: {failedFeeds.join(' · ')}</p>}
  </details>;
}

export function editionStamp(generatedAt: string | null, timeZone: string): string {
  if (!generatedAt) return 'noch nicht erstellt';
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return 'unbekannt';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone,
  }).format(date);
}
