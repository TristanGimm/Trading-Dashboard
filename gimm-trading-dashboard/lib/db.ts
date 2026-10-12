import { Pool } from 'pg';
import type { Trade, SyncStatus } from './types';
import { buildTradeWhere, type TradeFilter } from './trade-query';

const globalDb = globalThis as unknown as {__tradingPool?:Pool};
export function getPool(): Pool {
  if (!globalDb.__tradingPool) {
    globalDb.__tradingPool=new Pool({
      host:process.env.PGHOST||'localhost',
      port:Number(process.env.PGPORT||5432),
      database:process.env.DB_NAME||'trading',
      user:process.env.DB_USER||'trading',
      password:process.env.DB_PASSWORD,
      max:8,
      idleTimeoutMillis:30000,
      connectionTimeoutMillis:5000,
      statement_timeout:10000,
      query_timeout:15000,
      options:process.env.DB_READ_ONLY==='true'?'-c default_transaction_read_only=on':undefined,
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
  last_seen_run TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS recorded_outcome TEXT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mfe_30m DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS mae_30m DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date_time);
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades USING GIN (account);
CREATE TABLE IF NOT EXISTS sync_status (
  id INTEGER PRIMARY KEY CHECK(id=1),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  last_count INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'pending'
);
INSERT INTO sync_status (id) VALUES (1) ON CONFLICT DO NOTHING;
`;
export async function initSchema() {await getPool().query(schema);}

const selectSql=`SELECT id,trade_id,trade_number,account,date_time,day_label,pair,position,net_eur,account_balance,
 r_multiple,setup,tf_type,algorithm,session_time,liquidity_sweep,dxy,delta,fractal_shift,last_edited_time,recorded_outcome,mfe_30m,mae_30m
 FROM trades`;
export async function listTrades(filter:TradeFilter={}): Promise<Trade[]> {
  const where=buildTradeWhere(filter);
  const r=await getPool().query(selectSql+where.sql+' ORDER BY date_time ASC NULLS LAST, trade_number ASC NULLS LAST, id ASC',where.values);
  return r.rows.map(x=>({
    recordedOutcome:x.recorded_outcome??null,mfe30m:x.mfe_30m??null,mae30m:x.mae_30m??null,
    id:x.id,tradeId:x.trade_id,tradeNumber:x.trade_number,account:x.account||[],
    dateTime:x.date_time?.toISOString()??null,day:x.day_label,pair:x.pair,position:x.position,
    netEur:x.net_eur===null?null:Number(x.net_eur),accountBalance:x.account_balance===null?null:Number(x.account_balance),
    rMultiple:x.r_multiple===null?null:Number(x.r_multiple),setup:x.setup||[],tfType:x.tf_type||[],algorithm:x.algorithm||[],sessionTime:x.session_time||[],
    liquiditySweep:x.liquidity_sweep,dxy:x.dxy,delta:x.delta,fractalShift:x.fractal_shift,
    lastEditedTime:x.last_edited_time?.toISOString()??null,
  }));
}
export async function getSyncStatus(): Promise<SyncStatus|null> {
  const r=await getPool().query('SELECT last_synced_at,last_error,last_count,state FROM sync_status WHERE id=1');
  if(!r.rows[0])return null;
  const s=r.rows[0];return {lastSyncedAt:s.last_synced_at?.toISOString()??null,lastError:s.last_error?'Synchronization needs attention. Check the worker logs.':null,lastCount:s.last_count,state:s.state};
}
