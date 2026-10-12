'use client';
import type { Trade } from '@/lib/types';
import { executionStats } from '@/lib/execution';
import { number, rate } from '@/lib/format';
import { Panel } from './primitives';
import { EChart } from '@/components/charts/echart';

export function ExecutionAnalytics({ trades, onTrade }: { trades: Trade[]; onTrade: (trade: Trade) => void }) {
  const stats = executionStats(trades);
  const measured = trades.filter(t=>t.mfe30m!=null||t.mae30m!=null);
  const paired = measured.filter(t=>t.mfe30m!=null&&t.mae30m!=null);
  return <>
    <Panel title="Recorded confluence outcomes" subtitle="Net € determines the outcome when available; otherwise the Notion Win / Loss tag is used." footer={<span>Wins without Net € appear here. Financial metrics require an actual net amount. Conditions overlap; unchecked may mean unrecorded.</span>}>
      <div className="trade-table-scroll" style={{maxHeight:360,overflow:'auto'}}><table className="trade-table"><thead><tr><th>Condition</th><th>Outcomes</th><th>Wins</th><th>Win rate</th><th>Missing Net €</th></tr></thead><tbody>{stats.conditions.map(row=><tr key={row.label}><td>{row.label}</td><td>{row.count}</td><td>{row.wins}</td><td>{row.winRate==null?'—':rate(row.winRate)}</td><td>{row.missing}</td></tr>)}</tbody></table></div>
    </Panel>
    <Panel title="MFE & MAE · 30 minutes" subtitle="Maximum favorable / adverse excursion from your Notion fields. Values retain the units entered in your journal." footer={<span>Missing measurements are excluded separately from each average. Zero is included. {paired.length} trades have both measurements.</span>}>
      <div className="panel-content"><div className="two-column"><div><p className="panel-subtitle">Average MFE · {stats.mfe.count} measurements</p><strong>{stats.mfe.average==null?'—':number(stats.mfe.average)}</strong></div><div><p className="panel-subtitle">Average MAE · {stats.mae.count} measurements</p><strong>{stats.mae.average==null?'—':number(stats.mae.average)}</strong></div></div></div>
      {paired.length>0&&<EChart height={280} label="MFE versus MAE for trades with both 30 minute measurements" options={{tooltip:{trigger:'item',formatter:raw=>{const t=paired[(raw as {dataIndex:number}).dataIndex];return `Trade #${t.tradeNumber??'—'}<br/>MAE: ${number(t.mae30m!)}<br/>MFE: ${number(t.mfe30m!)}`;}},grid:{left:60,right:30,bottom:55,top:20},xAxis:{type:'value',name:'MAE (30 min)',nameLocation:'middle',nameGap:30},yAxis:{type:'value',name:'MFE (30 min)'},series:[{type:'scatter',symbolSize:10,itemStyle:{color:'#9985ff'},data:paired.map(t=>[t.mae30m!,t.mfe30m!])}]}}/>}
      <div className="trade-table-scroll" style={{maxHeight:360,overflow:'auto'}}><table className="trade-table"><thead><tr><th>Trade</th><th>MFE (30 min)</th><th>MAE (30 min)</th></tr></thead><tbody>{[...measured].sort((a,b)=>(b.dateTime??'').localeCompare(a.dateTime??'')).map(t=><tr key={t.id}><td><button className="button button-link" onClick={()=>onTrade(t)}>#{t.tradeId}</button></td><td>{t.mfe30m==null?'—':number(t.mfe30m)}</td><td>{t.mae30m==null?'—':number(t.mae30m)}</td></tr>)}</tbody></table>{!measured.length&&<p className="panel-content">Enter MFE(30 min) and MAE (30min) in Notion to see measurements here.</p>}</div>
    </Panel>
  </>;
}
