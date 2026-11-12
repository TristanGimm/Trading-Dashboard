'use client';

import { memo, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import type { Comparison, Performance, TimePerformance } from '@/lib/types';
import type { TradingDay } from '@/lib/journal';
import { drawdownPoints } from '@/lib/journal';
import { money, number, rate } from '@/lib/format';
import { EChart } from '@/components/charts/echart';
import { EquityChart } from '@/components/charts/equity-chart';
import { EmptyState, Panel } from './primitives';

export const colors = { profit: '#00e676', loss: '#ff405c', violet: '#9985ff', muted: '#69758a', grid: '#ffffff06', axis: '#778399' };
const tooltip = { backgroundColor: '#1c212d', borderColor: '#323a4b', borderWidth: 1, textStyle: { color: '#dce4ee', fontSize: 11 }, padding: [10, 13], extraCssText: 'border-radius:9px;box-shadow:0 8px 25px #0005', confine: true };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const xAxis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.axis, fontSize: 9, hideOverlap: true } };
const yAxis = { axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: colors.axis, fontSize: 9 }, splitLine: { lineStyle: { color: colors.grid, type: 'dashed' as const } } };

const EMPTY_BALANCE: Performance['balance'] = [];

export const EquityPanel = memo(function EquityPanel({ performance, balanceAvailable = true }: { performance: Performance; balanceAvailable?: boolean }) {
  const [mode, setMode] = useState<'pnl' | 'both' | 'drawdown'>('pnl');
  const drawdown = useMemo(() => drawdownPoints(performance.cumulative), [performance.cumulative]);
  const options: EChartsOption = {
    grid: { left: 54, right: 20, top: 15, bottom: 31 },
    tooltip: { trigger: 'axis', ...tooltip, valueFormatter: value => money(Number(value)) },
    xAxis: { type: 'category', data: drawdown.map(point => point.time), ...xAxis, axisLabel: { ...xAxis.axisLabel, formatter: (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }) } },
    yAxis: { type: 'value', ...yAxis },
    series: [{ type: 'line', data: drawdown.map(point => point.value), symbol: 'none', lineStyle: { color: colors.loss, width: 2 }, areaStyle: { color: '#ff405c15' } }],
  };
  return <Panel title="Equity performance" aside={<div className="segmented" aria-label="Equity chart mode">{(['pnl', 'both', 'drawdown'] as const).map(item => <button type="button" key={item} aria-pressed={mode === item} disabled={item === 'both' && !balanceAvailable} title={item === 'both' && !balanceAvailable ? 'Choose a single account to view its recorded balance' : undefined} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)}>{item === 'pnl' ? 'P&L' : item === 'both' ? 'Balance' : 'Drawdown'}</button>)}</div>} footer={<><span>{mode === 'both' ? 'Separate scales · balance includes transfers' : mode === 'drawdown' ? 'Drawdown from cumulative realized P&L' : 'Cumulative realized P&L · cash transfers excluded'}</span><span>{performance.cumulative.length} trading days</span></>}>
    <div className="panel-content" style={{ paddingBottom: 4 }}><div className={`chart-total ${mode === 'drawdown' || performance.netPnl < 0 ? 'negative' : ''}`}>{money(mode === 'drawdown' ? -performance.maxDrawdown : performance.netPnl)}</div><div className="legend"><span className="legend-item"><i className="legend-dot" style={{ color: mode === 'drawdown' ? colors.loss : colors.profit }}/>{mode === 'drawdown' ? 'Realized drawdown' : 'Net trading P&L'}</span>{mode === 'both' && <span className="legend-item"><i className="legend-dot" style={{ color: colors.violet }}/>Recorded account balance</span>}</div></div>
    <div style={{ padding: '8px 12px 8px' }}>{mode === 'drawdown' ? drawdown.length ? <EChart options={options} height={265} label="Drawdown from cumulative realized trading P&L"/> : <EmptyState/> : <EquityChart equity={performance.cumulative} balance={mode === 'both' ? performance.balance : EMPTY_BALANCE}/>}</div>
  </Panel>;
});

