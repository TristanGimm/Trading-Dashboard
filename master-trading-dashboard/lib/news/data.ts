import { ensureSchema, getPool } from '../db.ts';
import type { NewsArchiveEntry, NewsEdition, NewsEditionPayload, NewsEditionStatus, NewsPageData } from './types.ts';
import { makeDemoEdition } from './demo.ts';

type EditionRow = {
  edition_date: string;
  status: NewsEditionStatus;
  payload: NewsEditionPayload | null;
  model: string | null;
  source_count: number;
  generated_at: Date | null;
  started_at: Date;
  error: string | null;
};

type ArchiveRow = {
  edition_date: string;
  status: NewsEditionStatus;
  generated_at: Date | null;
  headline: string | null;
};

function mapEdition(row: EditionRow): NewsEdition {
  return {
    date: row.edition_date,
    status: row.status,
    generatedAt: row.generated_at ? row.generated_at.toISOString() : null,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    model: row.model,
    sourceCount: row.source_count,
    error: row.error,
    payload: row.payload,
  };
}

const EDITION_COLUMNS = `to_char(edition_date,'YYYY-MM-DD') AS edition_date, status, payload, model,
  source_count, generated_at, started_at, error`;

export async function getNewsEdition(date: string): Promise<NewsEdition | null> {
  await ensureSchema();
  const result = await getPool().query<EditionRow>(
    `SELECT ${EDITION_COLUMNS} FROM news_editions WHERE edition_date = $1::date`,
    [date],
  );
  return result.rows[0] ? mapEdition(result.rows[0]) : null;
}

export async function getLatestNewsEdition(): Promise<NewsEdition | null> {
  await ensureSchema();
  const result = await getPool().query<EditionRow>(
    `SELECT ${EDITION_COLUMNS} FROM news_editions
     WHERE status = 'ready' AND payload IS NOT NULL
     ORDER BY edition_date DESC LIMIT 1`,
  );
  return result.rows[0] ? mapEdition(result.rows[0]) : null;
}

export async function listNewsArchive(today: string, limit = 30): Promise<NewsArchiveEntry[]> {
  await ensureSchema();
  const result = await getPool().query<ArchiveRow>(
    `SELECT to_char(edition_date,'YYYY-MM-DD') AS edition_date, status, generated_at,
            payload->>'headline' AS headline
     FROM news_editions
     WHERE edition_date <= $1::date
     ORDER BY edition_date DESC
     LIMIT $2`,
    [today, Math.min(Math.max(limit, 1), 90)],
  );
  return result.rows.map(row => ({
    date: row.edition_date,
    status: row.status,
    generatedAt: row.generated_at ? row.generated_at.toISOString() : null,
    headline: row.headline,
  }));
}

export function editionAgeHours(edition: NewsEdition | null, now = new Date()): number | null {
  if (!edition?.generatedAt) return null;
  const age = now.getTime() - Date.parse(edition.generatedAt);
  return Number.isFinite(age) ? age / 3_600_000 : null;
}

/** Historical briefings do not age; today's does, so the page can offer a
 *  refresh before the morning session instead of showing stale levels. */
export function isEditionStale(edition: NewsEdition | null, today: string, now = new Date()): boolean {
  if (!edition) return true;
  if (edition.date !== today) return false;
  if (edition.status !== 'ready') return true;
  const age = editionAgeHours(edition, now);
  return age === null || age > 20;
}

export function isRunningStuck(edition: NewsEdition | null, now = new Date()): boolean {
  if (!edition || edition.status !== 'running' || !edition.startedAt) return false;
  const age = now.getTime() - Date.parse(edition.startedAt);
  return Number.isFinite(age) && age > 10 * 60_000;
}

function shouldAutoGenerate(edition: NewsEdition | null, selectedDate: string, today: string): boolean {
  if (selectedDate !== today) return false;
  if (!edition) return true;
  if (edition.status === 'error') return true;
  if (isRunningStuck(edition)) return true;
  return isEditionStale(edition, today);
}

function isDemoMode(): boolean {
  return process.env.GIMM_DEMO_MODE === 'true' && process.env.PGHOST === '127.0.0.1' && process.env.PGPORT === '1';
}

export async function loadNewsPage(selectedDate: string, today: string, timeZone: string): Promise<NewsPageData> {
  if (isDemoMode()) {
    const edition = makeDemoEdition(selectedDate);
    return {
      today,
      selectedDate,
      edition,
      latest: edition,
      archive: [{ date: selectedDate, status: 'ready', generatedAt: edition.generatedAt, headline: edition.payload?.headline ?? null }],
      timeZone,
      loadError: null,
      demo: true,
      autoGenerate: false,
    };
  }

  try {
    await ensureSchema();
    const [edition, latest, archive] = await Promise.all([
      getNewsEdition(selectedDate),
      getLatestNewsEdition(),
      listNewsArchive(today),
    ]);
    return {
      today,
      selectedDate,
      edition,
      latest,
      archive,
      timeZone,
      loadError: null,
      demo: false,
      autoGenerate: shouldAutoGenerate(edition, selectedDate, today),
    };
  } catch {
    return {
      today,
      selectedDate,
      edition: null,
      latest: null,
      archive: [],
      timeZone,
      loadError: 'Die News-Datenbank ist derzeit nicht erreichbar.',
      demo: false,
      autoGenerate: false,
    };
  }
}
