import type {
  NewsBullet, NewsEditionPayload, NewsImpact, NewsMover, NewsOutlook, NewsPulse,
  NewsRef, NewsSection, NewsWatchItem,
} from './types.ts';
import { isImpact } from './types.ts';
import type { NewsDigest } from './feeds.ts';
import { WATCHLIST } from './prompt.ts';
import { auditNumbers } from './grounding.ts';

const MAX_REF = 3;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Cut over-long text at the last complete sentence that fits, never in the
 *  middle of a word. The remainder is marked with an ellipsis so a shorter
 *  text is visibly shorter instead of looking like a broken sentence. */
function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentenceEnds = ['.', '!', '?']
    .map(mark => window.lastIndexOf(`${mark} `))
    .filter(index => index >= 0);
  const sentenceEnd = sentenceEnds.length ? Math.max(...sentenceEnds) : -1;
  // Keep a complete sentence only when it retains most of the budget;
  // otherwise fall back to the last word boundary before the limit.
  if (sentenceEnd >= Math.floor(max * 0.55)) {
    return `${window.slice(0, sentenceEnd + 1).trim()} …`;
  }
  const space = window.lastIndexOf(' ');
  const head = (space > 0 ? window.slice(0, space) : window).trim();
  return `${head} …`;
}

/** Model output is untrusted text: strip control characters, collapse
 *  whitespace and bound length before it reaches the database or the DOM. */
export function asText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clampText(text, max);
}

export function asImpact(value: unknown): NewsImpact {
  if (isImpact(value)) return value;
  const text = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (['positive', 'bullisch', 'stützend', 'unterstützend', 'risk-on', 'up'].includes(text)) return 'bullish';
  if (['negative', 'bärisch', 'belastend', 'risk-off', 'down'].includes(text)) return 'bearish';
  return 'neutral';
}

function asAssets(value: unknown): string[] {
  const seen = new Set<string>();
  const assets: string[] = [];
  for (const entry of array(value)) {
    const text = asText(entry, 24).toUpperCase();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    assets.push(text);
    if (assets.length >= 3) break;
  }
  return assets;
}

function makeRefLookup(digest: NewsDigest): Map<string, NewsRef> {
  return new Map(digest.items.map(item => [item.id, { title: item.title, url: item.url, source: item.source }]));
}

function asRefs(value: unknown, lookup: Map<string, NewsRef>): NewsRef[] {
  const seen = new Set<string>();
  const refs: NewsRef[] = [];
  for (const entry of array(value)) {
    const id = typeof entry === 'string' ? entry : asText(record(entry).id, 8);
    const ref = lookup.get(id.toUpperCase());
    if (!ref || seen.has(ref.url)) continue;
    seen.add(ref.url);
    refs.push(ref);
    if (refs.length >= MAX_REF) break;
  }
  return refs;
}

function asSection(value: unknown, lookup: Map<string, NewsRef>, maxBullets: number, maxSummary: number): NewsSection {
  const raw = record(value);
  const bullets: NewsBullet[] = [];
  for (const entry of array(raw.bullets)) {
    const bullet = record(entry);
    const text = asText(bullet.text, 320);
    if (!text) continue;
    bullets.push({
      text,
      impact: asImpact(bullet.impact),
      assets: asAssets(bullet.assets),
      refs: asRefs(bullet.refs ?? bullet.sources, lookup),
    });
    if (bullets.length >= maxBullets) break;
  }
  return { summary: asText(raw.summary, maxSummary), bullets };
}

function asPulse(value: unknown): NewsPulse[] {
  const wanted = ['Gold', 'US-Dollar', 'Tech', 'Risiko'];
  const pulses: NewsPulse[] = [];
  for (const entry of array(value)) {
    const pulse = record(entry);
    const label = asText(pulse.label, 24);
    if (!label) continue;
    pulses.push({ label, stance: asImpact(pulse.stance ?? pulse.impact), note: asText(pulse.note, 200) });
    if (pulses.length >= 4) break;
  }
  while (pulses.length < 4) {
    pulses.push({ label: wanted[pulses.length], stance: 'neutral', note: 'Keine belastbare Einschätzung aus den Quellen.' });
  }
  return pulses;
}

function asOutlook(value: unknown): NewsOutlook[] {
  const defaults = ['Nächste Woche', 'Nächster Monat', 'Bis Jahresende'];
  const outlook: NewsOutlook[] = [];
  for (const entry of array(value)) {
    const row = record(entry);
    const horizon = asText(row.horizon ?? row.label, 32);
    const summary = asText(row.summary, 600);
    if (!horizon || !summary) continue;
    outlook.push({ horizon, bias: asImpact(row.bias ?? row.impact), summary });
    if (outlook.length >= 3) break;
  }
  while (outlook.length < 3) {
    outlook.push({
      horizon: defaults[outlook.length],
      bias: 'neutral',
      summary: 'Für diesen Horizont lieferten die Quellen kein klares Bild. Die Einschätzung bleibt offen, bis neue Daten vorliegen.',
    });
  }
  return outlook;
}

