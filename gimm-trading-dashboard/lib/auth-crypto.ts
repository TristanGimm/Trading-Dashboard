import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Long-lived personal-device login. Credential or secret rotation still revokes sessions.
export const SESSION_SECONDS = 10 * 365 * 24 * 60 * 60;
export const SESSION_COOKIE = 'gimm_session';
export type AuthConfig = { username: string; passwordHash: string; secret: string };
const hashPattern = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const username = env.AUTH_USERNAME?.trim();
  const passwordHash = env.AUTH_PASSWORD_HASH;
  const secret = env.AUTH_SECRET;
  if (!username || username.length > 128 || !passwordHash || !hashPattern.test(passwordHash) || !secret || secret.length < 32) return null;
  return { username, passwordHash, secret };
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

export async function verifyCredentials(username: string, password: string, config: AuthConfig): Promise<boolean> {
  if (!password || password.length > 1024 || username.length > 128) return false;
  const match = hashPattern.exec(config.passwordHash);
  if (!match) return false;
  // Derive even for an unknown username, keeping the expensive work identical.
  const actual = await derive(password, match[1]);
  const validPassword = timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
  return username === config.username && validPassword;
}

function signature(payload: string, config: AuthConfig): string {
  // Credential rotation invalidates existing sessions as well as a secret rotation.
  return createHmac('sha256', config.secret).update(JSON.stringify([payload, config.username, config.passwordHash])).digest('base64url');
}

export function createSession(config: AuthConfig, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ expires: Math.floor(now / 1000) + SESSION_SECONDS, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${signature(payload, config)}`;
}

export function verifySession(token: string | undefined, config: AuthConfig | null, now = Date.now()): boolean {
  if (!token || !config || token.length > 512) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return false;
  const expected = Buffer.from(signature(parts[0], config));
  const actual = Buffer.from(parts[1]);
  if (!timingSafeEqual(expected, actual)) return false;
  try {
    const data: unknown = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!data || typeof data !== 'object' || !('expires' in data) || !('nonce' in data)) return false;
    const seconds = Math.floor(now / 1000);
    return typeof data.expires === 'number' && Number.isInteger(data.expires) && data.expires > seconds && data.expires <= seconds + SESSION_SECONDS && typeof data.nonce === 'string' && /^[a-f0-9]{32}$/.test(data.nonce);
  } catch { return false; }
}

export function safeDashboardRedirect(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/dashboard') || /[\\\r\n]/.test(value)) return '/dashboard';
  try {
    const url = new URL(value, 'https://dashboard.invalid');
    return url.origin === 'https://dashboard.invalid' && url.pathname === '/dashboard' ? url.pathname + url.search : '/dashboard';
  } catch { return '/dashboard'; }
}
