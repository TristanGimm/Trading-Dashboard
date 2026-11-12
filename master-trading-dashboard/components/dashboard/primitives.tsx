import type { ReactNode } from 'react';
import { Database } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

export function Brand() {
  return <div className="brand"><BrandMark size={38} className="brand-mark"/><div className="brand-name">Master Trading Dashboard</div></div>;
}

export function Panel({ title, subtitle, aside, footer, children, className }: { title: string; subtitle?: string; aside?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn('panel', className)}><div className="panel-heading"><div><h2 className="panel-title">{title}</h2>{subtitle && <p className="panel-subtitle">{subtitle}</p>}</div>{aside}</div>{children}{footer && <div className="panel-footer">{footer}</div>}</section>;
}

export function EmptyState({ title = 'No trades in this view', description = 'Try another account or a wider date range.', action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Database size={20}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function Sparkline({ values, color = '#00e676' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="mini-progress"><span style={{ background: color, width: values.length ? '8%' : '0%' }}/></div>;
  const lower = values.reduce((minimum, value) => Math.min(minimum, value), Infinity), span = values.reduce((maximum, value) => Math.max(maximum, value), -Infinity) - lower || 1;
  const points = values.map((value, index) => `${index / (values.length - 1) * 160},${23 - (value - lower) / span * 21}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 160 26" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