export const OutcomePanel = memo(function OutcomePanel({ performance: p }: { performance: Performance }) {
  const options: EChartsOption = {
    tooltip: { trigger: 'item', ...tooltip, formatter: '{b}: {c} trades ({d}%)' },
    series: [{ type: 'pie', radius: ['68%', '84%'], center: ['50%', '50%'], startAngle: 90, padAngle: 3, label: { show: false }, itemStyle: { borderRadius: 3 }, data: [{ value: p.wins, name: 'Wins', itemStyle: { color: colors.profit } }, { value: p.losses, name: 'Losses', itemStyle: { color: colors.loss } }, { value: p.breakeven, name: 'Break-even', itemStyle: { color: colors.muted } }].filter(item => item.value > 0) }],
    graphic: [{ type: 'text', left: 'center', top: '40%', style: { text: rate(p.winRate), fill: '#e5ebf1', fontSize: 28, fontWeight: 550, align: 'center' } }, { type: 'text', left: 'center', top: '58%', style: { text: 'WIN RATE', fill: '#858fa2', fontSize: 8, align: 'center' } }],
  };
  return <Panel className="outcome-panel" title="Trade outcomes"><div style={{ padding: '12px 20px 0' }}>{p.closed ? <EChart options={options} height={210} label={`${p.wins} wins, ${p.losses} losses, ${p.breakeven} break-even trades`}/> : <EmptyState title="No closed trades yet" description="Closed trades appear in this breakdown."/>}</div><div className="outcome-rows">{[{ name: 'Winning trades', count: p.wins, color: colors.profit }, { name: 'Losing trades', count: p.losses, color: colors.loss }, { name: 'Break-even trades', count: p.breakeven, color: colors.muted }].map(item => <div className="outcome-row" key={item.name}><span><i className="legend-dot" style={{ color: item.color }}/>{item.name}</span><strong>{item.count}<span style={{ display: 'inline', marginLeft: 9, fontSize: 9 }}>{p.closed ? rate(item.count / p.closed * 100) : '—'}</span></strong></div>)}</div></Panel>;
});

export const DailyPanel = memo(function DailyPanel({ days }: { days: TradingDay[] }) {
  const options: EChartsOption = {
    grid: { left: 50, right: 15, top: 18, bottom: 32 },
    tooltip: { trigger: 'axis', ...tooltip, formatter: raw => { const row = (raw as { dataIndex: number }[])[0]; const day = days[row?.dataIndex]; return day ? `${escape(day.date)}<br/><b>${money(day.pnl)}</b><br/>${day.closed} closed trades` : ''; } },
    xAxis: { type: 'category', data: days.map(day => day.date), ...xAxis, axisLabel: { ...xAxis.axisLabel, formatter: (date: string) => date.slice(5).replace('-', '/') } },
    yAxis: { type: 'value', ...yAxis },
    series: [{ type: 'bar', barMaxWidth: 15, data: days.map(day => ({ value: day.pnl, itemStyle: { color: day.pnl < 0 ? colors.loss : colors.profit, borderRadius: 3 } })) }],
  };
  return <Panel title="Daily net P&L">{days.length ? <EChart options={options} height={265} label="Realized net profit or loss by trading day"/> : <EmptyState/>}</Panel>;
});

