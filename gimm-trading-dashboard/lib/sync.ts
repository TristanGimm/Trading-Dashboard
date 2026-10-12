import { randomUUID } from 'node:crypto';
import { getPool, initSchema } from './db';
import { fetchAllNotionTrades } from './notion';
import type { Trade } from './types';

export async function syncNotion(fetcher:typeof fetch=fetch) {
  const token=process.env.NOTION_TOKEN||'';
  const dataSourceId=process.env.NOTION_DATA_SOURCE_ID||'';
  const notion=await fetchAllNotionTrades({token,dataSourceId,version:process.env.NOTION_VERSION},fetcher);
  await initSchema();
  const pool=getPool();const client=await pool.connect();const run=randomUUID();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(704231)');
    const existing=Number((await client.query('SELECT COUNT(*)::int AS n FROM trades')).rows[0].n);
    // Never erase a large dataset because an API permission change looks like mass deletion.
    const deleteMissing=notion.length>0 && (existing===0||notion.length>=Math.ceil(existing*0.6));
    for(const t of notion){
      await client.query(`INSERT INTO trades (
        id,trade_id,trade_number,account,date_time,day_label,pair,position,net_eur,account_balance,r_multiple,
        setup,tf_type,algorithm,session_time,liquidity_sweep,dxy,delta,fractal_shift,last_edited_time,last_seen_run,recorded_outcome,mfe_30m,mae_30m
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      ON CONFLICT(id) DO UPDATE SET
        trade_id=EXCLUDED.trade_id,trade_number=EXCLUDED.trade_number,account=EXCLUDED.account,
        date_time=EXCLUDED.date_time,day_label=EXCLUDED.day_label,pair=EXCLUDED.pair,
        position=EXCLUDED.position,net_eur=EXCLUDED.net_eur,account_balance=EXCLUDED.account_balance,
        r_multiple=EXCLUDED.r_multiple,setup=EXCLUDED.setup,tf_type=EXCLUDED.tf_type,
        algorithm=EXCLUDED.algorithm,session_time=EXCLUDED.session_time,
        liquidity_sweep=EXCLUDED.liquidity_sweep,dxy=EXCLUDED.dxy,delta=EXCLUDED.delta,
        fractal_shift=EXCLUDED.fractal_shift,last_edited_time=EXCLUDED.last_edited_time,
        recorded_outcome=EXCLUDED.recorded_outcome,mfe_30m=EXCLUDED.mfe_30m,mae_30m=EXCLUDED.mae_30m,
        last_seen_run=EXCLUDED.last_seen_run,synced_at=NOW()`,
      [t.id,t.tradeId,t.tradeNumber,t.account,t.dateTime,t.day,t.pair,t.position,t.netEur,t.accountBalance,t.rMultiple,
        t.setup,t.tfType,t.algorithm,t.sessionTime,t.liquiditySweep,t.dxy,t.delta,t.fractalShift,t.lastEditedTime,run,t.recordedOutcome??null,t.mfe30m??null,t.mae30m??null]);
    }
    if(deleteMissing)await client.query('DELETE FROM trades WHERE last_seen_run<>$1',[run]);
    await client.query('UPDATE sync_status SET last_synced_at=NOW(),last_error=$1,last_count=$2,state=$3 WHERE id=1',
      [deleteMissing?null:'Deletion safety check: sync returned too few items; stale rows retained',notion.length,deleteMissing?'ok':'warning']);
    await client.query('COMMIT');
    return {received:notion.length,previous:existing,removedStale:deleteMissing};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
export async function markSyncError(error:unknown){
  try{await initSchema();await getPool().query('UPDATE sync_status SET state=$1,last_error=$2 WHERE id=1',['error',String(error).slice(0,900)]);}catch(err){console.error('Could not store sync error',err);}
}
