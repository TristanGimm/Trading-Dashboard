import type { NewsQuote } from './types.ts';

type YahooMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  currency?: string;
};

const YAHOO_QUOTES = [
  { symbol: 'DX-Y.NYB', label: 'DXY', note: 'US-Dollar-Index' },
  { symbol: '^TNX', label: 'US 10Y', note: 'Rendite', yieldBp: true },
  { symbol: '^VIX', label: 'VIX', note: 'Volatilität' },
  { symbol: 'NQ=F', label: 'Nasdaq 100', note: 'Future' },
  { symbol: 'ES=F', label: 'S&P 500', note: 'Future' },
  { symbol: 'EURUSD=X', label: 'EUR/USD', note: 'Devisen' },
];

async function fetchYahoo(symbol: string): Promise<{ price: number; previous: number | null } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GimmNews/1.0)', accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json() as { chart?: { result?: { meta?: YahooMeta }[] } };
    const meta = body.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== 'number' || !Number.isFinite(price)) return null;
    const previous = meta?.chartPreviousClose ?? meta?.previousClose;
    return { price, previous: typeof previous === 'number' && Number.isFinite(previous) ? previous : null };
  } catch {
    return null;
  }
}

async function fetchGoldSpot(): Promise<number | null> {
  try {
    const response = await fetch('https://api.gold-api.com/price/XAU', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json() as { price?: number };
    return typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : null;
  } catch {
    return null;
  }
}

/** A compact snapshot, not a price feed: enough for the model and the header
 *  strip to know whether gold is being bought or sold today. */
export async function collectQuotes(): Promise<NewsQuote[]> {
  const [goldSpot, goldFuture, ...rest] = await Promise.all([
    fetchGoldSpot(),
    fetchYahoo('GC=F'),
    ...YAHOO_QUOTES.map(entry => fetchYahoo(entry.symbol)),
  ]);

  const quotes: NewsQuote[] = [];
  const goldPrice = goldSpot ?? goldFuture?.price;
  if (typeof goldPrice === 'number') {
    const changePercent = goldFuture?.previous
      ? (goldFuture.price - goldFuture.previous) / goldFuture.previous * 100
      : null;
    quotes.push({
      symbol: 'XAU/USD',
      label: 'Gold',
      price: goldPrice,
      changePercent,
      note: 'Spot · Veränderung via COMEX-Frontmonat',
    });
  }

  YAHOO_QUOTES.forEach((entry, index) => {
    const value = rest[index];
    if (!value) return;
    const changePercent = value.previous ? (value.price - value.previous) / value.previous * 100 : null;
    quotes.push({
      symbol: entry.symbol,
      label: entry.label,
      price: value.price,
      changePercent: entry.yieldBp ? null : changePercent,
      changeBp: entry.yieldBp && value.previous ? (value.price - value.previous) * 100 : null,
      note: entry.note,
    });
  });

  return quotes;
}

export function quoteLine(quote: NewsQuote): string {
  if (quote.symbol === 'XAU/USD') return `XAU/USD Spot: ${quote.price.toFixed(2)} USD`;
  if (quote.changeBp !== null && quote.changeBp !== undefined) {
    return `${quote.label}: ${quote.price.toFixed(3)} % (${quote.changeBp >= 0 ? '+' : ''}${quote.changeBp.toFixed(1)} bp)`;
  }
  const change = quote.changePercent === null ? '' : `, Tag ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)} %`;
  return `${quote.label}: ${quote.price.toLocaleString('de-DE', { maximumFractionDigits: 4 })}${change}`;
}
