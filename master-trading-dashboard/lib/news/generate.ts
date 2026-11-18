import { createHash } from 'node:crypto';
import { ensureSchema, getPool } from '../db.ts';
import { callDeepSeek, DeepSeekError } from './deepseek.ts';
import { collectNews } from './feeds.ts';
import { collectQuotes } from './quotes.ts';
import { buildNewsPrompt } from './prompt.ts';
import { normaliseEdition } from './normalize.ts';
import { dateInZone, isDateString } from './dates.ts';
import { getDashboardTimezone } from '../timezone.ts';
import { getNewsEdition } from './data.ts';
import type { NewsEdition } from './types.ts';

export class NewsBusyError extends Error {
  constructor(message = 'Für diesen Tag läuft bereits eine Analyse.') {
    super(message);
    this.name = 'NewsBusyError';
  }
}

export class NewsGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NewsGenerationError';
  }
}

const MIN_REUSE_MINUTES = 20;

type GenerateOptions = {
  date?: string;
  force?: boolean;
  trigger?: 'cron' | 'manual' | 'auto';
};

function lockKeyFor(date: string): number {
  return createHash('sha1').update(`news:${date}`).digest().readInt32BE(0);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei der Analyse.';
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

/**
 * One edition per day:
 *  1. claim the day with a PostgreSQL advisory lock (two workers cannot race),
 *  2. collect public RSS headlines and a market snapshot,
 *  3. ask DeepSeek for the structured briefing,
 *  4. normalise it and persist the result.
 * A failed run never deletes the last good briefing.
 */
export async function generateNewsEdition(options: GenerateOptions = {}): Promise<NewsEdition> {
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  const today = dateInZone(timeZone);
  const date = options.date && isDateString(options.date) ? options.date : today;
  if (date !== today) {
    throw new NewsGenerationError('Briefings werden nur für den aktuellen Tag erzeugt.');
  }

  await ensureSchema();

  if (!options.force) {
    const existing = await getNewsEdition(date);
    if (existing?.status === 'ready' && existing.generatedAt) {
      const ageMinutes = (Date.now() - Date.parse(existing.generatedAt)) / 60_000;
      if (Number.isFinite(ageMinutes) && ageMinutes < MIN_REUSE_MINUTES) return existing;
    }
    if (existing?.status === 'running' && existing.startedAt) {
      const ageMinutes = (Date.now() - Date.parse(existing.startedAt)) / 60_000;
      if (Number.isFinite(ageMinutes) && ageMinutes < 10) throw new NewsBusyError();
    }
  }

  const client = await getPool().connect();
  const lockKey = lockKeyFor(date);
  let locked = false;
  const started = Date.now();

  try {
    const lockResult = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [lockKey]);
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) throw new NewsBusyError();

    await client.query(
      `INSERT INTO news_editions (edition_date, status, started_at, error)
       VALUES ($1::date, 'running', NOW(), NULL)
       ON CONFLICT (edition_date) DO UPDATE SET status='running', started_at=NOW(), error=NULL`,
      [date],
    );

    const [digest, quotes] = await Promise.all([collectNews(date), collectQuotes()]);
    if (!digest.items.length) {
      throw new NewsGenerationError('Keine erreichbaren News-Quellen. Bitte später erneut versuchen.');
    }

    const prompt = buildNewsPrompt({ date, timeZone, digest, quotes });
    let result;
    try {
      result = await callDeepSeek(prompt.system, prompt.user);
    } catch (error) {
      // JSON mode is good, not perfect. A malformed answer is worth exactly
      // one more attempt; a network or quota failure is not retried here.
      if (error instanceof DeepSeekError && /JSON/i.test(error.message)) {
        console.warn('[news] DeepSeek returned invalid JSON, retrying once');
        result = await callDeepSeek(
          `${prompt.system}\nWICHTIG: Die vorherige Antwort war ungültiges JSON. Antworte erneut, halte dich exakt an das Schema und prüfe Kommas, Anführungszeichen und Klammern.`,
          prompt.user,
        );
      } else {
        throw error;
      }
    }
    const generatedAt = new Date().toISOString();
    const payload = normaliseEdition(result.raw, {
      date,
      digest,
      quotes,
      model: result.model,
      generatedAt,
    });

    await getPool().query(
      `UPDATE news_editions
       SET status='ready', payload=$2, model=$3, source_count=$4, generated_at=$5, error=NULL
       WHERE edition_date=$1::date`,
      [date, JSON.stringify(payload), result.model, payload.sources.length, generatedAt],
    );

    console.info(
      `[news] ${date} ready in ${((Date.now() - started) / 1000).toFixed(1)}s · ` +
      `${digest.items.length} items from ${digest.feedCount} feeds · ${result.model} · ` +
      `${result.usage?.totalTokens ?? 0} tokens · trigger=${options.trigger ?? 'manual'}`,
    );
    if (digest.failedFeeds.length) console.warn(`[news] ${date} feed failures: ${digest.failedFeeds.join(' | ')}`);

    return {
      date,
      status: 'ready',
      generatedAt,
      startedAt: new Date(started).toISOString(),
      model: result.model,
      sourceCount: payload.sources.length,
      error: null,
      payload,
    };
  } catch (error) {
    const message = errorMessage(error);
    try {
      await getPool().query(
        `UPDATE news_editions SET status='error', error=$2 WHERE edition_date=$1::date`,
        [date, message],
      );
    } catch {
      // The database may be the reason the run failed; the original error wins.
    }
    console.error(`[news] ${date} failed after ${((Date.now() - started) / 1000).toFixed(1)}s: ${message}`);
    throw error;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
      } catch { /* connection is being released anyway */ }
    }
    client.release();
  }
}
