'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

const CONFLUENCES = [
  { key: 'liquiditySweep', short: 'LS', label: 'Liquidity Sweep' },
  { key: 'dxy', short: 'DXY', label: 'DXY' },
  { key: 'delta', short: 'Δ', label: 'Delta' },
  { key: 'fractalShift', short: 'FS', label: 'Fractal Shift' },
] as const;

type Key = (typeof CONFLUENCES)[number]['key'];

/**
 * The four confluence flags as clickable boxes. Clicking one writes only that
 * field, so the table can be corrected without opening the trade.
 */
export function ConfluenceToggles({ trade }: { trade: Trade }) {
  const router = useRouter();
  const [state, setState] = useState<Record<Key, boolean>>(() => ({
    liquiditySweep: trade.liquiditySweep,
    dxy: trade.dxy,
    delta: trade.delta,
    fractalShift: trade.fractalShift,
  }));
  const [saving, setSaving] = useState<Key | null>(null);
  const [failed, setFailed] = useState<Key | null>(null);

  useEffect(() => {
    setState({
      liquiditySweep: trade.liquiditySweep,
      dxy: trade.dxy,
      delta: trade.delta,
      fractalShift: trade.fractalShift,
    });
  }, [trade.id, trade.liquiditySweep, trade.dxy, trade.delta, trade.fractalShift]);

  const toggle = async (key: Key) => {
    if (saving) return;
    const next = !state[key];
    setState(previous => ({ ...previous, [key]: next }));
    setSaving(key);
    setFailed(null);
    try {
      const response = await fetch(`/api/trades/${trade.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!response.ok) throw new Error('Could not save the confluence.');
      router.refresh();
    } catch {
      setState(previous => ({ ...previous, [key]: !next }));
      setFailed(key);
    } finally {
      setSaving(null);
    }
  };

  return <span className="confluence-cell">
    {CONFLUENCES.map(item => <button
      key={item.key}
      type="button"
      className={cn('confluence-box', state[item.key] && 'is-on', failed === item.key && 'is-failed')}
      aria-pressed={state[item.key]}
      aria-label={`${item.label} for trade #${trade.tradeId}`}
      title={item.label}
      onClick={() => void toggle(item.key)}
    >
      <span className="confluence-box-label">{saving === item.key ? <Loader2 size={8} className="animate-spin"/> : item.short}</span>
      {state[item.key] && saving !== item.key && <Check className="confluence-box-check" size={7} strokeWidth={3.5}/>}
    </button>)}
  </span>;
}
