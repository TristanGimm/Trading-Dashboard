import type { NewsDigest } from './feeds.ts';
import type { NewsEditionPayload, NewsQuote } from './types.ts';

const TOKEN_RE = /(?<![\w.])([+-]?\d+(?:[.,]\d+)*)\s?(%|USD|Mrd\.?|Millionen|Billionen|Billion|Trillion|bp|Basispunkte)?/g;

/**
 * "3.800", "3,800" and "3800" all describe the same level; "5,1" and "5.103"
 * are decimals. Without context a separator is ambiguous, so every plausible
 * reading becomes a candidate and one match is enough.
 */
export function numericCandidates(token: string): number[] {
  const cleaned = token.replace(/\s/g, '').replace(/\.$/, '');
  if (!cleaned) return [];
  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');
  const candidates = new Set<number>();

  const plain = Number(cleaned.replace(/[.,]/g, ''));
  if (Number.isFinite(plain)) candidates.add(plain);

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    const normalised = cleaned.split(thousands).join('').replace(decimal, '.');
    const value = Number(normalised);
    if (Number.isFinite(value)) candidates.add(value);
  } else if (hasDot || hasComma) {
    const separator = hasDot ? '.' : ',';
    const parts = cleaned.split(separator);
    if (parts.length === 2) {
      const decimalValue = Number(`${parts[0]}.${parts[1]}`);
      if (Number.isFinite(decimalValue)) candidates.add(decimalValue);
      const thousandsValue = Number(parts.join(''));
      if (Number.isFinite(thousandsValue)) candidates.add(thousandsValue);
    }
  }

  return [...candidates];
}

function isYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function tokens(text: string): { raw: string; values: number[]; unit: string; displayUnit: string }[] {
  const result: { raw: string; values: number[]; unit: string; displayUnit: string }[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[1];
    const displayUnit = match[2] || '';
    const unit = displayUnit.toLowerCase();
    const values = numericCandidates(raw).filter(value => !isYear(value));
    if (!values.length) continue;
    result.push({ raw, values, unit, displayUnit });
  }
  return result;
}

function supported(values: number[], corpus: number[]): boolean {
  return values.some(value => corpus.some(reference => {
    const difference = Math.abs(reference - value);
    return difference <= 0.5 || difference / Math.max(Math.abs(reference), 1) <= 0.015;
  }));
}

function payloadText(payload: NewsEditionPayload): string {
  return [
    payload.headline,
    ...payload.marketPulse.map(pulse => pulse.note),
    ...[payload.today, payload.week, payload.month, payload.year, payload.lastYear, payload.ai].flatMap(section => [
      section.summary,
      ...section.bullets.map(bullet => bullet.text),
    ]),
    ...payload.outlook.map(item => item.summary),
    ...payload.movers.flatMap(mover => [mover.title, mover.detail]),
    ...payload.watchlist.map(item => item.note),
  ].join(' ');
}

/**
 * Deterministic check against the actual feed text and the quote snapshot.
 * It cannot prove an interpretation, but it catches invented price levels —
 * the failure mode that matters most in a trading briefing.
 */
export function auditNumbers(payload: NewsEditionPayload, digest: NewsDigest, quotes: NewsQuote[]): string[] {
  const corpusText = [
    ...digest.items.flatMap(item => [item.title, item.summary]),
    ...quotes.flatMap(quote => [
      String(quote.price),
      quote.changePercent === null || quote.changePercent === undefined ? '' : String(quote.changePercent),
      quote.changeBp === null || quote.changeBp === undefined ? '' : String(quote.changeBp),
    ]),
  ].join(' ');
  const corpus = tokens(corpusText).flatMap(token => token.values);

  if (process.env.NEWS_AUDIT_DEBUG) console.log('[audit] corpus', corpus, 'payload', tokens(payloadText(payload)));
  const unsupported: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens(payloadText(payload))) {
    const significant = token.unit !== '' || token.values.some(value => Math.abs(value) >= 100);
    if (!significant) continue;
    if (supported(token.values, corpus)) continue;
    const label = `${token.raw}${token.displayUnit ? ` ${token.displayUnit}` : ''}`;
    if (seen.has(label)) continue;
    seen.add(label);
    unsupported.push(label);
    if (unsupported.length >= 10) break;
  }
  return unsupported;
}
