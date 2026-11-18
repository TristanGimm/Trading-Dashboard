import type { NewsCategory, NewsItem } from './types';
import { shiftDate } from './dates.ts';

export type FeedSource = {
  id: string;
  label: string;
  url: string;
  category: NewsCategory;
  /** Hard cap before the global category cap is applied. */
  maxItems: number;
  /** Drop older undated/stale entries. Year feeds use from/to instead. */
  maxAgeHours?: number;
  from?: string;
  to?: string;
  /** Month feeds reserve room for older context in the monthly section. */
  period?: 'day' | 'month';
  /** Google News sometimes dates an item a few hours ahead of its own clock. */
  allowUndated?: boolean;
};

export type RawNewsItem = Omit<NewsItem, 'id'> & { feedId?: string; period?: 'day' | 'month' };

export type NewsDigest = {
  items: NewsItem[];
  byCategory: Record<NewsCategory, NewsItem[]>;
  fetchedAt: string;
  feedCount: number;
  failedFeeds: string[];
  coverage: {
    today: number;
    week: number;
    month: number;
    year: number;
    lastYear: number;
  };
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FEED_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 10 * 60_000;

const googleNews = (query: string): string =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

/**
 * The briefing draws from three kinds of source:
 *  - Google News queries (broad, date-bounded, include the publisher name),
 *  - specialist feeds (gold, FX, AI labs),
 *  - general business and tech desks.
 * All of them are public RSS; nothing is scraped behind a login.
 */
export function buildFeeds(date: string): FeedSource[] {
  const year = date.slice(0, 4);
  return [
    // Today / last three days -------------------------------------------------
    {
      id: 'gnews-gold', label: 'Google News · Gold', category: 'gold', maxItems: 60, maxAgeHours: 80,
      url: googleNews('gold price OR XAU/USD OR bullion when:3d'),
    },
    {
      id: 'forexlive', label: 'ForexLive', category: 'macro', maxItems: 25, maxAgeHours: 72,
      url: 'https://www.forexlive.com/feed/news',
    },
    {
      id: 'mining', label: 'Mining.com', category: 'gold', maxItems: 20, maxAgeHours: 96,
      url: 'https://www.mining.com/feed/',
    },
    {
      id: 'gnews-fed', label: 'Google News · Fed & Makro', category: 'macro', maxItems: 55, maxAgeHours: 80,
      url: googleNews('Federal Reserve OR CPI OR inflation OR jobs report OR Treasury yields when:3d'),
    },
    {
      id: 'fed-press', label: 'Federal Reserve', category: 'macro', maxItems: 10, maxAgeHours: 240,
      url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    },
    {
      id: 'wsj-markets', label: 'WSJ Markets', category: 'markets', maxItems: 20, maxAgeHours: 96,
      url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    },
    {
      id: 'marketwatch', label: 'MarketWatch', category: 'markets', maxItems: 12, maxAgeHours: 96,
      url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    },
    {
      id: 'gnews-tech', label: 'Google News · Tech & KI', category: 'tech', maxItems: 60, maxAgeHours: 80,
      url: googleNews('semiconductor OR Nvidia OR AMD OR TSMC OR ASML OR OpenAI OR Anthropic OR "AI model" when:3d'),
    },
    {
      id: 'techcrunch', label: 'TechCrunch', category: 'tech', maxItems: 20, maxAgeHours: 96,
      url: 'https://techcrunch.com/feed/',
    },
    {
      id: 'verge', label: 'The Verge', category: 'tech', maxItems: 12, maxAgeHours: 96,
      url: 'https://www.theverge.com/rss/index.xml',
    },
    {
      id: 'ars', label: 'Ars Technica', category: 'tech', maxItems: 20, maxAgeHours: 96,
      url: 'https://feeds.arstechnica.com/arstechnica/index',
    },
    {
      id: 'bbc-business', label: 'BBC Business', category: 'markets', maxItems: 20, maxAgeHours: 96,
      url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    },
    {
      id: 'openai', label: 'OpenAI', category: 'ai', maxItems: 12, maxAgeHours: 336,
      url: 'https://openai.com/blog/rss.xml',
    },
    {
      id: 'decoder', label: 'The Decoder', category: 'ai', maxItems: 12, maxAgeHours: 96,
      url: 'https://the-decoder.com/feed/',
    },
    {
      id: 'mit-ai', label: 'MIT Technology Review · AI', category: 'ai', maxItems: 10, maxAgeHours: 168,
      url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed',
    },
    {
      id: 'gnews-watchlist', label: 'Google News · Watchlist', category: 'watchlist', maxItems: 60, maxAgeHours: 120,
      url: googleNews('Tesla OR Apple OR Microsoft OR Amazon OR Meta OR Netflix OR Siemens OR Rheinmetall OR "Siemens Energy" when:5d'),
    },
    {
      id: 'gnews-movers', label: 'Google News · Unternehmen', category: 'general', maxItems: 45, maxAgeHours: 96,
      url: googleNews('CEO resigns OR CEO steps down OR takeover OR acquisition OR crisis OR restructuring when:3d'),
    },

    // Month context -----------------------------------------------------------
    {
      id: 'gnews-gold-month-early', label: 'Google News · Gold Monatsanfang', category: 'gold', maxItems: 35, period: 'month',
      url: googleNews(`gold price OR XAU/USD after:${shiftDate(date, -31)} before:${shiftDate(date, -10)}`),
      from: shiftDate(date, -31), to: shiftDate(date, -10),
    },
    {
      id: 'gnews-tech-month-early', label: 'Google News · Tech Monatsanfang', category: 'tech', maxItems: 35, period: 'month',
      url: googleNews(`Nvidia OR semiconductor OR "data center" after:${shiftDate(date, -31)} before:${shiftDate(date, -10)}`),
      from: shiftDate(date, -31), to: shiftDate(date, -10),
    },

    // Year context: one query per theme, so the yearly sections are a real arc
    // rather than whatever happened to be published most recently.
    {
      id: 'gnews-year-gold', label: `Google News · Gold ${year}`, category: 'year2026', maxItems: 50,
      url: googleNews(`gold record OR XAU/USD high after:${year}-01-01 before:${shiftDate(date, 1)}`),
      from: `${year}-01-01`, to: date,
    },
    {
      id: 'gnews-year-tech', label: `Google News · Tech & Makro ${year}`, category: 'year2026', maxItems: 60,
      url: googleNews(`Nvidia OR semiconductor OR "artificial intelligence" OR "Federal Reserve" after:${year}-01-01 before:${shiftDate(date, 1)}`),
      from: `${year}-01-01`, to: date,
    },
    {
      id: 'gnews-2025-gold', label: 'Google News · Gold 2025', category: 'lastYear', maxItems: 40,
      url: googleNews('gold record high 2025 after:2025-01-01 before:2026-01-01'),
      from: '2025-01-01', to: '2025-12-31',
    },
    {
      id: 'gnews-2025-tech', label: 'Google News · Tech & Makro 2025', category: 'lastYear', maxItems: 55,
      url: googleNews('Nvidia OR "artificial intelligence" OR "Federal Reserve rate cuts" 2025 after:2025-01-01 before:2026-01-01'),
      from: '2025-01-01', to: '2025-12-31',
    },
  ];
}

const CATEGORY_CAPS: Record<NewsCategory, number> = {
  gold: 30,
  macro: 24,
  markets: 20,
  tech: 32,
  ai: 24,
  watchlist: 26,
  general: 14,
  year2026: 34,
  lastYear: 34,
};

/** Earlier entries win a duplicate; category order decides who owns it. */
const CATEGORY_PRIORITY: NewsCategory[] = [
  'gold', 'macro', 'watchlist', 'tech', 'ai', 'markets', 'general', 'year2026', 'lastYear',
];

const feedCache = new Map<string, { expires: number; items: RawNewsItem[] }>();

// Google News starts answering 429 when fifteen queries leave together. A
// single queue with a short gap keeps the daily run reliable without slowing
// the independent publisher feeds.
let googleQueue: Promise<unknown> = Promise.resolve();
function throttleGoogle<T>(work: () => Promise<T>): Promise<T> {
  const run = googleQueue.then(async () => {
    await new Promise(resolve => setTimeout(resolve, 1_200));
    return work();
  });
  googleQueue = run.then(() => undefined, () => undefined);
  return run;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match);
}