export const TimePanel = memo(function TimePanel({ title, subtitle, items, metric = 'avgPnl' }: { title: string; subtitle: string; items: TimePerformance[]; metric?: 'avgPnl' | 'winRate' }) {
  const options: EChartsOption = {
    grid: { left: 48, right: 18, top: 24, bottom: 42 },
    tooltip: { trigger: 'axis', ...tooltip, formatter: raw => { const row = (raw as { dataIndex: number }[])[0]; const item = items[row?.dataIndex]; return item ? `<b>${escape(item.label)}</b><br/>Avg P&L: ${money(item.avgPnl)}<br/>Win rate: ${rate(item.winRate)}<br/>${item.count} trades` : ''; } },
    xAxis: { type: 'category', data: items.map(item => item.label), ...xAxis, axisLabel: { ...xAxis.axisLabel, rotate: items.length > 10 ? 45 : 0 } },
    yAxis: { type: 'value', ...yAxis, max: metric === 'winRate' ? 100 : undefined, axisLabel: { ...yAxis.axisLabel, formatter: metric === 'winRate' ? '{value}%' : '{value}' } },
    series: [{ type: 'bar', barMaxWidth: 28, data: items.map(item => ({ value: item[metric], itemStyle: { color: metric === 'winRate' ? colors.violet : item.avgPnl < 0 ? colors.loss : colors.profit, borderRadius: 4 } })) }],
  };
  return <Panel title={title} subtitle={subtitle}>{items.length ? <EChart options={options} height={265} label={title}/> : <EmptyState/>}</Panel>;
});

export const SetupPanel = memo(function SetupPanel({ comparisons }: { comparisons: Comparison[] }) {
  const [metric, setMetric] = useState<'avgPnl' | 'winRate' | 'count'>('avgPnl');
  const [group, setGroup] = useState('all');
  const [minimum, setMinimum] = useState(1);
  const items = useMemo(() => comparisons.filter(item => (group === 'all' || item.group === group) && item.count >= minimum).sort((a, b) => a[metric] - b[metric]), [comparisons, group, minimum, metric]);
  const options: EChartsOption = {
    grid: { left: 10, right: 58, top: 13, bottom: 27, containLabel: true },
    tooltip: { trigger: 'item', ...tooltip, formatter: raw => { const item = items[(raw as { dataIndex: number }).dataIndex]; return item ? `<b>${escape(item.label)}</b><br/>Avg P&L: ${money(item.avgPnl)}<br/>Win rate: ${rate(item.winRate)}<br/>${item.count} trades` : ''; } },
    xAxis: { type: 'value', ...yAxis, max: metric === 'winRate' ? 100 : undefined },
    yAxis: { type: 'category', data: items.map(item => item.label.replace('Setup · ', '').replace(' · No / untagged', ' · No*')), ...xAxis, axisLabel: { ...xAxis.axisLabel, color: '#acb5c6', overflow: 'truncate', width: 155, interval: 0 } },
    series: [{ type: 'bar', barMaxWidth: 12, data: items.map(item => ({ value: item[metric], itemStyle: { color: metric === 'avgPnl' ? item.avgPnl < 0 ? colors.loss : colors.profit : colors.violet, borderRadius: 3 } })), label: { show: true, position: 'right', fontSize: 9, color: '#a3aec0', formatter: raw => metric === 'avgPnl' ? `${number(Number(raw.value))}€` : metric === 'winRate' ? rate(Number(raw.value)) : String(raw.value) } }],
  };
  return <Panel title="Setups" footer={<span>Tags overlap. Unticked conditions may mean unrecorded. Sample size matters.</span>}><div className="panel-content" style={{ paddingBottom: 4 }}><div className="toolbar" style={{ marginBottom: 6 }}><div className="segmented">{([['avgPnl', 'Avg. P&L'], ['winRate', 'Win rate'], ['count', 'Trade count']] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={metric === id} className={metric === id ? 'selected' : ''} onClick={() => setMetric(id)}>{label}</button>)}</div><div className="toolbar-group"><select className="select-control" aria-label="Setup group" value={group} onChange={event => setGroup(event.target.value)}><option value="all">All conditions</option><option value="Setup">Setups</option><option value="Confluence">Confluences</option></select><select className="select-control" aria-label="Minimum sample size" value={minimum} onChange={event => setMinimum(Number(event.target.value))}><option value={1}>Any sample</option><option value={5}>5+ trades</option><option value={10}>10+ trades</option><option value={20}>20+ trades</option></select></div></div></div>{items.length ? <EChart options={options} height={Math.max(240, items.length * 33 + 55)} label="Performance comparison across setups and confluences"/> : <EmptyState title="No setups match these filters" description="Lower the minimum sample size or choose another group."/>}</Panel>;
});
