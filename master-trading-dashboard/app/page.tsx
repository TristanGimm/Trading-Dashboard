import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, LogIn, UserPlus } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { BrandMark } from '@/components/brand-mark';
import { VideoBackdrop } from '@/components/video-backdrop';
import { ProductSwitcher } from '@/components/product-switcher';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Master Trading Dashboard' };

export default async function LandingPage() {
  // A signed-in visitor goes straight to the workspace; this page is for
  // people who are not in yet.
  if (await currentUser()) redirect('/dashboard');

  return <div className="landing">
    <div className="landing-scene" aria-hidden="true">
      <VideoBackdrop variant="hero"/>
    </div>

    <header className="landing-header">
      <div className="landing-brand-group">
        <Link href="/" className="landing-brand" aria-label="Master Trading Dashboard home">
          <BrandMark size={30}/>
          <span>Master Trading Dashboard</span>
        </Link>
        <ProductSwitcher/>
      </div>
      <nav className="landing-auth" aria-label="Account">
        <Link href="/login" className="landing-auth-link">
          <LogIn size={14}/>Sign in
        </Link>
        <Link href="/register" className="landing-auth-cta">
          <UserPlus size={14}/>Sign up
        </Link>
      </nav>
    </header>

    <main className="landing-main">
      <h1 className="landing-company">Tenaxcore</h1>
      <p className="landing-tagline">Join the <span>Revolution</span>.</p>
      <Link href="/login" className="landing-cta">
        Become The Change<ArrowRight size={16}/>
      </Link>
    </main>
  </div>;
}
