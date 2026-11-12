import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { ensureSchema, getPool } from './db';

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  sessionVersion: number;
  emailVerified: boolean;
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  email_normalized: string;
  username: string;
  username_normalized: string;
  display_name: string;
  password_hash: string;
  session_version: number;
  email_verified_at: Date | null;
  created_at: Date;
};

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** Raw tokens never touch the database; only their SHA-256 digest is stored. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    sessionVersion: Number(row.session_version),
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at.toISOString(),
  };
}

const columns = 'id,email,email_normalized,username,username_normalized,display_name,password_hash,session_version,email_verified_at,created_at';

export async function countUsers(): Promise<number> {
  await ensureSchema();
  const result = await getPool().query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users');
  return Number(result.rows[0]?.n || 0);
}

export async function findUserByLogin(identifier: string): Promise<User | null> {
  await ensureSchema();
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;
  const result = await getPool().query<UserRow>(
    `SELECT ${columns} FROM users WHERE email_normalized=$1 OR username_normalized=$1`,
    [normalized],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  await ensureSchema();
  const result = await getPool().query<UserRow>(`SELECT ${columns} FROM users WHERE id=$1`, [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  await ensureSchema();
  const result = await getPool().query<UserRow>(`SELECT ${columns} FROM users WHERE email_normalized=$1`, [normalizeEmail(email)]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export type CreateUserInput = {
  email: string;
  username: string;
  displayName?: string;
  password: string;
};

export class UserExistsError extends Error {
  field: 'email' | 'username';
  constructor(field: 'email' | 'username') {
    super(field === 'email' ? 'That email address is already registered.' : 'That username is already taken.');
    this.field = field;
  }
}

export async function createUser(input: CreateUserInput, hashPassword: (password: string) => Promise<string>): Promise<User> {
  await ensureSchema();
  const email = input.email.trim();
  const username = input.username.trim();
  const passwordHash = await hashPassword(input.password);
  const pool = getPool();
  const clash = await pool.query<{ email: boolean; username: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM users WHERE email_normalized=$1) AS email, EXISTS(SELECT 1 FROM users WHERE username_normalized=$2) AS username',
    [normalizeEmail(email), normalizeUsername(username)],
  );
  if (clash.rows[0]?.email) throw new UserExistsError('email');
  if (clash.rows[0]?.username) throw new UserExistsError('username');
  const result = await pool.query<UserRow>(
    `INSERT INTO users (id,email,email_normalized,username,username_normalized,display_name,password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,
    [randomUUID(), email, normalizeEmail(email), username, normalizeUsername(username), (input.displayName || username).slice(0, 80), passwordHash],
  );
  return mapUser(result.rows[0]);
}

export async function touchLogin(id: string): Promise<void> {
  await getPool().query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [id]);
}

export async function markEmailVerified(id: string): Promise<void> {
  await getPool().query('UPDATE users SET email_verified_at=COALESCE(email_verified_at, NOW()) WHERE id=$1', [id]);
}

/** Changing the password bumps session_version, which invalidates every existing session. */
export async function setPassword(id: string, passwordHash: string): Promise<void> {
  await getPool().query(
    'UPDATE users SET password_hash=$2, session_version=session_version+1, updated_at=NOW() WHERE id=$1',
    [id, passwordHash],
  );
}

export async function createAuthToken(userId: string, kind: 'reset' | 'verify'): Promise<string> {
  await ensureSchema();
  const raw = randomBytes(32).toString('base64url');
  const ttl = kind === 'reset' ? RESET_TTL_MS : VERIFY_TTL_MS;
  const pool = getPool();
  // Only one live token per kind, so an older link stops working when a new one is requested.
  await pool.query('UPDATE auth_tokens SET used_at=NOW() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL', [userId, kind]);
  await pool.query(
    'INSERT INTO auth_tokens (id,user_id,kind,token_hash,expires_at) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), userId, kind, hashToken(raw), new Date(Date.now() + ttl)],
  );
  return raw;
}

export type ConsumedToken = { userId: string; kind: 'reset' | 'verify' } | null;

/** Single use: the row is marked used inside the same statement that reads it. */
export async function consumeAuthToken(raw: string, kind: 'reset' | 'verify'): Promise<ConsumedToken> {
  await ensureSchema();
  if (!raw || raw.length > 200) return null;
  const result = await getPool().query<{ user_id: string; kind: 'reset' | 'verify' }>(
    `UPDATE auth_tokens SET used_at=NOW()
     WHERE token_hash=$1 AND kind=$2 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id, kind`,
    [hashToken(raw), kind],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, kind: row.kind } : null;
}

export async function purgeExpiredTokens(): Promise<void> {
  await getPool().query("DELETE FROM auth_tokens WHERE expires_at < NOW() - INTERVAL '7 days'");
}
