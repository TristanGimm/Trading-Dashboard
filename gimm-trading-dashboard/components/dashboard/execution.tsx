'use client';
import type { Trade } from '@/lib/types';
import { executionStats, recordedOutcome } from '@/lib/execution';
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
    <Panel title="MFE & MAE · 30 minutes" subtitle="How far did price move for you — and against you?" footer={<span>Values use your journal units · 30-minute window · missing values excluded, zeros included.</span>}>
      <div className="excursion-summary">
        <div><span className="eyebrow">Favorable movement</span><strong className="positive">{stats.mfe.average==null?'—':number(stats.mfe.average)}</strong><p>Average MFE <span>· {stats.mfe.count} trades</span></p></div>
        <div><span className="eyebrow">Adverse movement</span><strong className="negative">{stats.mae.average==null?'—':number(stats.mae.average)}</strong><p>Average MAE <span>· {stats.mae.count} trades</span></p></div>
        <div><span className="eyebrow">Measurement coverage</span><strong>{paired.length}<small> / {trades.length}</small></strong><p>Trades with both values <span>· selected filters</span></p></div>
      </div>
      <div className="excursion-chart-heading"><div><h3>Trade excursion map</h3><p>Higher = more favorable movement. Further right = more adverse movement.</p></div><div className="legend"><span className="legend-item"><i className="legend-dot positive"/>Win</span><span className="legend-item"><i className="legend-dot negative"/>Loss</span><span className="legend-item"><i className="legend-dot" style={{color:'#9985ff'}}/>Other / unrecorded</span></div></div>
      {paired.length>0 ? <EChart height={340} label="MFE versus MAE for trades with both 30 minute measurements" options={{
        tooltip:{trigger:'item',backgroundColor:'#1c212d',borderColor:'#323a4b',textStyle:{color:'#dce4ee'},padding:14,confine:true,formatter:raw=>{const t=paired[(raw as {dataIndex:number}).dataIndex];return `Trade #${t.tradeNumber??'—'} · ${recordedOutcome(t)??'unrecorded'}<br/>Favorable (MFE): <b>${number(t.mfe30m!)}</b><br/>Adverse (MAE): <b>${number(t.mae30m!)}</b>`;}},
        grid:{left:55,right:32,bottom:65,top:25},
        xAxis:{type:'value',name:'Adverse movement · MAE →',nameLocation:'middle',nameGap:36,boundaryGap:['8%','12%'],axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#778399',fontSize:10},nameTextStyle:{color:'#778399',fontSize:11},splitLine:{lineStyle:{color:'#ffffff06',type:'dashed'}}},
        yAxis:{type:'value',name:'Favorable movement · MFE ↑',nameLocation:'middle',nameGap:38,nameTextStyle:{color:'#778399',fontSize:11},boundaryGap:['8%','15%'],axisLine:{show:false},axisTick:{show:false},axisLabel:{color:'#778399',fontSize:10},splitLine:{lineStyle:{color:'#ffffff06',type:'dashed'}}},
        series:[{type:'scatter',symbolSize:14,emphasis:{scale:1.5},data:paired.map(t=>({value:[t.mae30m!,t.mfe30m!],itemStyle:{color:recordedOutcome(t)==='win'?'#00e676':recordedOutcome(t)==='loss'?'#ff405c':'#9985ff',opacity:0.85,borderColor:'#9985ff',borderWidth:1}}))}]
      }}/> : <p className="panel-content">Record both MFE and MAE in Notion to build your excursion map.</p>}
      <p className="excursion-context">{paired.length < 20 ? 'Early sample — review individual trades as you build more history.' : 'Explore individual points to compare favorable movement and adverse movement.'} Hover over a point for its trade and measurements.</p>
      <details className="excursion-details"><summary>Review measurements <span>{measured.length} trades</span></summary>
        <div className="trade-table-scroll" style={{maxHeight:320,overflow:'auto'}}><table className="trade-table"><thead><tr><th>Trade</th><th>MFE · favorable</th><th>MAE · adverse</th></tr></thead><tbody>{[...measured].sort((a,b)=>(b.dateTime??'').localeCompare(a.dateTime??'')).map(t=><tr key={t.id}><td><button className="button button-link" onClick={()=>onTrade(t)}>#{t.tradeId}</button></td><td className="positive">{t.mfe30m==null?'—':number(t.mfe30m)}</td><td className="negative">{t.mae30m==null?'—':number(t.mae30m)}</td></tr>)}</tbody></table></div>
      </details>
    </Panel>
  </>;
}
