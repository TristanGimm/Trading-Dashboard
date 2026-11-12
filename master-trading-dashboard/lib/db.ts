import { Pool } from 'pg';
import type { Trade } from './types';
import { buildTradeWhere, type TradeFilter } from './trade-query';

const globalDb = globalThis as unknown as { __tradingPool?: Pool; __tradingSchema?: Promise<void> };
export function getPool(): Pool {
  if (!globalDb.__tradingPool) {
    globalDb.__tradingPool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.DB_NAME || 'trading',
      user: process.env.DB_USER || 'trading',
      password: process.env.DB_PASSWORD,
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 15000,
      query_timeout: 20000,
    });
    globalDb.__tradingPool.on('error', () => console.error('An idle PostgreSQL connection failed.'));
  }
  return globalDb.__tradingPool;
}

export const schema = `
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  trade_id TEXT NOT NULL,
  trade_number INTEGER,
  account TEXT[] NOT NULL DEFAULT '{}',
  date_time TIMESTAMPTZ,
  day_label TEXT,
  pair TEXT,
  position TEXT,
  net_eur NUMERIC(16,4),
  account_balance NUMERIC(16,4),
  r_multiple DOUBLE PRECISION,
  setup TEXT[] NOT NULL DEFAULT '{}',
  tf_type TEXT[] NOT NULL DEFAULT '{}',
  algorithm TEXT[] NOT NULL DEFAULT '{}',
  session_time TEXT[] NOT NULL DEFAULT '{}',
  liquidity_sweep BOOLEAN NOT NULL DEFAULT FALSE,
  dxy BOOLEAN NOT NULL DEFAULT FALSE,
  delta BOOLEAN NOT NULL DEFAULT FALSE,
  fractal_shift BOOLEAN NOT NULL DEFAULT FALSE,
  last_edited_time TIMESTAMPTZ,
  last_seen_run TEXT NOT NULL DEFAULT 'local',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recorded_outcome TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mfe_30m DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mae_30m DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS setup_quality TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_condition TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_tf TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tf_align TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS order_type TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS lot_size DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS pnl_percent DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS learning TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS outcome_tag TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS time_recorded BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS analysis_note TEXT;
ALTER TABLE trades ALTER COLUMN last_seen_run SET DEFAULT 'local';
UPDATE trades SET updated_at = COALESCE(last_edited_time, date_time, synced_at, NOW()) WHERE updated_at IS NULL;
ALTER TABLE trades ALTER COLUMN updated_at SET DEFAULT NOW();
ALTER TABLE trades ALTER COLUMN updated_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date_time);
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades USING GIN (account);
CREATE INDEX IF NOT EXISTS idx_trades_updated ON trades(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_quality ON trades(setup_quality);
CREATE INDEX IF NOT EXISTS idx_trades_condition ON trades USING GIN (market_condition);

CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY,
  parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT NOT NULL DEFAULT '📄',
  kind TEXT NOT NULL DEFAULT 'page' CHECK (kind IN ('page','trade')),
  trade_id TEXT UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id, position);
CREATE INDEX IF NOT EXISTS idx_pages_updated ON pages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_kind ON pages(kind) WHERE archived = FALSE;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  username_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reset','verify')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, kind);

CREATE TABLE IF NOT EXISTS strategy_board (
  id INTEGER PRIMARY KEY CHECK (id=1),
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assets_page ON assets(page_id);
`;

/**
 * Idempotent schema bootstrap. The web process is now the only writer, so it
 * ensures the tables exist once per process instead of relying on a worker.
 */
export function ensureSchema(): Promise<void> {
  if (!globalDb.__tradingSchema) {
    globalDb.__tradingSchema = getPool().query(schema).then(() => undefined).catch(error => {
      globalDb.__tradingSchema = undefined;
      throw error;
    });
  }
  return globalDb.__tradingSchema;
}

export async function initSchema() {
  await ensureSchema();
}

const tradeColumns = `id,trade_id,trade_number,account,date_time,day_label,pair,position,net_eur,account_balance,
 r_multiple,setup,tf_type,algorithm,session_time,liquidity_sweep,dxy,delta,fractal_shift,last_edited_time,recorded_outcome,mfe_30m,mae_30m,
 setup_quality,market_condition,entry_tf,tf_align,order_type,lot_size,pnl_percent,learning,outcome_tag,time_recorded,analysis_note,exit_time`;

