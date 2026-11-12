import { useId } from 'react';

/**
 * The one mark used everywhere: browser tab (`app/icon.svg`), sidebar, sign-in
 * header. Keeping it in a single component means the favicon and the UI can
 * never drift apart.
 */
export function BrandMark({ size = 38, className }: { size?: number; className?: string }) {
  const id = useId();
  return <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role="img"
    aria-label="Master Trading Dashboard"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7660d5"/>
        <stop offset="1" stopColor="#354e99"/>
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx={size >= 34 ? 18 : 16} fill={`url(#${id}-bg)`}/>
    <path d="M17 45V34M29 45V25M41 45V17" fill="none" stroke="#eeeaff" strokeWidth="6" strokeLinecap="round"/>
    <path d="m16 24 12-10" fill="none" stroke="#eeeaff" strokeWidth="3" strokeLinecap="round"/>
  </svg>;
}
