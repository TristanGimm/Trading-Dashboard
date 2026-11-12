'use client';

import { useEffect, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import type { ECharts } from 'echarts/core';

export function EChart({ options, height = 280, label }: { options: EChartsOption; height?: number; label: string }) {
  const element = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const latestOptions = useRef(options);
  const updateChart = useRef<(() => void) | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  latestOptions.current = options;

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const recolor = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(recolor);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, recolor(item)]));
      if (document.documentElement.dataset.theme !== 'light' || typeof value !== 'string') return value;
      const palette: Record<string, string> = { '#00e676': '#008f48', '#ff405c': '#dc183a', '#ffffff06': '#25234912', '#e5ebf1': '#202139', '#778399': '#60677d', '#acb5c6': '#60677d', '#a3aec0': '#60677d', '#1c212d': '#ffffff', '#dce4ee': '#202139', '#323a4b': '#d9dced' };
      return palette[value] ?? value;
    };
    const apply = (config: EChartsOption) => ({ ...(recolor(config) as EChartsOption), animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, aria: { enabled: true } });
    const repaint = () => chart.current?.setOption(apply(latestOptions.current), { notMerge: true });
    updateChart.current = repaint;
    window.addEventListener('gimm-theme-change', repaint);
    (async () => {
      const echarts = await import('@/lib/echarts');
      if (disposed || !element.current) return;
      chart.current = echarts.init(element.current, undefined, { renderer: 'canvas' });
      chart.current.setOption(apply(latestOptions.current), { notMerge: true });
      observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => chart.current?.resize()); });
      observer.observe(element.current);
      setState('ready');
    })().catch(() => { if (!disposed) setState('error'); });
    return () => { updateChart.current = null; window.removeEventListener('gimm-theme-change', repaint); disposed = true; observer?.disconnect(); cancelAnimationFrame(frame); chart.current?.dispose(); chart.current = null; };
  }, []);

  useEffect(() => {
    updateChart.current?.();
  }, [options]);

  return <div style={{ height, position: 'relative', minWidth: 0 }} role="img" aria-label={label} aria-busy={state === 'loading'}>
    <div ref={element} style={{ height: '100%', width: '100%' }}/>
    {state === 'loading' && <div className="chart-skeleton" aria-hidden="true"/>}
    {state === 'error' && <p className="absolute inset-0 grid place-items-center text-xs text-slate-400">Chart unavailable. Your metrics and journal remain available.</p>}
  </div>;
}