type TradeRow = {
  id: string; trade_id: string; trade_number: number | null; account: string[] | null;
  date_time: Date | null; day_label: string | null; pair: string | null; position: string | null;
  net_eur: string | null; account_balance: string | null; r_multiple: number | null;
  setup: string[] | null; tf_type: string[] | null; algorithm: string[] | null; session_time: string[] | null;
  liquidity_sweep: boolean; dxy: boolean; delta: boolean; fractal_shift: boolean;
  last_edited_time: Date | null; recorded_outcome: string | null; mfe_30m: number | null; mae_30m: number | null;
  setup_quality: string | null; market_condition: string[] | null; entry_tf: string[] | null; tf_align: string[] | null;
  order_type: string | null; lot_size: number | null; pnl_percent: number | null; learning: string | null;
  outcome_tag: string | null; time_recorded: boolean; analysis_note: string | null; exit_time: Date | null;
};

export function mapTradeRow(x: TradeRow): Trade {
  return {
    recordedOutcome: x.recorded_outcome === 'win' || x.recorded_outcome === 'loss' || x.recorded_outcome === 'breakeven' ? x.recorded_outcome : null,
    mfe30m: x.mfe_30m ?? null,
    mae30m: x.mae_30m ?? null,
    id: x.id,
    tradeId: x.trade_id,
    tradeNumber: x.trade_number,
    account: x.account || [],
    dateTime: x.date_time?.toISOString() ?? null,
    day: x.day_label,
    pair: x.pair,
    position: x.position,
    netEur: x.net_eur === null ? null : Number(x.net_eur),
    accountBalance: x.account_balance === null ? null : Number(x.account_balance),
    rMultiple: x.r_multiple === null ? null : Number(x.r_multiple),
    setup: x.setup || [],
    tfType: x.tf_type || [],
    algorithm: x.algorithm || [],
    sessionTime: x.session_time || [],
    liquiditySweep: x.liquidity_sweep,
    dxy: x.dxy,
    delta: x.delta,
    fractalShift: x.fractal_shift,
    lastEditedTime: x.last_edited_time?.toISOString() ?? null,
    setupQuality: x.setup_quality ?? null,
    marketCondition: x.market_condition || [],
    entryTf: x.entry_tf || [],
    tfAlign: x.tf_align || [],
    orderType: x.order_type ?? null,
    lotSize: x.lot_size === null ? null : Number(x.lot_size),
    pnlPercent: x.pnl_percent === null ? null : Number(x.pnl_percent),
    learning: x.learning ?? null,
    outcomeTag: x.outcome_tag ?? null,
    timeRecorded: x.time_recorded !== false,
    analysisNote: x.analysis_note ?? null,
    exitTime: x.exit_time?.toISOString() ?? null,
  };
}

type ScreenshotRow = { trade_id: string; id: string; filename: string };

/**
 * Screenshots hang off the trade's notes page, so one query against `assets`
 * covers every trade on the screen instead of one request per row.
 */
export async function attachScreenshots(trades: Trade[]): Promise<Trade[]> {
  if (!trades.length) return trades;
  const result = await getPool().query<ScreenshotRow>(
    `SELECT pages.trade_id, assets.id, assets.filename
     FROM assets JOIN pages ON assets.page_id = pages.id
     WHERE pages.trade_id IS NOT NULL
     ORDER BY assets.created_at ASC`,
  );
  const byTrade = new Map<string, { id: string; caption: string | null }[]>();
  for (const row of result.rows) {
    const list = byTrade.get(row.trade_id) ?? [];
    list.push({ id: row.id, caption: row.filename });
    byTrade.set(row.trade_id, list);
  }
  return trades.map(trade => ({ ...trade, screenshots: byTrade.get(trade.id) ?? [] }));
}

export async function listTrades(filter: TradeFilter = {}): Promise<Trade[]> {
  await ensureSchema();
  const where = buildTradeWhere(filter);
  const result = await getPool().query(
    `SELECT ${tradeColumns} FROM trades` + where.sql + ' ORDER BY date_time ASC NULLS LAST, trade_number ASC NULLS LAST, id ASC',
    where.values,
  );
  return attachScreenshots(result.rows.map(mapTradeRow));
}

export async function getTrade(id: string): Promise<Trade | null> {
  await ensureSchema();
  const result = await getPool().query(`SELECT ${tradeColumns} FROM trades WHERE id=$1`, [id]);
  if (!result.rows[0]) return null;
  const [trade] = await attachScreenshots([mapTradeRow(result.rows[0])]);
  return trade;
}

export async function lastTradeUpdate(): Promise<string | null> {
  await ensureSchema();
  const result = await getPool().query('SELECT MAX(updated_at) AS at FROM trades');
  return result.rows[0]?.at?.toISOString() ?? null;
}
