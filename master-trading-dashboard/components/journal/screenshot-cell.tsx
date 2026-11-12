'use client';

import { ImagePlus } from 'lucide-react';
import type { Trade } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * The chart column. A stored screenshot is shown as a thumbnail; an empty cell
 * stays a visible invitation. Clicking either opens the trade, where ⌘V pastes
 * another screenshot.
 */
export function ScreenshotCell({ trade, onOpen }: { trade: Trade; onOpen: () => void }) {
  const shots = trade.screenshots ?? [];
  const first = shots[0];
  const count = shots.length;
  return <button
    type="button"
    className={cn('chart-cell', count ? 'has-chart' : 'is-empty')}
    onClick={onOpen}
    aria-label={count
      ? `${count} chart screenshot${count === 1 ? '' : 's'} on trade ${trade.tradeId}. Open the trade to view or paste more.`
      : `Add a chart screenshot to trade ${trade.tradeId}`}
    title={count
      ? `${count} screenshot${count === 1 ? '' : 's'} · click to open and paste more`
      : 'Click to open, then paste with ⌘V'}
  >
    {first
      ? <img src={`/api/assets/${first.id}`} alt="" loading="lazy"/>
      : <ImagePlus size={13}/>}
    {count > 1 && <span className="chart-count">{count}</span>}
  </button>;
}
