import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { VideoBackdrop } from '@/components/video-backdrop';
import { ProductSwitcher } from '@/components/product-switcher';

/**
 * The shared frame for the sign-in, register and reset screens: the planet, the
 * brand in the corner, and a centred card.
 */
export function AuthShell({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <div className="auth-v3">
    <div className="auth-v3-bg" aria-hidden="true">
      <VideoBackdrop variant="hero"/>
      {/* The video is bright in places, so the text column and the card each get
          their own scrim instead of one flat wash over the whole frame. */}
      <div className="auth-v3-scrim"/>
    </div>

    <header className="auth-v3-header">
      <Link href="/" className="auth-v3-brand" aria-label="Master Trading Dashboard home">
        <BrandMark size={28}/>
        <span className="auth-v3-wordmark">Master Trading Dashboard</span>
      </Link>
      <ProductSwitcher/>
    </header>

    <main className={compact ? 'auth-v3-main auth-v3-main-single' : 'auth-v3-main'}>
      {!compact && <div className="auth-v3-hero">
        <h1>Master Trading <span>Dashboard</span></h1>
        <p className="auth-v3-tagline">Highly individualised Trading Dashboard</p>
      </div>}
      {children}
    </main>
  </div>;
}
