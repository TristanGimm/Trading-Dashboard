/** Shared vocabulary for the daily briefing. The model is asked for exactly
 *  these shapes; the normaliser is the only place that trusts its output. */
export type NewsImpact = 'bullish' | 'bearish' | 'neutral';

export type NewsCategory =
  | 'gold'
  | 'macro'
  | 'markets'
  | 'tech'
  | 'ai'
  | 'watchlist'
  | 'general'
  | 'year2026'
  | 'lastYear';

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  /** ISO timestamp, or null when the feed carried no usable date. */
  publishedAt: string | null;
  category: NewsCategory;
  summary: string;
};

export type NewsRef = { title: string; url: string; source: string };

export type NewsBullet = {
  text: string;
  impact: NewsImpact;
  assets: string[];
  refs: NewsRef[];
};

export type NewsSection = {
  summary: string;
  bullets: NewsBullet[];
};

export type NewsPulse = {
  label: string;
  stance: NewsImpact;
  note: string;
};

export type NewsWatchItem = {
  symbol: string;
  name: string;
  sentiment: NewsImpact;
  note: string;
};

export type NewsMover = {
  title: string;
  detail: string;
  impact: NewsImpact;
};

export type NewsQuote = {
  symbol: string;
  label: string;
  price: number;
  changePercent: number | null;
  /** Yield instruments move in basis points, not percent of price. */
  changeBp?: number | null;
  note?: string;
};

export type NewsOutlook = {
  horizon: string;
  bias: NewsImpact;
  summary: string;
};

export type NewsEditionPayload = {
  version: 1;
  date: string;
  headline: string;
  marketPulse: NewsPulse[];
  today: NewsSection;
  week: NewsSection;
  month: NewsSection;
  year: NewsSection;
  lastYear: NewsSection;
  outlook: NewsOutlook[];
  ai: NewsSection;
  movers: NewsMover[];
  watchlist: NewsWatchItem[];
  sources: NewsRef[];
  meta: {
    generatedAt: string;
    model: string;
    sourceCount: number;
    itemCount: number;
    feedCount: number;
    failedFeeds: string[];
    /** Numbers the deterministic check could not find in feed text or quotes. */
    unsupportedNumbers: string[];
    quotes: NewsQuote[];
    coverage: {
      today: number;
      week: number;
      month: number;
      year: number;
      lastYear: number;
    };
  };
};

export type NewsEditionStatus = 'ready' | 'running' | 'error';

export type NewsEdition = {
  date: string;
  status: NewsEditionStatus;
  generatedAt: string | null;
  startedAt: string | null;
  model: string | null;
  sourceCount: number;
  error: string | null;
  payload: NewsEditionPayload | null;
};

export type NewsArchiveEntry = {
  date: string;
  status: NewsEditionStatus;
  generatedAt: string | null;
  headline: string | null;
};

export type NewsPageData = {
  today: string;
  selectedDate: string;
  edition: NewsEdition | null;
  latest: NewsEdition | null;
  archive: NewsArchiveEntry[];
  timeZone: string;
  loadError: string | null;
  demo: boolean;
  /** True when the page should ask the server for today's briefing on mount. */
  autoGenerate: boolean;
};

export const IMPACTS: NewsImpact[] = ['bullish', 'bearish', 'neutral'];

export function isImpact(value: unknown): value is NewsImpact {
  return value === 'bullish' || value === 'bearish' || value === 'neutral';
}
