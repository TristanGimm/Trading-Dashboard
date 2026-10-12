import test from 'node:test';
import assert from 'node:assert/strict';
import { mapNotionTrade,fetchAllNotionTrades } from '../lib/notion.ts';
import type { NotionPage } from '../lib/notion.ts';
const page=(id:string):NotionPage=>({object:'page',id,last_edited_time:'2026-10-08T11:00:00.000Z',properties:{
  'Trade ID':{title:[{plain_text:id}]},
  'Net €':{number:-151.69},'Account Balance':{number:2576.83},
  'Account':{multi_select:[{name:'Forwardtesting'}]},'Setup':{multi_select:[{name:'LTF Reversal'}]},
  'DXY':{checkbox:true},'Liquidity Sweep':{checkbox:false},'Time':{date:{start:'2026-09-04T13:30:00.000+02:00'}},
}});
test('Notion mapping preserves specified money values, booleans, timezone and nulls',()=>{
 const t=mapNotionTrade(page('105'));
 assert.equal(t.netEur,-151.69);assert.equal(t.accountBalance,2576.83);assert.equal(t.tradeNumber,105);
 assert.equal(t.dateTime,'2026-09-04T11:30:00.000Z');assert.equal(t.dxy,true);assert.equal(t.liquiditySweep,false);
 assert.equal(t.rMultiple,null);
});
test('Notion pagination reads every page and passes version header; no writes',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const fake=(async (url:string|URL|Request,init?:RequestInit)=>{
  calls.push({url:String(url),init:init!});
  const body=JSON.parse(String(init?.body));
  return {ok:true,status:200,json:async()=>({object:'list',results:[page(body.start_cursor?'112':'105')],has_more:!body.start_cursor,next_cursor:body.start_cursor?null:'CURSOR-2'})} as Response;
 }) as typeof fetch;
 const t=await fetchAllNotionTrades({token:'not-a-real-key',dataSourceId:'abc',version:'2025-09-03'},fake);
 assert.deepEqual(t.map(x=>x.tradeId),['105','112']);
 assert.equal(calls.length,2);assert.equal(calls[0].init.method,'POST');
 assert.equal((calls[0].init.headers as Record<string,string>)['Notion-Version'],'2025-09-03');
 assert.equal(calls[1].url,'https://api.notion.com/v1/data_sources/abc/query');
});
test('Notion mapping refuses a local timestamp with no offset',()=>{
 const p=page('109');p.properties.Time!.date={start:'2026-09-04T10:00:00'};
 assert.throws(()=>mapNotionTrade(p),/without offset/);
});
test('mapping rejects malformed fields and impossible date-only values',()=>{
 const p=page('109');p.properties.Time!.date={start:'2026-02-30'};
 assert.throws(()=>mapNotionTrade(p),/Invalid date/);
 const bad=page('110');bad.properties['Net €'].number='wrong' as unknown as number;
 assert.throws(()=>mapNotionTrade(bad),/Malformed Notion page/);
 const huge=mapNotionTrade(page('99999999999999999999'));
 assert.equal(huge.tradeNumber,null);
});
function response(data:unknown):Response {return {ok:true,status:200,json:async()=>data} as Response;}
test('pagination refuses missing/repeated cursors, duplicate ids and malformed pages',async()=>{
 const config={token:'local-fake-token',dataSourceId:'local-fake-source'};
 const fake=(data:unknown)=>(async()=>response(data)) as typeof fetch;
 await assert.rejects(fetchAllNotionTrades(config,fake({object:'list',results:[],has_more:true,next_cursor:null})),/no next_cursor/);
 await assert.rejects(fetchAllNotionTrades(config,fake({object:'list',results:[],has_more:true,next_cursor:'same'})),/Repeated/);
 await assert.rejects(fetchAllNotionTrades(config,fake({object:'list',results:[page('1'),page('1')],has_more:false,next_cursor:null})),/Duplicate/);
 await assert.rejects(fetchAllNotionTrades(config,fake({object:'list',results:[{object:'page',id:'1'}],has_more:false,next_cursor:null})),/Malformed/);
});
test('pagination stops when has_more is false and skips archived pages',async()=>{
 let count=0;
 const archived={...page('1'),archived:true};
 const fake=(async()=>{count++;return response({object:'list',results:[archived,page('2')],has_more:false,next_cursor:'unused'});}) as typeof fetch;
 const trades=await fetchAllNotionTrades({token:'local-fake-token',dataSourceId:'local-fake-source'},fake);
 assert.equal(count,1);assert.deepEqual(trades.map(t=>t.id),['2']);
});
test('imports recorded win and the exact journal excursion fields without inventing net P&L',()=>{
 const p=page('113');p.properties['Net €']={number:null};
 p.properties.Win={multi_select:[{name:'Win'}]};
 p.properties['MFE(30 min)']={number:0.3};p.properties['MAE (30min)']={number:0};
 p.properties['TF Type']={multi_select:[{name:'5s Type 3'}]};p.properties['Fractal Shift']={checkbox:true};
 const t=mapNotionTrade(p);
 assert.equal(t.netEur,null);assert.equal(t.recordedOutcome,'win');assert.equal(t.mfe30m,0.3);assert.equal(t.mae30m,0);
 assert.deepEqual(t.tfType,['5s Type 3']);assert.equal(t.fractalShift,true);
 p.properties.Loss={multi_select:[{name:'Loss'}]};assert.equal(mapNotionTrade(p).recordedOutcome,null);
});
