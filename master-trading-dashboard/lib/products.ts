/**
 * The three products this workspace belongs to.
 *
 * `href` is the deployed address; `localPort` is where the app runs during
 * development. The header links resolve to the local ports whenever the page is
 * served from localhost, so the three can be tested against each other without
 * touching the deployed instances.
 *
 * Links point at the app entry, not the marketing root: a signed-in visitor is
 * taken straight to the dashboard, and a visitor without a session there is
 * sent to that product's sign-in. `path` is the same route on the local port.
 */
export type Product = {
  key: 'dashboard' | 'quant' | 'copier';
  name: string;
  short: string;
  href: string;
  localPort: number;
  path: string;
};

export const PRODUCTS: Product[] = [
  {
    key: 'dashboard',
    name: 'Master Trading Dashboard',
    short: 'Dashboard',
    href: 'https://dashboard.gimmholding.com/dashboard',
    localPort: 3000,
    path: '/dashboard',
  },
  {
    key: 'quant',
    name: 'Quant Engine',
    short: 'Quant Engine',
    // The Quant Engine has no separate app path: its root is the dashboard for
    // a signed-in session and the landing page otherwise.
    href: 'https://quant-engine.gimmholding.com/',
    localPort: 8100,
    path: '/',
  },
  {
    key: 'copier',
    name: 'Trade Copier Engine',
    short: 'Trade Copier',
    href: 'https://copier-engine.gimmholding.com/app',
    localPort: 8200,
    path: '/app',
  },
];

export const CURRENT_PRODUCT: Product['key'] = 'dashboard';

/** True when the page is being served from this machine. */
export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
}

/** The address to use for a product from the current origin. */
export function productHref(product: Product, hostname: string): string {
  if (!isLocalHost(hostname)) return product.href;
  // Keep the scheme the page was opened with; https on a local port would fail.
  const scheme = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
  return `${scheme}://${hostname}:${product.localPort}${product.path}`;
}
