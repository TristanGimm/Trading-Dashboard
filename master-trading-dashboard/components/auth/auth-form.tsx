'use client';

import Link from 'next/link';
import { ArrowRight, Check, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { requestPasswordReset, signIn, signUp } from '@/app/login/actions';

export type AuthMode = 'signin' | 'register' | 'reset';

type Props = {
  mode: AuthMode;
  next: string;
  configured: boolean;
  error?: string;
  notice?: 'reset' | 'sent';
  firstUser?: boolean;
};

export function AuthForm({ mode, next, configured, error, notice, firstUser }: Props) {
  return <section className="auth-v3-card" aria-labelledby="auth-title">
    {mode === 'signin' && <>
      <h2 id="auth-title">There is no time left.</h2>
      {notice === 'reset' && <p className="auth-v3-note ok"><Check size={13}/>Password updated. Sign in with your new one.</p>}
      {error && <p className="auth-v3-note" role="alert">{error}</p>}
      <form action={signIn} className="auth-v3-form">
        <input type="hidden" name="next" value={next}/>
        <label className="auth-v3-field"><span>Username</span><div><UserRound size={15}/><input name="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={!configured} placeholder="Tristan Gimm"/></div></label>
        <label className="auth-v3-field"><span>Password</span><div><LockKeyhole size={15}/><input name="password" type="password" autoComplete="current-password" maxLength={1024} required disabled={!configured} placeholder="••••••••••••"/></div></label>
        <button type="submit" className="auth-v3-submit" disabled={!configured}>Sign in<ArrowRight size={15}/></button>
      </form>
      <div className="auth-v3-links">
        <Link href={`/login/reset?next=${encodeURIComponent(next)}`}>Forgot password?</Link>
        <Link href={`/register?next=${encodeURIComponent(next)}`}>Create account</Link>
      </div>
    </>}

    {mode === 'register' && <>
      <h2 id="auth-title">{firstUser ? 'Create the owner account.' : 'Create account.'}</h2>
      {error && <p className="auth-v3-note" role="alert">{error}</p>}
      <form action={signUp} className="auth-v3-form">
        <input type="hidden" name="next" value={next}/>
        <label className="auth-v3-field"><span>Username</span><div><UserRound size={15}/><input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={2} maxLength={32} required disabled={!configured} placeholder="Tristan Gimm"/></div></label>
        <label className="auth-v3-field"><span>Email</span><div><Mail size={15}/><input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={!configured} placeholder="you@example.com"/></div></label>
        <label className="auth-v3-field"><span>Password</span><div><LockKeyhole size={15}/><input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={!configured} placeholder="12+ characters"/></div></label>
        <label className="auth-v3-field"><span>Confirm password</span><div><LockKeyhole size={15}/><input name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required disabled={!configured} placeholder="Repeat"/></div></label>
        <button type="submit" className="auth-v3-submit" disabled={!configured}>Create account<ArrowRight size={15}/></button>
      </form>
      <div className="auth-v3-links">
        <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
      </div>
    </>}

    {mode === 'reset' && <>
      <h2 id="auth-title">Reset password.</h2>
      {notice === 'sent'
        ? <p className="auth-v3-note ok"><Check size={13}/>If that address is registered, a reset link is on its way.</p>
        : error && <p className="auth-v3-note" role="alert">{error}</p>}
      <form action={requestPasswordReset} className="auth-v3-form">
        <label className="auth-v3-field"><span>Email</span><div><Mail size={15}/><input name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={!configured} placeholder="you@example.com"/></div></label>
        <button type="submit" className="auth-v3-submit" disabled={!configured}>Send reset link<ArrowRight size={15}/></button>
      </form>
      <div className="auth-v3-links">
        <Link href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>
      </div>
    </>}

    {!configured && <p className="auth-v3-note" role="alert">Sign-in is not configured. Set AUTH_SECRET on the server.</p>}
  </section>;
}
