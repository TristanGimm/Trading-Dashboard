import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePerformance, filterTrades, getOutcome } from '../lib/analytics.ts';
import type { Trade } from '../lib/types.ts';
const mock=(id:string,netEur:number|null,changes:Partial<Trade>={}):Trade=>({
  id,tradeId:id,tradeNumber:Number(id),account:['Forwardtesting'],dateTime:`2026-10-0${id}T08:30:00Z`,day:'Thu',pair:'XAU/USD',position:'Long',netEur,
  accountBalance:null,rMultiple:null,setup:['LTF Reversal'],tfType:[],algorithm:['CBR'],sessionTime:['London Opening'],liquiditySweep:false,dxy:false,delta:false,fractalShift:false,lastEditedTime:null,...changes,
});
test('KPI calculations include zeros, exclude unrecorded outcomes, and respect transfer-independent P&L',()=>{
 const trades=[mock('1',100,{accountBalance:1200,dxy:true}),mock('2',-40,{accountBalance:900,dxy:false}),mock('3',0,{accountBalance:800}),mock('4',null)];
 const r=calculatePerformance(trades);
 assert.equal(r.total,4);assert.equal(r.closed,3);assert.equal(r.wins,1);assert.equal(r.losses,1);assert.equal(r.breakeven,1);
 assert.equal(r.winRate,33.33);assert.equal(r.netPnl,60);assert.equal(r.avgPnl,20);assert.equal(r.profitFactor,2.5);
 assert.equal(r.comparisons.find(c=>c.label==='DXY Confirmation · Yes')?.count,1);
 assert.equal(r.comparisons.find(c=>c.label==='DXY Confirmation · No / untagged')?.count,2);
 assert.equal(r.balance[0].value,1200);assert.equal(r.balance[2].value,800);
});
test('setup tags are counted once per trade; a trade may belong to multiple confluences',()=>{
 const a=mock('1',15,{setup:['Reversal','Reversal'],liquiditySweep:true,dxy:true,tfType:['1m Type 3']});
 const b=mock('2',-5,{setup:['Reversal']});
 const r=calculatePerformance([a,b]);
 assert.equal(r.comparisons.find(x=>x.label==='Setup · Reversal')?.count,2);
 assert.equal(r.comparisons.find(x=>x.label==='1m Type 3 Shift · Yes')?.avgPnl,15);
 assert.equal(r.comparisons.find(x=>x.label==='Liquidity Sweep · Yes')?.count,1);
});
test('daily points and chronological cumulative P&L reflect dates, regardless of input order',()=>{
 const r=calculatePerformance([mock('2',-50),mock('1',100)]);
 assert.deepEqual(r.cumulative.map(x=>x.value),[100,50]);
 assert.equal(r.maxDrawdown,50);
});
test('period/account filtering never uses missing date as within a time window',()=>{
 const ts=[mock('1',12,{dateTime:null}),mock('2',4,{account:['Backtest']}),mock('3',10,{dateTime:'2026-10-07T09:00:00Z'})];
 assert.equal(filterTrades(ts,'Forwardtesting','all').length,2);
 assert.equal(filterTrades(ts,'Forwardtesting','30d',new Date('2026-10-08')).length,1);
});
test('outcome uses recorded net including break even',()=>{
 assert.equal(getOutcome(0),'breakeven');assert.equal(getOutcome(-0.8),'loss');assert.equal(getOutcome(80),'win');
});
test('time windows reject future and invalid dates and include exact boundaries',()=>{
 const now=new Date('2026-10-08T12:00:00Z');
 const ts=[mock('1',1,{dateTime:'2099-01-01T00:00:00Z'}),mock('2',1,{dateTime:'invalid'}),mock('3',1,{dateTime:now.toISOString()}),mock('4',1,{dateTime:'2026-09-08T12:00:00Z'}),mock('5',1,{dateTime:'2026-09-08T11:59:59Z'})];
 assert.deepEqual(filterTrades(ts,'Forwardtesting','30d',now).map(t=>t.id),['3','4']);
});
test('new TF types are compared dynamically and duplicate tags count once',()=>{
 const p=calculatePerformance([mock('1',50,{tfType:['5s Type 3','5s Type 3','new type'],fractalShift:true}),mock('2',-10)]);
 assert.equal(p.comparisons.find(c=>c.label==='5s Type 3 Shift · Yes')?.count,1);
 assert.equal(p.comparisons.find(c=>c.label==='new type Shift · Yes')?.totalPnl,50);
});