function asMovers(value: unknown): NewsMover[] {
  const movers: NewsMover[] = [];
  for (const entry of array(value)) {
    const row = record(entry);
    const title = asText(row.title, 120);
    if (!title) continue;
    movers.push({ title, detail: asText(row.detail, 260), impact: asImpact(row.impact) });
    if (movers.length >= 4) break;
  }
  return movers;
}

function asWatchlist(value: unknown): NewsWatchItem[] {
  const bySymbol = new Map(WATCHLIST.map(entry => [entry.symbol.toUpperCase(), entry]));
  const byName = new Map(WATCHLIST.map(entry => [entry.name.toLowerCase(), entry]));
  const seen = new Set<string>();
  const items: NewsWatchItem[] = [];
  for (const entry of array(value)) {
    const row = record(entry);
    const symbol = asText(row.symbol, 12).toUpperCase();
    const name = asText(row.name, 60);
    const known = bySymbol.get(symbol) ?? byName.get(name.toLowerCase());
    if (!known || seen.has(known.symbol)) continue;
    seen.add(known.symbol);
    items.push({
      symbol: known.symbol,
      name: known.name,
      sentiment: asImpact(row.sentiment ?? row.impact),
      note: asText(row.note, 200),
    });
    if (items.length >= 12) break;
  }
  return items;
}

export type NormaliseContext = {
  date: string;
  digest: NewsDigest;
  quotes: NewsEditionPayload['meta']['quotes'];
  model: string;
  generatedAt: string;
};

/**
 * Turn the model's JSON into the only edition shape the UI trusts.
 * Unknown fields are dropped, citations are resolved against real feed items,
 * and empty sections fall back to an honest "no clear picture" instead of
 * letting a half-written answer blank the page.
 */
export function normaliseEdition(raw: unknown, context: NormaliseContext): NewsEditionPayload {
  const root = record(raw);
  const nested = record(root.sections);
  const sectionSource = Object.keys(nested).length ? nested : root;
  const lookup = makeRefLookup(context.digest);
  const today = asSection(sectionSource.today ?? root.today, lookup, 4, 700);

  if (!today.summary && today.bullets.length === 0) {
    throw new Error('Die KI-Antwort enthielt kein verwertbares Tagesbriefing.');
  }

  const week = asSection(sectionSource.week ?? root.week, lookup, 3, 900);
  const month = asSection(sectionSource.month ?? root.month, lookup, 3, 900);
  const year = asSection(sectionSource.year ?? root.year, lookup, 4, 900);
  const lastYear = asSection(sectionSource.lastYear ?? sectionSource.last_year ?? root.lastYear, lookup, 4, 900);
  const ai = asSection(sectionSource.ai ?? root.ai, lookup, 3, 900);

  const refs: NewsRef[] = [];
  const seen = new Set<string>();
  for (const section of [today, week, month, year, lastYear, ai]) {
    for (const bullet of section.bullets) {
      for (const ref of bullet.refs) {
        if (seen.has(ref.url)) continue;
        seen.add(ref.url);
        refs.push(ref);
      }
    }
  }
  if (refs.length < 8) {
    for (const item of context.digest.items.slice(0, 20)) {
      if (refs.length >= 20) break;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      refs.push({ title: item.title, url: item.url, source: item.source });
    }
  }

  const edition: NewsEditionPayload = {
    version: 1,
    date: context.date,
    headline: asText(root.headline, 220) || 'Tagesbriefing für Gold, Tech und KI',
    marketPulse: asPulse(root.marketPulse ?? root.market_pulse),
    today,
    week,
    month,
    year,
    lastYear,
    outlook: asOutlook(root.outlook),
    ai,
    movers: asMovers(root.movers),
    watchlist: asWatchlist(root.watchlist),
    sources: refs.slice(0, 40),
    meta: {
      generatedAt: context.generatedAt,
      model: context.model,
      sourceCount: refs.length,
      itemCount: context.digest.items.length,
      feedCount: context.digest.feedCount,
      failedFeeds: context.digest.failedFeeds.slice(0, 8),
      unsupportedNumbers: [],
      quotes: context.quotes,
      coverage: context.digest.coverage,
    },
  };
  edition.meta.unsupportedNumbers = auditNumbers(edition, context.digest, context.quotes);
  return edition;
}
