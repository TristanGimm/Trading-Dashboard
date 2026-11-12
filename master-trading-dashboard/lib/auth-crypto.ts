import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_COOKIE = 'trading_session';

export type AuthConfig = { username: string; passwordHash: string; secret: string };

const hashPattern = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

/** Legacy single-user credentials, still accepted as a break-glass login. */
export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const username = env.AUTH_USERNAME?.trim();
  const passwordHash = env.AUTH_PASSWORD_HASH;
  const secret = env.AUTH_SECRET;
  if (!username || username.length > 128 || !passwordHash || !hashPattern.test(passwordHash) || !secret || secret.length < 32) return null;
  return { username, passwordHash, secret };
}

/** The signing secret is required even when the database holds the users. */
export function readSessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error('Use a password between 12 and 1024 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

/** Constant-time check against a stored hash. Returns false for a malformed hash. */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || password.length > 1024) return false;
  const match = hashPattern.exec(passwordHash);
  if (!match) return false;
  const actual = await derive(password, match[1]);
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}

/**
 * Burn the same scrypt work for an unknown account so a missing user and a
 * wrong password take the same time.
 */
export async function verifyPasswordDummy(password: string): Promise<boolean> {
  await derive(password.slice(0, 1024) || 'x', '0'.repeat(32));
  return false;
}

export async function verifyCredentials(username: string, password: string, config: AuthConfig): Promise<boolean> {
  if (username.length > 128) return false;
  const valid = await verifyPassword(password, config.passwordHash);
  return username.trim().toLowerCase() === config.username.trim().toLowerCase() && valid;
}

/** Password version for the env fallback account: rotating the hash revokes its sessions. */
export function envSessionVersion(config: AuthConfig): string {
  return createHash('sha256').update(config.passwordHash).digest('hex').slice(0, 16);
}

export type SessionClaims = { sub: string; pv: string; expires: number; nonce: string };

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(sub: string, version: string, secret: string, now = Date.now()): string {
  const claims: SessionClaims = {
    sub,
    pv: version,
    expires: Math.floor(now / 1000) + SESSION_SECONDS,
    nonce: randomBytes(16).toString('hex'),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Signature and expiry only — safe for middleware, which has no database.
 * Authorisation against the user record happens in the server layer.
 */
export function readSessionClaims(token: string | undefined, secret: string | null, now = Date.now()): SessionClaims | null {
  if (!token || !secret || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null;
  const expected = Buffer.from(sign(parts[0], secret));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!data || typeof data !== 'object') return null;
    const claims = data as Partial<SessionClaims>;
    const seconds = Math.floor(now / 1000);
    if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 64) return null;
    if (typeof claims.pv !== 'string' || claims.pv.length > 64) return null;
    if (typeof claims.expires !== 'number' || !Number.isInteger(claims.expires)) return null;
    if (claims.expires <= seconds || claims.expires > seconds + SESSION_SECONDS) return null;
    if (typeof claims.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(claims.nonce)) return null;
    return claims as SessionClaims;
  } catch {
    return null;
  }
}

function isAppPath(pathname: string): boolean {
  return pathname === '/dashboard'
    || pathname === '/workspace'
    || pathname === '/strategy'
    || pathname === '/calendar'
    || pathname === '/analytics'
    || /^\/workspace\/[A-Za-z0-9-]{1,64}$/.test(pathname)
    || pathname === '/journal' || pathname === '/journal/new'
    || /^\/journal\/[A-Za-z0-9-]{1,64}(\/edit)?$/.test(pathname);
}

export function safeDashboardRedirect(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/dashboard';
  try {
    const url = new URL(value, 'https://dashboard.invalid');
    if (url.origin !== 'https://dashboard.invalid' || !isAppPath(url.pathname)) return '/dashboard';
    return url.pathname + url.search;
  } catch { return '/dashboard'; }
}

/** Only allow same-origin, absolute paths for post-login redirects. */
export function safeAuthRedirect(value: unknown): string {
  return safeDashboardRedirect(value);
}