function textOf(raw: string | undefined, max = 400): string {
  if (!raw) return '';
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const withoutTags = withoutCdata.replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim().slice(0, max);
}

function tagText(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i').exec(block);
    if (match && textOf(match[1])) return match[1];
  }
  return undefined;
}

function linkOf(block: string): string | undefined {
  const atom = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (atom) return decodeEntities(atom[1]).trim();
  const raw = tagText(block, ['link', 'guid', 'id']);
  return raw ? textOf(raw) : undefined;
}

function dateOf(block: string): string | null {
  const raw = tagText(block, ['pubDate', 'published', 'updated', 'dc:date', 'date']);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  // Some publishers emit a date-only value; noon UTC keeps it on the same day
  // in every dashboard timezone.
  return parsed.toISOString();
}

function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normaliseTitle(title: string, source: string): string {
  const suffix = ` - ${source}`;
  const withoutSource = source && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
  return withoutSource.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function inWindow(item: RawNewsItem, feed: FeedSource, now: Date): boolean {
  if (!item.publishedAt) return feed.allowUndated ?? false;
  const published = new Date(item.publishedAt);
  if (feed.from && item.publishedAt.slice(0, 10) < feed.from) return false;
  if (feed.to && item.publishedAt.slice(0, 10) > feed.to) return false;
  if (feed.maxAgeHours) {
    const ageHours = (now.getTime() - published.getTime()) / 3_600_000;
    if (ageHours > feed.maxAgeHours) return false;
    if (ageHours < -6) return false;
  }
  return true;
}

/**
 * Tolerant RSS 2.0 / Atom reader. It deliberately does not pull in an XML
 * dependency: the briefing only needs title, link, date, source and a short
 * summary, and a malformed single item must never take the whole feed down.
 */
export function parseFeed(xml: string, feed: FeedSource, now = new Date()): RawNewsItem[] {
  const items: RawNewsItem[] = [];
  const blocks = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  for (const block of blocks.slice(0, 300)) {
    const source = textOf(tagText(block, ['source']), 80) || feed.label;
    const rawTitle = textOf(tagText(block, ['title']), 240);
    const url = safeUrl(linkOf(block));
    if (!rawTitle || !url) continue;
    const publishedAt = dateOf(block);
    const summary = textOf(tagText(block, ['description', 'summary', 'content:encoded', 'content']), 240);
    const item: RawNewsItem = { title: rawTitle, url, source, publishedAt, category: feed.category, summary, feedId: feed.id, period: feed.period };
    if (inWindow(item, feed, now)) items.push(item);
  }
  return items.slice(0, feed.maxItems);
}

async function fetchOne(feed: FeedSource, now: Date): Promise<RawNewsItem[]> {
  const cached = feedCache.get(feed.id);
  if (cached && cached.expires > Date.now()) return cached.items;
  const load = async () => {
    const response = await fetch(feed.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  };
  const loadOnce = () => feed.url.includes('news.google.com') ? throttleGoogle(load) : load();
  let xml: string;
  try {
    xml = await loadOnce();
  } catch (error) {
    // Google's rate limiter is temporary; one spaced retry is enough.
    if (error instanceof Error && /HTTP 429/.test(error.message)) {
      await new Promise(resolve => setTimeout(resolve, 2_500));
      xml = await loadOnce();
    } else {
      throw error;
    }
  }
  const items = parseFeed(xml, feed, now);
  feedCache.set(feed.id, { expires: Date.now() + CACHE_TTL_MS, items });
  return items;
}

async function mapLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export function dedupeItems(items: RawNewsItem[]): RawNewsItem[] {
  const byKey = new Map<string, { item: RawNewsItem; priority: number; direct: number }>();
  for (const item of items) {
    const key = normaliseTitle(item.title, item.source);
    if (key.length < 8) continue;
    const priority = CATEGORY_PRIORITY.indexOf(item.category);
    const direct = item.url.includes('news.google.com') ? 0 : 1;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { item, priority, direct });
      continue;
    }
    // A direct publisher link beats a Google redirect; otherwise the more
    // specific category (gold over general, tech over markets) owns the story.
    if (direct > existing.direct || (direct === existing.direct && priority < existing.priority)) {
      byKey.set(key, { item: { ...item, summary: item.summary || existing.item.summary }, priority, direct });
    }
  }
  return [...byKey.values()].map(entry => entry.item);
}

