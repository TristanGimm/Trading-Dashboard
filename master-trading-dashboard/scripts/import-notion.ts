import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ensureSchema, getPool } from '../lib/db.ts';

/**
 * Import a Notion CSV export of the Master Trading Journal.
 *
 *   node --experimental-strip-types scripts/import-notion.ts <file.csv> [--dry-run] [--replace]
 *
 * The CSV alone carries no image files: the Analysis column points at a path
 * inside the export. analysisNote keeps that path as a reference, and the ZIP
 * importer clears it once the matching screenshot is attached.
 */

type Row = Record<string, string>;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, sept: 9, october: 10, november: 11, december: 12,
};

function cell(row: Row, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function splitList(value: string): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map(part => part.trim()).filter(Boolean))];
}

/**
 * Read the first number in a cell. Notion free-text fields arrive as
 * "0.03 Lots", "2,52%" or " 0.5 " — a plain Number() would reject all of them.
 */
function numberOrNull(value: string): number | null {
  if (!value) return null;
  const text = value.trim();
  // A lone comma decimal separator ("0,03") only counts when there is no dot.
  const normalized = /\d,\d/.test(text) && !text.includes('.') ? text.replace(/,/g, '.') : text;
  const match = /-?\d+(?:\.\d+)?/.exec(normalized.replace(/(?<=\d),(?=\d{3}\b)/g, ''));
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse one Notion date value: "March 19, 2026", "April 13, 2026 17:09 (GMT+2)".
 * A date range arrives as "start → end"; the caller splits it first.
 */
function parseSingleTime(value: string, timeZone: string): { dateTime: string | null; timeRecorded: boolean } {
  const text = value.trim();
  if (!text) return { dateTime: null, timeRecorded: false };
  const match = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2}))?(?:\s*\(GMT([+-]\d{1,2})(?::?(\d{2}))?\))?$/.exec(text);
  if (!match) throw new Error(`Unrecognised Time value: ${value}`);
  const month = MONTH_NAMES[match[1].toLowerCase()];
  if (!month) throw new Error(`Unknown month in Time value: ${value}`);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const hasTime = Boolean(match[4]);
  if (!hasTime) {
    // Date-only entry: anchor at local midnight in the dashboard timezone, flagged as such.
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;
    return { dateTime: localToIso(iso, timeZone), timeRecorded: false };
  }
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (match[6]) {
    const offsetHours = Number(match[6]);
    const offsetMinutes = match[7] ? Number(match[7]) : 0;
    const sign = offsetHours < 0 ? -1 : 1;
    const utc = Date.UTC(year, month - 1, day, hour, minute) - sign * (Math.abs(offsetHours) * 60 + offsetMinutes) * 60000;
    return { dateTime: new Date(utc).toISOString(), timeRecorded: true };
  }
  return { dateTime: localToIso(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`, timeZone), timeRecorded: true };
}

/**
 * Split a Notion date-range cell and parse both ends. The end may be a bare
 * time ("→ 9:30"); in that case it belongs to the start date, rolling into the
 * next day when the clock goes backwards.
 */
function parseNotionTime(value: string, timeZone: string): { dateTime: string | null; exitTime: string | null; timeRecorded: boolean } {
  const [startRaw, endRaw] = value.split('→');
  const entry = parseSingleTime(startRaw, timeZone);
  let exitTime: string | null = null;
  const end = (endRaw || '').trim();
  if (end) {
    const bareTime = /^(\d{1,2}):(\d{2})$/.exec(end);
    if (bareTime && entry.dateTime) {
      const startText = startRaw.trim();
      const datePart = startText.replace(/\s*\d{1,2}:\d{2}.*$/, '');
      const offset = /\(GMT([+-]\d{1,2})(?::?(\d{2}))?\)/.exec(startText);
      const suffix = offset ? ` (GMT${offset[1]}${offset[2] ? `:${offset[2]}` : ''})` : '';
      let candidate = parseSingleTime(`${datePart} ${end}${suffix}`, timeZone).dateTime;
      if (candidate && entry.dateTime && Date.parse(candidate) < Date.parse(entry.dateTime)) {
        const next = new Date(Date.parse(candidate) + 86400000).toISOString();
        candidate = next;
      }
      exitTime = candidate;
    } else {
      exitTime = parseSingleTime(end, timeZone).dateTime;
    }
  }
  return { dateTime: entry.dateTime, exitTime, timeRecorded: entry.timeRecorded };
}

function localToIso(local: string, timeZone: string): string {
  const wall = Date.parse(`${local}Z`);
  let timestamp = wall - (wall - Date.parse(new Date(wall).toLocaleString('en-US', { timeZone }) + 'Z'));
  // Two passes settle the offset around a DST boundary.
  const offset = (value: number) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(value));
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second)) - value;
  };
  timestamp = wall - offset(wall);
  timestamp = wall - offset(timestamp);
  return new Date(timestamp).toISOString();
}

function outcomeFrom(row: Row): { recorded: 'win' | 'loss' | 'breakeven' | null; tag: string | null } {
  const tag = cell(row, 'Win', 'Loss', 'B/E');
  if (!tag) return { recorded: null, tag: null };
  const lower = tag.toLowerCase();
  if (lower === 'b/e' || lower === 'be' || lower === 'breakeven') return { recorded: 'breakeven', tag };
  if (lower.includes('win')) return { recorded: 'win', tag };
  if (lower.includes('loss')) return { recorded: 'loss', tag };
  return { recorded: null, tag };
}

/** Strip a CSV cell that may contain a BOM or stray whitespace. */
function normaliseHeader(name: string): string {
  return name.replace(/^\uFEFF/, '').trim();
}

export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === ',') { record.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { record.push(field); rows.push(record); record = []; field = ''; continue; }
    field += char;
  }
  if (field || record.length) { record.push(field); rows.push(record); }
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map(normaliseHeader);
  return body
    .filter(line => line.some(value => value.trim()))
    .map(line => Object.fromEntries(keys.map((key, index) => [key, line[index] ?? ''])));
}

export type ImportSummary = {
  rows: number;
  withNetEur: number;
  withoutNetEur: number;
  withTime: number;
  dateOnly: number;
  withExitTime: number;
  withLotSize: number;
  withPnlPercent: number;
  wins: number;
  losses: number;
  breakeven: number;
  untagged: number;
};

/**
 * Import the rows of a Notion CSV export.
 *
 * Exported as a function so the ZIP importer can run it in the same process:
 * spawning `node --experimental-strip-types` fails on the application's
 * extensionless imports, and `tsx` is already the runner for both scripts.
 * The caller owns the connection pool; this function never ends it.
 */
export async function importTradesFromCsv(path: string, options: { dryRun?: boolean; replace?: boolean } = {}): Promise<{ trades: number; summary: ImportSummary }> {
  const { dryRun = false, replace = false } = options;
  const timeZone = process.env.DASHBOARD_TIMEZONE || 'Europe/Berlin';

  const rows = parseCsv(await readFile(path, 'utf8'));
  if (!rows.length) throw new Error('The CSV has no data rows.');

  const trades = rows.map((row, index) => {
    const tradeId = cell(row, 'Trade ID') || String(index + 1);
    const numeric = Number(tradeId);
    const account = splitList(cell(row, 'Account'));
    const outcome = outcomeFrom(row);
    const time = parseNotionTime(cell(row, 'Time'), timeZone);
    const analysisPath = cell(row, 'Analysis');
    return {
      id: randomUUID(),
      tradeId,
      tradeNumber: Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null,
      account: account.length ? account : ['Forwardtesting'],
      dateTime: time.dateTime,
      exitTime: time.exitTime,
      timeRecorded: time.timeRecorded,
      day: cell(row, 'Day') || null,
      pair: cell(row, 'Pair') || null,
      position: cell(row, 'Position') || null,
      netEur: numberOrNull(cell(row, 'Net €')),
      accountBalance: numberOrNull(cell(row, 'Account Balance')),
      rMultiple: numberOrNull(cell(row, 'R')),
      setup: splitList(cell(row, 'Setup')),
      tfType: splitList(cell(row, 'TF Type')),
      algorithm: splitList(cell(row, 'Algorithm')),
      sessionTime: splitList(cell(row, 'Session Time')),
      liquiditySweep: cell(row, 'Liquidity Sweep').toLowerCase() === 'yes',
      dxy: cell(row, 'DXY').toLowerCase() === 'yes',
      delta: cell(row, 'Delta').toLowerCase() === 'yes',
      fractalShift: cell(row, 'Fractal Shift').toLowerCase() === 'yes',
      recordedOutcome: outcome.recorded,
      outcomeTag: outcome.tag,
      mfe30m: numberOrNull(cell(row, 'MFE(30 min)', 'MFE(30min)')),
      mae30m: numberOrNull(cell(row, 'MAE (30min)', 'MAE(30min)')),
      setupQuality: cell(row, 'Setup Quality') || null,
      marketCondition: splitList(cell(row, 'Market Condition')),
      entryTf: splitList(cell(row, 'Entry TF')),
      tfAlign: splitList(cell(row, 'TF Align')),
      orderType: cell(row, 'Market or Limit?') || null,
      lotSize: numberOrNull(cell(row, 'Lot size')),
      pnlPercent: numberOrNull(cell(row, 'PnL %')),
      learning: cell(row, 'Learning') || null,
      analysisNote: analysisPath ? `Notion screenshot: ${analysisPath}` : null,
    };
  });

  const missingNet = trades.filter(trade => trade.netEur === null).length;
  const summary: ImportSummary = {
    rows: trades.length,
    withNetEur: trades.length - missingNet,
    withoutNetEur: missingNet,
    withTime: trades.filter(trade => trade.timeRecorded).length,
    dateOnly: trades.filter(trade => !trade.timeRecorded).length,
    withExitTime: trades.filter(trade => trade.exitTime).length,
    withLotSize: trades.filter(trade => trade.lotSize !== null).length,
    withPnlPercent: trades.filter(trade => trade.pnlPercent !== null).length,
    wins: trades.filter(trade => trade.recordedOutcome === 'win').length,
    losses: trades.filter(trade => trade.recordedOutcome === 'loss').length,
    breakeven: trades.filter(trade => trade.recordedOutcome === 'breakeven').length,
    untagged: trades.filter(trade => trade.recordedOutcome === null).length,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (dryRun) {
    console.log('Dry run: nothing written.');
    return { trades: trades.length, summary };
  }

  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (replace) await client.query('DELETE FROM trades');
    for (const trade of trades) {
      await client.query(
        `INSERT INTO trades (
           id,trade_id,trade_number,account,date_time,day_label,pair,position,net_eur,account_balance,r_multiple,
           setup,tf_type,algorithm,session_time,liquidity_sweep,dxy,delta,fractal_shift,last_edited_time,
           recorded_outcome,mfe_30m,mae_30m,setup_quality,market_condition,entry_tf,tf_align,order_type,
           lot_size,pnl_percent,learning,outcome_tag,time_recorded,analysis_note,exit_time,last_seen_run,updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,'notion-import',NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          trade.id, trade.tradeId, trade.tradeNumber, trade.account, trade.dateTime, trade.day, trade.pair,
          trade.position, trade.netEur, trade.accountBalance, trade.rMultiple, trade.setup, trade.tfType,
          trade.algorithm, trade.sessionTime, trade.liquiditySweep, trade.dxy, trade.delta, trade.fractalShift,
          trade.recordedOutcome, trade.mfe30m, trade.mae30m, trade.setupQuality, trade.marketCondition,
          trade.entryTf, trade.tfAlign, trade.orderType, trade.lotSize, trade.pnlPercent, trade.learning,
          trade.outcomeTag, trade.timeRecorded, trade.analysisNote, trade.exitTime,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  console.log(`Imported ${trades.length} trades.`);
  return { trades: trades.length, summary };
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: import-notion.ts <file.csv> [--dry-run] [--replace]');
  await importTradesFromCsv(path, {
    dryRun: process.argv.includes('--dry-run'),
    replace: process.argv.includes('--replace'),
  });
  await getPool().end();
}

if (process.argv[1]?.endsWith('import-notion.ts')) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
