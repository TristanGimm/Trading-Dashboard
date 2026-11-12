import { cn } from '@/lib/utils';

/**
 * Colour vocabulary for the journal lives in `lib/tags.ts`; the tag components
 * themselves are in `./tags.tsx`. This module keeps the P&L ring.
 */

/**
 * Realised result as a ring. The ring fills clockwise and reaches a full
 * circle at 100 % of the reference move, then a second ring starts for the
 * overflow. Colour follows the sign, so a loss is always red.
 */
export function PnlRing({
  percent,
  size = 34,
  label,
}: {
  percent: number | null | undefined;
  size?: number;
  /** Shown inside instead of the value when the number is missing. */
  label?: string;
}) {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return <span className="pnl-ring empty" style={{ width: size, height: size }} aria-label="No result recorded">—</span>;
  }

  const negative = percent < 0;
  const magnitude = Math.abs(percent);
  const stroke = Math.max(2.5, size * 0.105);
  const outer = size / 2 - stroke / 2;
  const inner = Math.max(1.5, outer - stroke * 1.7);
  const rings = magnitude > 100 ? 2 : 1;
  const outerFraction = magnitude > 100 ? 1 : magnitude / 100;
  const innerFraction = magnitude > 100 ? Math.min(1, (magnitude - 100) / 100) : 0;
  const circumference = (radius: number) => 2 * Math.PI * radius;

  const ring = (radius: number, fraction: number, opacity: number) => {
    const length = circumference(radius) * fraction;
    return <circle
      className="ring-value"
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeDasharray={`${length} ${circumference(radius)}`}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      style={{ opacity }}
    />;
  };

  const tone = negative ? 'negative' : percent === 0 ? 'flat' : 'positive';
  const display = percent === 0 ? '0' : Math.abs(percent) >= 100 ? String(Math.round(percent)) : (Math.abs(percent) >= 10 ? percent.toFixed(1) : percent.toFixed(2));

  return <span
    className={cn('pnl-ring', tone, rings === 2 && 'is-two-ring')}
    title={`${percent > 0 ? '+' : ''}${percent}% — ${rings === 2 ? 'more than one full ring' : `${Math.round(magnitude)}% of a full ring`}`}
  >
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Realized ${percent} percent`}>
      <circle cx={size / 2} cy={size / 2} r={outer} fill="none" strokeWidth={stroke} className="ring-track"/>
      {ring(outer, outerFraction, 1)}
      {rings === 2 && <>
        <circle cx={size / 2} cy={size / 2} r={inner} fill="none" strokeWidth={stroke * 0.8} className="ring-track"/>
        {ring(inner, innerFraction, 0.85)}
      </>}
    </svg>
    <span className="pnl-ring-label">{display}</span>
  </span>;
}
