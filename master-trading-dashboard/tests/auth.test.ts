import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, envSessionVersion, hashPassword, readAuthConfig, readSessionClaims, readSessionSecret, safeDashboardRedirect, SESSION_SECONDS, verifyCredentials, verifyPassword } from '../lib/auth-crypto.ts';
import { createLoginLimiter } from '../lib/login-limit.ts';

const password = 'only-a-local-test-password';
const config = { username: 'local-test-user', passwordHash: await hashPassword(password), secret: 'local-test-secret-with-more-than-32-characters' };

const secret = 'session-signing-secret-for-tests-only';

test('authentication is disabled without complete valid configuration', () => {
  assert.equal(readAuthConfig({}), null);
  assert.equal(readAuthConfig({ AUTH_USERNAME: config.username, AUTH_PASSWORD_HASH: password, AUTH_SECRET: config.secret }), null);
  assert.equal(readAuthConfig({ AUTH_USERNAME: config.username, AUTH_PASSWORD_HASH: config.passwordHash, AUTH_SECRET: 'short' }), null);
  assert.deepEqual(readAuthConfig({ AUTH_USERNAME: config.username, AUTH_PASSWORD_HASH: config.passwordHash, AUTH_SECRET: config.secret }), config);
  assert.equal(readSessionClaims('anything', null), null);
});

test('scrypt verifies a correct password and rejects incorrect credentials', async () => {
  assert.equal(await verifyCredentials(config.username, password, config), true);
  assert.equal(await verifyCredentials(config.username, 'incorrect-password', config), false);
  assert.equal(await verifyCredentials('other-user', password, config), false);
  assert.equal(await verifyCredentials(config.username, 'x'.repeat(1025), config), false);
  assert.equal(await verifyCredentials(config.username, password, { ...config, passwordHash: 'invalid' }), false);
  await assert.rejects(hashPassword('short'));
});

test('sessions reject tampering, expiry, malformed cookies and a rotated version', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  const version = envSessionVersion(config);
  const token = createSession(config.username, version, secret, now);
  assert.equal(readSessionClaims(token, secret, now)?.sub, config.username);
  assert.equal(readSessionClaims(token, secret, now + SESSION_SECONDS * 1000 - 1)?.sub, config.username);
  assert.equal(readSessionClaims(token, secret, now + SESSION_SECONDS * 1000), null);
  const [payload, signature] = token.split('.');
  assert.equal(readSessionClaims(`${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`, secret, now), null);
  const forged = Buffer.from(JSON.stringify({ sub: 'x', pv: '1', expires: 9999999999, nonce: 'a'.repeat(32) })).toString('base64url');
  assert.equal(readSessionClaims(`${forged}.${signature}`, secret, now), null);
  for (const bad of [undefined, '', 'a.b.c', 'a.', 'x'.repeat(513)]) assert.equal(readSessionClaims(bad, secret, now), null);
  assert.equal(readSessionClaims(token, 'different-signing-secret-for-tests'), null);
  assert.notEqual(version, envSessionVersion({ ...config, passwordHash: config.passwordHash.replace('scrypt$', 'scrypt$0') }));
  assert.notEqual(token, createSession(config.username, version, secret, now));
});

test('password verification rejects malformed hashes and empty input', async () => {
  const hash = await hashPassword('another-local-test-password');
  assert.equal(await verifyPassword('another-local-test-password', hash), true);
  assert.equal(await verifyPassword('wrong-password-here', hash), false);
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('session signing requires a configured secret of sufficient length', () => {
  assert.equal(readSessionSecret({}), null);
  assert.equal(readSessionSecret({ AUTH_SECRET: 'short' }), null);
  assert.equal(readSessionSecret({ AUTH_SECRET: secret }), secret);
});

test('redirects preserve dashboard filters and reject external or unexpected destinations', () => {
  assert.equal(safeDashboardRedirect('/dashboard?period=30d&account=Backtest'), '/dashboard?period=30d&account=Backtest');
  assert.equal(safeDashboardRedirect('/workspace/123?tab=notes'), '/workspace/123?tab=notes');
  assert.equal(safeDashboardRedirect('/journal/new'), '/journal/new');
  for (const bad of ['https://evil.example', '//evil.example', '/dashboard/../login', '/dashboard/other', '/dashboard\\evil', '/dashboard\n', '/login', '/dashboard-evil', '/workspace-evil', null, ['wrong']]) assert.equal(safeDashboardRedirect(bad), '/dashboard');
});

test('login attempts are bounded and become available after the window', () => {
  const limiter = createLoginLimiter(2, 1000);
  assert.equal(limiter.consume(2000), true);
  assert.equal(limiter.consume(2001), true);
  assert.equal(limiter.consume(2002), false);
  assert.equal(limiter.consume(2999), false);
  assert.equal(limiter.consume(3000), true);
});
