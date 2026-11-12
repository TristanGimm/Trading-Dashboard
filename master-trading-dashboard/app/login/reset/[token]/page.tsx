import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { completePasswordReset } from '../../actions';
import { VideoBackdrop } from '@/components/video-backdrop';
import { BrandMark } from '@/components/brand-mark';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New password · Trading Dashboard' };

const errors: Record<string, string> = {
  token: 'This link is invalid or has expired. Request a new one.',
  password: 'Use at least 12 characters.',
  mismatch: 'The passwords do not match.',
  limited: 'Too many attempts. Wait a few minutes.',
};

export default async function ResetPasswordPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  if (await currentUser()) redirect('/dashboard');
  const message = typeof error === 'string' ? errors[error] : undefined;

  return <div className="auth-v3">
    <div className="auth-v3-bg" aria-hidden="true"><VideoBackdrop variant="hero"/></div>
    <header className="auth-v3-header"><BrandMark size={28}/><span className="auth-v3-wordmark">Master Trading Dashboard</span></header>
    <main className="auth-v3-main">
      <div className="auth-v3-hero"><h1>Choose a<br/>new<br/><span>password.</span></h1><p>One link, one use, one hour.</p></div>
      <section className="auth-v3-card">
        <h2>New password.</h2>
        {message && <p className="auth-v3-note" role="alert">{message}</p>}
        <form action={completePasswordReset} className="auth-v3-form">
          <input type="hidden" name="token" value={token}/>
          <label className="auth-v3-field"><span>New password</span><div><LockKeyhole size={15}/><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required placeholder="12+ characters"/></div></label>
          <label className="auth-v3-field"><span>Confirm password</span><div><LockKeyhole size={15}/><input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required placeholder="Repeat"/></div></label>
          <button type="submit" className="auth-v3-submit">Save password<ArrowRight size={15}/></button>
        </form>
        <div className="auth-v3-links"><Link href="/login">Back to sign in</Link></div>
      </section>
    </main>
  </div>;
}
