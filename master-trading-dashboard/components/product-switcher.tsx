'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CURRENT_PRODUCT, PRODUCTS, productHref } from '@/lib/products';
import { cn } from '@/lib/utils';

/**
 * The "Navigation" button beside the brand.
 *
 * Opens a list of the three products on hover or click. Links resolve to the
 * local ports when the page is served from localhost, so the three apps can be
 * tested against each other without touching the deployed instances; on the
 * real domains they point at production.
 */
export function ProductSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false);
  // Resolved after mount: the server has no window, and rendering a different
  // href on the server than the client would break hydration.
  const [hostname, setHostname] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setHostname(window.location.hostname); }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // A pointer that can hover opens the menu before the click lands; without
  // this flag the click would immediately close what the hover just opened.
  const openedByHover = useRef(false);

  const hoverOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (!open) {
      openedByHover.current = true;
      setOpen(true);
    }
  };
  const hoverClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openedByHover.current = false;
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  const toggle = () => {
    if (openedByHover.current) {
      openedByHover.current = false;
      return;
    }
    setOpen(!open);
  };

  return <div
    className="nav-switch"
    ref={box}
    onMouseEnter={hoverOpen}
    onMouseLeave={hoverClose}
  >
    <button
      type="button"
      className={cn('nav-switch-button', variant === 'light' && 'is-light', open && 'is-open')}
      aria-expanded={open}
      aria-controls="navigation-menu"
      aria-haspopup="true"
      onClick={toggle}
    >
      Navigation
      <ChevronDown size={13} className={cn('nav-switch-chevron', open && 'is-open')}/>
    </button>
    {open && <div className="nav-switch-menu" id="navigation-menu" role="menu" aria-label="Products">
      {PRODUCTS.map(product => product.key === CURRENT_PRODUCT
        ? <span key={product.key} className="nav-switch-item current" aria-current="page">
            <Check size={13}/>{product.name}
          </span>
        : <a
            key={product.key}
            className="nav-switch-item"
            role="menuitem"
            href={hostname ? productHref(product, hostname) : product.href}
          >
            <span className="nav-switch-dot" aria-hidden="true"/>{product.name}
          </a>)}
    </div>}
  </div>;
}
