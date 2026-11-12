import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Sidebar navigation should feel instant: keep prefetched dynamic routes in
  // the client router cache instead of refetching them on every click.
  experimental: { staleTimes: { dynamic: 60, static: 300 } },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
    ] }];
  },
};
export default config;
