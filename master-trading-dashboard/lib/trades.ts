import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ensureSchema, getPool, getTrade, mapTradeRow } from './db';
import type { Trade } from './types';
import { deleteUpload } from './uploads';
import { ensureTradePage, updatePage } from './workspace';

const textList = z.array(z.string().trim().min(1).max(80)).max(30);
const nullableText = (max: number) => z.string().trim().max(max).nullable();

export const tradeInputSchema = z.object({
  tradeId: z.string().trim().min(1).max(40).optional(),
  tradeNumber: z.number().int().min(1).max(2147483647).nullable().optional(),
  account: textList.optional(),
  dateTime: z.iso.datetime({ offset: true }).nullable().optional(),
  day: nullableText(20).optional(),
  pair: nullableText(30).optional(),
  position: nullableText(20).optional(),
  netEur: z.number().finite().nullable().optional(),
  accountBalance: z.number().finite().nullable().optional(),
  rMultiple: z.number().finite().nullable().optional(),
  setup: textList.optional(),
  tfType: textList.optional(),
  algorithm: textList.optional(),
  sessionTime: textList.optional(),
  liquiditySweep: z.boolean().optional(),
  dxy: z.boolean().optional(),
  delta: z.boolean().optional(),
  fractalShift: z.boolean().optional(),
  recordedOutcome: z.enum(['win', 'loss', 'breakeven']).nullable().optional(),
  mfe30m: z.number().finite().nullable().optional(),
  mae30m: z.number().finite().nullable().optional(),
  setupQuality: nullableText(30).optional(),
  marketCondition: textList.optional(),
  entryTf: textList.optional(),
  tfAlign: textList.optional(),
  orderType: nullableText(20).optional(),
  lotSize: z.number().finite().min(0).nullable().optional(),
  pnlPercent: z.number().finite().nullable().optional(),
  learning: nullableText(4000).optional(),
  outcomeTag: nullableText(30).optional(),
  timeRecorded: z.boolean().optional(),
  exitTime: z.iso.datetime({ offset: true }).nullable().optional(),
  analysisNote: nullableText(2000).optional(),
  note: z.string().max(20000).optional(),
});

export type TradeInput = z.infer<typeof tradeInputSchema>;

