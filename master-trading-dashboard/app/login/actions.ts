'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  createSession, hashPassword, readSessionSecret,
  safeDashboardRedirect, SESSION_COOKIE, SESSION_SECONDS,
} from '@/lib/auth-crypto';
import { loginLimiter } from '@/lib/login-limit';
import { createAuthToken, consumeAuthToken, createUser, findUserByEmail, setPassword, touchLogin, UserExistsError } from '@/lib/users';
import { mailDebugAllowed, sendMail } from '@/lib/mailer';

const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,31}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Separate buckets so a burst of sign-ups cannot lock out an existing session.
const buckets = globalThis as unknown as { __authLimiters?: Record<string, ReturnType<typeof import('@/lib/login-limit').createLoginLimiter>> };
async function limiter(name: string, limit: number, windowMs: number) {
  const { createLoginLimiter } = await import('@/lib/login-limit');
  buckets.__authLimiters ??= {};
  buckets.__authLimiters[name] ??= createLoginLimiter(limit, windowMs);
  return buckets.__authLimiters[name];
}

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  };
}

async function startSession(userId: string, version: string): Promise<void> {
  const secret = readSessionSecret();
  if (!secret) redirect('/login?error=unconfigured');
  (await cookies()).set(SESSION_COOKIE, createSession(userId, version, secret), cookieOptions(process.env.NODE_ENV === 'production'));
}

function baseUrl(): string {
  const configured = process.env.APP_URL || process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

export async function signIn(formData: FormData): Promise<void> {
  const next = safeDashboardRedirect(formData.get('next'));
  const fail = (reason: string): never => redirect(`/login?error=${reason}&next=${encodeURIComponent(next)}`);
  if (!readSessionSecret()) return fail('unconfigured');
  if (!(await limiter('login', 10, 15 * 60 * 1000)).consume()) return fail('limited');

  const identifier = formData.get('identifier');
  const password = formData.get('password');
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) return fail('missing');

  const { verifyLogin } = await import('@/lib/auth');
  let result: Awaited<ReturnType<typeof verifyLogin>> = null;
  try {
    result = await verifyLogin(identifier.slice(0, 320), password);
  } catch {
    return fail('unavailable');
  }
  if (!result) return fail('invalid');

  if (result.user.source === 'database') {
    await touchLogin(result.id).catch(() => {});
  }
  await startSession(result.id, result.version);
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signUp(formData: FormData): Promise<void> {
  const next = safeDashboardRedirect(formData.get('next'));
  const fail = (reason: string): never => redirect(`/register?error=${reason}&next=${encodeURIComponent(next)}`);
  if (!readSessionSecret()) return fail('unconfigured');
  if (!(await limiter('register', 5, 60 * 60 * 1000)).consume()) return fail('limited');

  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');

  if (!USERNAME_PATTERN.test(username)) return fail('username');
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return fail('email');
  if (password.length < 12) return fail('password');
  if (password !== confirm) return fail('mismatch');
  if (password.toLowerCase().includes(username.toLowerCase()) || password.toLowerCase().includes(email.split('@')[0].toLowerCase())) return fail('weak');

  let user;
  try {
    user = await createUser({ email, username, password }, hashPassword);
  } catch (error) {
    if (error instanceof UserExistsError) return fail(error.field === 'email' ? 'email-taken' : 'username-taken');
    return fail('unavailable');
  }

  const verifyToken = await createAuthToken(user.id, 'verify').catch(() => null);
  if (verifyToken) {
    const link = `${baseUrl()}/login/verify/${verifyToken}`;
    const result = await sendMail({
      to: user.email,
      subject: 'Confirm your Trading Dashboard email',
      text: `Welcome, ${user.displayName}.\n\nConfirm your email address:\n${link}\n\nThis link expires in 24 hours.`,
    });
    if (!result.delivered) console.warn(`Verification email not delivered (${result.transport}): ${result.reason}`);
  }

  await startSession(user.id, String(user.sessionVersion));
  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim();
  if (!(await limiter('reset', 5, 60 * 60 * 1000)).consume()) redirect('/login/reset?error=limited');
  // The answer is identical whether or not the address exists.
  if (!EMAIL_PATTERN.test(email)) redirect('/login/reset?sent=1');

  const user = await findUserByEmail(email).catch(() => null);
  if (user) {
    const token = await createAuthToken(user.id, 'reset').catch(() => null);
    if (token) {
      const link = `${baseUrl()}/login/reset/${token}`;
      const result = await sendMail({
        to: user.email,
        subject: 'Reset your Trading Dashboard password',
        text: `Hello ${user.displayName},\n\nReset your password with this link:\n${link}\n\nThe link expires in one hour and works once.\n\nIf you did not request this, ignore this email — your password stays unchanged.`,
      });
      if (!result.delivered) {
        console.warn(`Password reset email not delivered (${result.transport}): ${result.reason}`);
      }
    }
  }
  redirect('/login/reset?sent=1');
}

export async function completePasswordReset(formData: FormData): Promise<void> {
  const token = String(formData.get('token') || '');
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirm') || '');
  const fail = (reason: string): never => redirect(`/login/reset/${encodeURIComponent(token)}?error=${reason}`);
  if (!(await limiter('reset-complete', 10, 15 * 60 * 1000)).consume()) return fail('limited');
  if (password.length < 12) return fail('password');
  if (password !== confirm) return fail('mismatch');

  const consumed = await consumeAuthToken(token, 'reset').catch(() => null);
  if (!consumed) return fail('token');
  await setPassword(consumed.userId, await hashPassword(password));
  revalidatePath('/', 'layout');
  redirect('/login?reset=1');
}

export async function confirmEmail(formData: FormData): Promise<void> {
  const token = String(formData.get('token') || '');
  const consumed = await consumeAuthToken(token, 'verify').catch(() => null);
  if (!consumed) redirect('/login?error=token');
  const { markEmailVerified } = await import('@/lib/users');
  await markEmailVerified(consumed.userId);
  redirect('/dashboard?verified=1');
}
