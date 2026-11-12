import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  envSessionVersion, readAuthConfig, readSessionClaims, readSessionSecret,
  safeDashboardRedirect, SESSION_COOKIE, verifyCredentials,
} from './auth-crypto';
import { findUserById, type User } from './users';

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  source: 'database' | 'env';
};

const ENV_USER_ID = 'env';

function toSessionUser(user: User): SessionUser {
  return { id: user.id, username: user.username, displayName: user.displayName, email: user.email, source: 'database' };
}

function envSessionUser(): SessionUser | null {
  const config = readAuthConfig();
  if (!config) return null;
  return { id: ENV_USER_ID, username: config.username, displayName: config.username, email: null, source: 'env' };
}

/**
 * Resolve the signed cookie to a real account. Signature and expiry are checked
 * first, then the user is loaded and its session version compared, so a password
 * change logs every other device out.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const secret = readSessionSecret();
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = readSessionClaims(token, secret);
  if (!claims) return null;
  if (claims.sub === ENV_USER_ID) {
    const config = readAuthConfig();
    if (!config) return null;
    return claims.pv === envSessionVersion(config) ? envSessionUser() : null;
  }
  try {
    const user = await findUserById(claims.sub);
    if (!user || String(user.sessionVersion) !== claims.pv) return null;
    return toSessionUser(user);
  } catch {
    // A database outage must not turn into an authenticated session.
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await currentUser()) !== null;
}

export async function requireSession(returnTo = '/dashboard'): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeDashboardRedirect(returnTo))}`);
  return user;
}

/** Whether any login method is configured at all; used by the login page. */
export function loginConfigured(): boolean {
  return readSessionSecret() !== null;
}

export async function verifyLogin(identifier: string, password: string): Promise<{ id: string; version: string; user: SessionUser } | null> {
  const { findUserByLogin } = await import('./users');
  const { verifyPassword, verifyPasswordDummy } = await import('./auth-crypto');
  let user: Awaited<ReturnType<typeof findUserByLogin>> = null;
  let dbFailed = false;
  try {
    user = await findUserByLogin(identifier);
  } catch {
    dbFailed = true;
  }
  if (user) {
    const ok = await verifyPassword(password, user.passwordHash);
    return ok ? { id: user.id, version: String(user.sessionVersion), user: toSessionUser(user) } : null;
  }

  // Break-glass: the env account works even when the database is unreachable,
  // so a failed migration or outage cannot lock the owner out.
  const config = readAuthConfig();
  if (config) {
    const ok = await verifyCredentials(identifier, password, config);
    if (ok) {
      const session = envSessionUser()!;
      return { id: ENV_USER_ID, version: envSessionVersion(config), user: session };
    }
    await verifyPasswordDummy(password);
    return null;
  }

  if (dbFailed) throw new Error('The user database is unavailable.');
  await verifyPasswordDummy(password);
  return null;
}