export async function collectNews(date: string, now = new Date()): Promise<NewsDigest> {
  const feeds = buildFeeds(date);
  const failures: string[] = [];
  const settled = await mapLimited(feeds, 6, async feed => {
    try {
      return await fetchOne(feed, now);
    } catch (error) {
      failures.push(`${feed.label}: ${error instanceof Error ? error.message : 'fetch failed'}`);
      return [] as RawNewsItem[];
    }
  });
  const unique = dedupeItems(settled.flat());
  const yearCategories = new Set<NewsCategory>(['year2026', 'lastYear']);
  const daily = unique
    .filter(item => !yearCategories.has(item.category))
    .sort((a, b) => {
      const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bt - at;
    });

  // Google returns each yearly query in relevance order. Round-robin across
  // feeds keeps gold, tech, macro and the year-in-review from crowding each
  // other out, while daily categories stay newest-first.
  const roundRobin = (items: RawNewsItem[]): RawNewsItem[] => {
    const groups = new Map<string, RawNewsItem[]>();
    for (const item of items) {
      const key = item.feedId || item.source;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    const lists = [...groups.values()];
    const result: RawNewsItem[] = [];
    for (let index = 0; result.length < items.length; index += 1) {
      let added = false;
      for (const list of lists) {
        if (list[index]) { result.push(list[index]); added = true; }
      }
      if (!added) break;
    }
    return result;
  };

  const yearPool = unique.filter(item => yearCategories.has(item.category));
  const orderedRaw: RawNewsItem[] = [];
  for (const category of CATEGORY_PRIORITY) {
    let chosen: RawNewsItem[];
    if (yearCategories.has(category)) {
      chosen = roundRobin(yearPool.filter(item => item.category === category));
    } else {
      const pool = daily.filter(item => item.category === category);
      // Gold and tech get a monthly tail: without it the 30-day feeds are
      // crowded out by this morning's headlines and the month section only
      // ever sees the last two days.
      const cap = CATEGORY_CAPS[category];
      const reserve = category === 'gold' || category === 'tech' ? 8 : 0;
      const month = reserve ? pool.filter(item => item.period === 'month') : [];
      const day = reserve ? pool.filter(item => item.period !== 'month') : pool;
      // Half of the monthly tail comes from the start of the month, half from
      // the last weeks, so the section sees an arc rather than one news day.
      const monthTail = [
        ...month.slice(-Math.floor(reserve / 2)),
        ...month.slice(0, Math.ceil(reserve / 2)),
      ].filter((item, index, list) => list.findIndex(entry => entry.url === item.url) === index);
      const chosenSet = [
        ...day.slice(0, Math.max(0, cap - reserve)),
        ...monthTail.slice(0, reserve),
      ];
      for (const item of [...day.slice(Math.max(0, cap - reserve)), ...monthTail.slice(reserve)]) {
        if (chosenSet.length >= cap) break;
        chosenSet.push(item);
      }
      chosen = chosenSet.slice(0, cap).sort((a, b) => {
        const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bt - at;
      });
    }
    orderedRaw.push(...chosen.slice(0, CATEGORY_CAPS[category]));
  }

  // IDs follow the prompt order: grouped by category, so the model reads each
  // theme as one block and citations stay stable.
  const ordered: NewsItem[] = orderedRaw.map((item, index) => ({ ...item, id: `S${index + 1}` }));
  const byCategory = Object.fromEntries(
    (Object.keys(CATEGORY_CAPS) as NewsCategory[]).map(category => [category, ordered.filter(item => item.category === category)]),
  ) as Record<NewsCategory, NewsItem[]>;

  const dailyItems = ordered.filter(item => !yearCategories.has(item.category));
  const daysAgo = (days: number) => {
    const boundary = new Date(now.getTime() - days * 86_400_000).toISOString();
    return dailyItems.filter(item => item.publishedAt && item.publishedAt >= boundary).length;
  };
  const yearStart = `${date.slice(0, 4)}-01-01`;

  return {
    items: ordered,
    byCategory,
    fetchedAt: now.toISOString(),
    feedCount: feeds.length,
    failedFeeds: failures,
    coverage: {
      today: daysAgo(1),
      week: daysAgo(7),
      month: daysAgo(30),
      year: ordered.filter(item => item.publishedAt && item.publishedAt.slice(0, 10) >= yearStart && item.publishedAt.slice(0, 10) <= date).length,
      lastYear: ordered.filter(item => item.category === 'lastYear').length,
    },
  };
}