function clean(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function text(value: string | null | undefined): string | null {
  const trimmed = (value || '').trim();
  return trimmed || null;
}

function value<T>(input: T | undefined, fallback: T): T {
  return input === undefined ? fallback : input;
}

type NormalizedTrade = {
  tradeId: string;
  tradeNumber: number | null;
  account: string[];
  dateTime: string | null;
  day: string | null;
  pair: string | null;
  position: string | null;
  netEur: number | null;
  accountBalance: number | null;
  rMultiple: number | null;
  setup: string[];
  tfType: string[];
  algorithm: string[];
  sessionTime: string[];
  liquiditySweep: boolean;
  dxy: boolean;
  delta: boolean;
  fractalShift: boolean;
  recordedOutcome: 'win' | 'loss' | 'breakeven' | null;
  mfe30m: number | null;
  mae30m: number | null;
  setupQuality: string | null;
  marketCondition: string[];
  entryTf: string[];
  tfAlign: string[];
  orderType: string | null;
  lotSize: number | null;
  pnlPercent: number | null;
  learning: string | null;
  outcomeTag: string | null;
  timeRecorded: boolean;
  exitTime: string | null;
  analysisNote: string | null;
};

function normalize(input: TradeInput, current?: Trade): NormalizedTrade {
  const tradeNumber = value(input.tradeNumber, current?.tradeNumber ?? null);
  const tradeId = text(value(input.tradeId, current?.tradeId ?? '')) || (tradeNumber ? String(tradeNumber) : '');
  if (!tradeId) throw new Error('Trade ID is required.');
  const account = clean(value(input.account, current?.account ?? ['Forwardtesting']));
  if (!account.length) account.push('Forwardtesting');
  return {
    tradeId,
    tradeNumber,
    account,
    dateTime: value(input.dateTime, current?.dateTime ?? null),
    day: text(value(input.day, current?.day ?? null)),
    pair: text(value(input.pair, current?.pair ?? null)),
    position: text(value(input.position, current?.position ?? null)),
    netEur: value(input.netEur, current?.netEur ?? null),
    accountBalance: value(input.accountBalance, current?.accountBalance ?? null),
    rMultiple: value(input.rMultiple, current?.rMultiple ?? null),
    setup: clean(value(input.setup, current?.setup ?? [])),
    tfType: clean(value(input.tfType, current?.tfType ?? [])),
    algorithm: clean(value(input.algorithm, current?.algorithm ?? [])),
    sessionTime: clean(value(input.sessionTime, current?.sessionTime ?? [])),
    liquiditySweep: value(input.liquiditySweep, current?.liquiditySweep ?? false),
    dxy: value(input.dxy, current?.dxy ?? false),
    delta: value(input.delta, current?.delta ?? false),
    fractalShift: value(input.fractalShift, current?.fractalShift ?? false),
    recordedOutcome: value(input.recordedOutcome, current?.recordedOutcome ?? null),
    mfe30m: value(input.mfe30m, current?.mfe30m ?? null),
    mae30m: value(input.mae30m, current?.mae30m ?? null),
    setupQuality: text(value(input.setupQuality, current?.setupQuality ?? null)),
    marketCondition: clean(value(input.marketCondition, current?.marketCondition ?? [])),
    entryTf: clean(value(input.entryTf, current?.entryTf ?? [])),
    tfAlign: clean(value(input.tfAlign, current?.tfAlign ?? [])),
    orderType: text(value(input.orderType, current?.orderType ?? null)),
    lotSize: value(input.lotSize, current?.lotSize ?? null),
    pnlPercent: value(input.pnlPercent, current?.pnlPercent ?? null),
    learning: text(value(input.learning, current?.learning ?? null)),
    outcomeTag: text(value(input.outcomeTag, current?.outcomeTag ?? null)),
    timeRecorded: value(input.timeRecorded, current?.timeRecorded ?? true),
    exitTime: value(input.exitTime, current?.exitTime ?? null),
    analysisNote: text(value(input.analysisNote, current?.analysisNote ?? null)),
  };
}

const insertSql = `INSERT INTO trades (
  id,trade_id,trade_number,account,date_time,day_label,pair,position,net_eur,account_balance,r_multiple,
  setup,tf_type,algorithm,session_time,liquidity_sweep,dxy,delta,fractal_shift,last_edited_time,
  last_seen_run,recorded_outcome,mfe_30m,mae_30m,updated_at,
  setup_quality,market_condition,entry_tf,tf_align,order_type,lot_size,pnl_percent,learning,outcome_tag,
  time_recorded,exit_time,analysis_note
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),'local',$20,$21,$22,NOW(),
  $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
RETURNING *`;

const updateSql = `UPDATE trades SET
  trade_id=$2,trade_number=$3,account=$4,date_time=$5,day_label=$6,pair=$7,position=$8,
  net_eur=$9,account_balance=$10,r_multiple=$11,setup=$12,tf_type=$13,algorithm=$14,
  session_time=$15,liquidity_sweep=$16,dxy=$17,delta=$18,fractal_shift=$19,
  last_edited_time=NOW(),recorded_outcome=$20,mfe_30m=$21,mae_30m=$22,updated_at=NOW(),
  setup_quality=$23,market_condition=$24,entry_tf=$25,tf_align=$26,order_type=$27,lot_size=$28,
  pnl_percent=$29,learning=$30,outcome_tag=$31,time_recorded=$32,exit_time=$33,analysis_note=$34
WHERE id=$1 RETURNING *`;

function values(t: NormalizedTrade): unknown[] {
  return [
    t.tradeId, t.tradeNumber, t.account, t.dateTime, t.day, t.pair, t.position,
    t.netEur, t.accountBalance, t.rMultiple, t.setup, t.tfType, t.algorithm,
    t.sessionTime, t.liquiditySweep, t.dxy, t.delta, t.fractalShift,
    t.recordedOutcome, t.mfe30m, t.mae30m,
    t.setupQuality, t.marketCondition, t.entryTf, t.tfAlign, t.orderType, t.lotSize,
    t.pnlPercent, t.learning, t.outcomeTag, t.timeRecorded, t.exitTime, t.analysisNote,
  ];
}

export async function createTrade(input: TradeInput): Promise<{ trade: Trade; pageId: string | null }> {
  await ensureSchema();
  const parsed = tradeInputSchema.parse(input);
  const client = await getPool().connect();
  let trade: Trade;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(704232)');
    let tradeNumber = parsed.tradeNumber ?? null;
    if (tradeNumber === null) {
      const next = await client.query('SELECT COALESCE(MAX(trade_number),0)+1 AS next FROM trades');
      tradeNumber = Number(next.rows[0].next);
    }
    const normalized = normalize({ ...parsed, tradeNumber }, undefined);
    const id = randomUUID();
    const result = await client.query(insertSql, [id, ...values(normalized)]);
    trade = mapTradeRow(result.rows[0]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let pageId: string | null = null;
  try {
    const page = await ensureTradePage({ id: trade.id, tradeId: trade.tradeId });
    pageId = page.id;
    const note = (input.note || '').trim();
    if (note) {
      await updatePage(page.id, {
        content: { blocks: [{ id: randomUUID(), type: 'paragraph', text: note }] },
      });
    }
  } catch (error) {
    // The trade itself is committed; the trade page can be created on first open.
    console.error('Could not create the trade notes page.', error);
  }
  return { trade, pageId };
}

export async function updateTrade(id: string, input: TradeInput): Promise<Trade | null> {
  await ensureSchema();
  const current = await getTrade(id);
  if (!current) return null;
  const parsed = tradeInputSchema.parse(input);
  const normalized = normalize(parsed, current);
  const result = await getPool().query(updateSql, [id, ...values(normalized)]);
  if (!result.rows[0]) return null;
  const updated = mapTradeRow(result.rows[0]);
  if (current.tradeId !== updated.tradeId) {
    const page = await getPool().query('SELECT id FROM pages WHERE trade_id=$1', [id]);
    if (page.rows[0]) await updatePage(page.rows[0].id, { title: `Trade #${updated.tradeId} notes` });
  }
  // Re-read so the caller also receives the trade's screenshots and every
  // column in its stored form, not just the values this PATCH touched.
  return getTrade(id);
}

export async function deleteTrade(id: string): Promise<boolean> {
  await ensureSchema();
  const assets = await getPool().query(
    'SELECT assets.storage_path FROM assets JOIN pages ON assets.page_id=pages.id WHERE pages.trade_id=$1',
    [id],
  );
  const result = await getPool().query('DELETE FROM trades WHERE id=$1', [id]);
  await Promise.all(assets.rows.map(row => deleteUpload(row.storage_path)));
  return (result.rowCount || 0) > 0;
}
