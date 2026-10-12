import test from 'node:test';
import assert from 'node:assert/strict';
import { executionStats, recordedOutcome } from '../lib/execution.ts';
import { calculatePerformance } from '../lib/analytics.ts';
import type { Trade } from '../lib/types.ts';
const trade=(changes:Partial<Trade>):Trade=>({id:'113',tradeId:'113',tradeNumber:113,account:[],dateTime:null,day:null,pair:null,position:null,netEur:null,rMultiple:null,accountBalance:null,setup:[],tfType:['5s Type 3'],algorithm:[],sessionTime:[],fractalShift:true,dxy:false,delta:false,liquiditySweep:false,lastEditedTime:null,...changes});
test('tagged wins count in confluence outcomes while missing euro amounts stay out of P&L',()=>{
 const trades=[trade({recordedOutcome:'win',mfe30m:0,mae30m:2}),trade({recordedOutcome:'win',mfe30m:4}),trade({netEur:-10,recordedOutcome:'win',mae30m:0})];
 const stats=executionStats(trades);
 assert.deepEqual(stats.mfe,{count:2,average:2});assert.deepEqual(stats.mae,{count:2,average:1});
 const row=stats.conditions.find(r=>r.label==='Fractal Shift · Yes')!;
 assert.equal(row.count,3);assert.equal(row.wins,2);assert.equal(row.missing,2);
 assert.equal(recordedOutcome(trades[2]),'loss');assert.equal(calculatePerformance(trades).netPnl,-10);
 assert.deepEqual(executionStats([]).mfe,{count:0,average:null});
});
