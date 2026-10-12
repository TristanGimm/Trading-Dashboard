import type { BalancePoint, Comparison, Performance, TimePerformance, Trade } from './types';

export function round2(n:number):number {return Math.round((n+Number.EPSILON)*100)/100;}
export function getOutcome(net:number):'win'|'loss'|'breakeven' {return net>0?'win':net<0?'loss':'breakeven';}

export function filterTrades(trades:Trade[],account='Forwardtesting',period='all',now=new Date()):Trade[]{
  const allowedPeriod=new Set(['all','30d','90d','365d']);
  const days:Record<string,number>={'30d':30,'90d':90,'365d':365};
  const start=allowedPeriod.has(period)&&period!=='all'?now.getTime()-days[period]*86400000:undefined;
  return trades.filter(t=>{
    if(account!=='all'&&!t.account.includes(account))return false;
    if(start!==undefined){
      const timestamp=t.dateTime?Date.parse(t.dateTime):NaN;
      if(!Number.isFinite(timestamp)||timestamp<start||timestamp>now.getTime())return false;
    }
    return true;
  });
}
function groupTime(iso:string,timeZone:string){
  const d=new Date(iso);
  if(!Number.isFinite(d.getTime()))return null;
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'});
  const parts=Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,x.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:parts.hour,weekday:parts.weekday};
}
function createBucket(){return{count:0,wins:0,sum:0};}
type Bucket=ReturnType<typeof createBucket>;
function record(map:Map<string,Bucket>,label:string,net:number){
  const a=map.get(label)||createBucket();a.count++;a.sum+=net;if(net>0)a.wins++;map.set(label,a);
}
function read(map:Map<string,Bucket>,labels?:string[]):TimePerformance[]{
  const keys=labels||[...map.keys()];
  return keys.filter(k=>map.has(k)).map(label=>{
    const a=map.get(label)!;return{label,count:a.count,wins:a.wins,winRate:round2(a.wins/a.count*100),avgPnl:round2(a.sum/a.count)};
  });
}

export function calculatePerformance(trades:Trade[],timeZone='Europe/Berlin'):Performance{
  const closed=trades.filter((t):t is Trade & {netEur:number}=>t.netEur!==null&&Number.isFinite(t.netEur));
  const sorted=[...closed].sort((a,b)=>{
    const ta=a.dateTime?new Date(a.dateTime).getTime():Infinity;
    const tb=b.dateTime?new Date(b.dateTime).getTime():Infinity;
    return ta-tb||(a.tradeNumber??0)-(b.tradeNumber??0);
  });
  let pnl=0,profit=0,loss=0,wins=0,losses=0,even=0,best:number|null=null,worst:number|null=null;
  let equity=0,peak=0,maxDrawdown=0,maxDrawdownPct:number|null=null;
  const rs:number[]=[];
  const cumulativeByDay=new Map<string,number>();const balanceByDay=new Map<string,number>();
  const setup=new Map<string,Bucket>(),session=new Map<string,Bucket>(),weekday=new Map<string,Bucket>(),hour=new Map<string,Bucket>(),month=new Map<string,Bucket>();
  function addConfluence(label:string,flag:boolean,net:number){record(setup,`${label} · ${flag?'Yes':'No / untagged'}`,net);}
  const tfTypes=new Set(['1m Type 3','5s Type 3',...trades.flatMap(trade=>trade.tfType)]);
  for(const t of sorted){
    const n=t.netEur;pnl+=n;best=best===null? n:Math.max(best,n);worst=worst===null?n:Math.min(worst,n);
    if(n>0){wins++;profit+=n;}else if(n<0){losses++;loss-=n;}else even++;
    if(t.rMultiple!==null&&Number.isFinite(t.rMultiple))rs.push(t.rMultiple);
    equity+=n;peak=Math.max(peak,equity);const drawdown=peak-equity;maxDrawdown=Math.max(maxDrawdown,drawdown);
    if(peak>0){const pct=drawdown/peak*100;maxDrawdownPct=Math.max(maxDrawdownPct??0,pct);}
    for(const item of new Set(t.setup))record(setup,`Setup · ${item}`,n);
    for(const item of new Set(t.sessionTime))record(session,item,n);
    addConfluence('Liquidity Sweep',t.liquiditySweep,n);
    addConfluence('DXY Confirmation',t.dxy,n);
    for(const tf of tfTypes)addConfluence(`${tf} Shift`,t.tfType.includes(tf),n);
    addConfluence('Fractal Shift',t.fractalShift,n);
    addConfluence('Delta',t.delta,n);
    const parts=t.dateTime?groupTime(t.dateTime,timeZone):null;
    if(parts){record(weekday,parts.weekday,n);record(hour,`${parts.hour}:00`,n);record(month,parts.date.slice(0,7),n);cumulativeByDay.set(parts.date,round2(equity));}
    else if(t.day)record(weekday,({Mon:'Mon',Tues:'Tue',Wed:'Wed',Thurs:'Thu',Fri:'Fri'} as Record<string,string>)[t.day]||t.day,n);
  }
  // Account balance is a recorded account value, not the result of summing trades; it may include transfers.
  // Include rows without a Net € value if a balance was entered.
  for(const t of [...trades].sort((a,b)=>(a.dateTime?Date.parse(a.dateTime):0)-(b.dateTime?Date.parse(b.dateTime):0))){
    const parts=t.dateTime?groupTime(t.dateTime,timeZone):null;
    if(parts&&t.accountBalance!==null)balanceByDay.set(parts.date,round2(t.accountBalance));
  }
  const comparisons:Comparison[]=[...setup].map(([label,b])=>({
    label,group:label.startsWith('Setup ·')?'Setup' as const:'Confluence' as const,
    count:b.count,wins:b.wins,avgPnl:round2(b.sum/b.count),totalPnl:round2(b.sum),winRate:round2(b.wins/b.count*100),
  })).sort((a,b)=>b.avgPnl-a.avgPnl);
  const points=(m:Map<string,number>):BalancePoint[]=>[...m].sort(([a],[b])=>a.localeCompare(b)).map(([time,value])=>({time,value}));
  return {
    total:trades.length,closed:closed.length,wins,losses,breakeven:even,
    winRate:closed.length?round2(wins/closed.length*100):0,
    netPnl:round2(pnl),avgPnl:closed.length?round2(pnl/closed.length):0,
    grossProfit:round2(profit),grossLoss:round2(loss),profitFactor:loss>0?round2(profit/loss):null,
    avgR:rs.length?round2(rs.reduce((a,b)=>a+b,0)/rs.length):null,
    bestTrade:best===null?null:round2(best),worstTrade:worst===null?null:round2(worst),
    maxDrawdown:round2(maxDrawdown),maxDrawdownPct:maxDrawdownPct===null?null:round2(maxDrawdownPct),
    cumulative:points(cumulativeByDay),balance:points(balanceByDay),comparisons,
    sessions:read(session).sort((a,b)=>b.avgPnl-a.avgPnl),
    weekdays:read(weekday,['Mon','Tue','Wed','Thu','Fri','Sat','Sun']),
    hours:read(hour).sort((a,b)=>a.label.localeCompare(b.label)),
    monthly:read(month).sort((a,b)=>a.label.localeCompare(b.label)),
  };
}
