import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { hashPassword } from '../lib/auth-crypto.ts';

// Exercise the actual production server without inheriting credentials or .env files.
const directory = await mkdtemp(join(tmpdir(), 'gimm-auth-smoke-'));
const password = 'local-smoke-test-password';
const passwordHash = await hashPassword(password);
const copyFilter = (source: string) => !basename(source).startsWith('.env');

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

function actionName(html: string): string {
  const match = /name="(\$ACTION_ID_[^"]+)"/.exec(html);
  assert.ok(match, 'Expected a progressively enhanced Server Action form');
  return match[1];
}

async function scenario(configured: boolean, demo = false) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port),
      GIMM_DEMO_MODE: demo ? 'true' : 'false',
      PGHOST: '127.0.0.1', PGPORT: '1', DB_USER: 'local-test-only', DB_NAME: 'local-test-only', DB_PASSWORD: 'local-test-only',
      ...(configured ? { AUTH_USERNAME: 'local-smoke-user', AUTH_PASSWORD_HASH: passwordHash, AUTH_SECRET: 'only-a-local-smoke-secret-with-more-than-32-characters' } : {}),
    },
    stdio: 'ignore',
  });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (child.exitCode !== null) throw new Error('Production server exited before becoming ready');
      try { ready = (await fetch(`${base}/login`, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Startup */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Production server startup timed out');
    const request = (path: string, init: RequestInit = {}) => fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(10000), ...init });
    const protectedPage = await request('/dashboard?period=30d');
    assert.equal(protectedPage.status, 307);
    const loginDestination = new URL(protectedPage.headers.get('location') || '', base);
    assert.equal(loginDestination.pathname, '/login');
    assert.equal(loginDestination.searchParams.get('next'), '/dashboard?period=30d');
    const rscRequest = await request('/dashboard?view=journal', { headers: { RSC: '1', 'Next-Router-Prefetch': '1' } });
    assert.equal(rscRequest.status, 307);
    assert.equal(new URL(rscRequest.headers.get('location') || '', base).pathname, '/login');
    // "/" is the public landing page: it must render, not redirect, and it must
    // not expose a form or any workspace data.
    const root = await request('/');
    assert.equal(root.status, 200);
    const rootHtml = await root.text();
    assert.match(rootHtml, /Tenaxcore/);
    assert.match(rootHtml, /Join the <span>Revolution<\/span>\./);
    assert.match(rootHtml, /Become The Change/);
    assert.match(rootHtml, /Navigation/);
    assert.doesNotMatch(rootHtml, /type="password"/);
    assert.match(rootHtml, /href="\/login"/);
    assert.match(rootHtml, /href="\/register"/);
    const registerPage = await request('/register');
    assert.equal(registerPage.status, 200);
    assert.match(await registerPage.text(), /Create account/);
    const loginPage = await request('/login');
    assert.equal(loginPage.status, 200);
    assert.equal(loginPage.headers.get('x-frame-options'), 'DENY');
    const html = await loginPage.text();
    assert.match(html, /There is no time left/);
    const action = actionName(html);
    const submit = (pass: string, next = '/dashboard?period=30d', origin = base) => {
      const body = new FormData();
      body.set(action, ''); body.set('identifier', 'local-smoke-user'); body.set('password', pass); body.set('next', next);
      return request('/login', { method: 'POST', body, headers: { Origin: origin } });
    };
    if (!configured) {
      assert.match(html, /Sign-in is not configured/);
      const rejected = await submit(password);
      assert.match(rejected.headers.get('location') || '', /error=unconfigured/);
      assert.equal(rejected.headers.get('set-cookie'), null);
      console.log('PASS: missing configuration keeps dashboard and login locked');
      return;
    }
    const wrong = await submit('wrong-password');
    assert.equal(wrong.status, 303);
    assert.match(wrong.headers.get('location') || '', /error=invalid/);
    assert.equal(wrong.headers.get('set-cookie'), null);
    const crossOrigin = await submit(password, '/dashboard', 'https://untrusted.invalid');
    assert.equal(crossOrigin.headers.get('set-cookie'), null);
    assert.ok(crossOrigin.status >= 400, 'Cross-origin login must be rejected');
    const accepted = await submit(password);
    assert.equal(accepted.status, 303);
    assert.equal(accepted.headers.get('location'), '/dashboard?period=30d');
    const setCookie = accepted.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /Secure/i); assert.match(setCookie, /SameSite=lax/i);
    const cookie = setCookie.split(';')[0];
    const dashboard = await request('/dashboard?period=30d', { headers: { Cookie: cookie } });
    assert.equal(dashboard.status, 200);
    const dashboardHtml = await dashboard.text();
    assert.match(dashboardHtml, /Trading Dashboard/);
    if (demo) {
      assert.match(dashboardHtml, /synthetic sample trades/);
      for (const [path, title] of [['/journal', 'Every trade. Every lesson.'], ['/calendar', 'Build a better trading rhythm.'], ['/analytics', 'Understand your edge.']]) {
        const response = await request(path, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200); assert.ok((await response.text()).includes(title));
      }
    } else assert.match(dashboardHtml, /Trading data is currently unavailable/);
    const tampered = await request('/dashboard', { headers: { Cookie: 'trading_session=invalid.cookie' } });
    assert.equal(tampered.status, 307);
    const alreadyLoggedIn = await request('/login', { headers: { Cookie: cookie } });
    assert.equal(alreadyLoggedIn.headers.get('location'), '/dashboard');
    const logoutBody = new FormData(); logoutBody.set(actionName(dashboardHtml), '');
    const loggedOut = await request('/dashboard', { method: 'POST', body: logoutBody, headers: { Origin: base, Cookie: cookie } });
    assert.equal(loggedOut.status, 303); assert.equal(loggedOut.headers.get('location'), '/login');
    assert.match(loggedOut.headers.get('set-cookie') || '', /trading_session=;/);
    const external = await submit(password, '//untrusted.invalid');
    assert.equal(external.headers.get('location'), '/dashboard');
    for (let i = 0; i < 10; i++) await submit('wrong-password');
    const limited = await submit(password);
    assert.match(limited.headers.get('location') || '', /error=limited/);
    assert.equal(limited.headers.get('set-cookie'), null);
    const health = await request('/api/health');
    assert.equal(health.status, 503);
    console.log(demo ? 'PASS: authenticated demo overview, journal, calendar and analytics' : 'PASS: production login, cookies, redirects, protected data, CSRF, logout, rate limit and unavailable DB');
  } finally {
    if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); }
  }
}

try {
  await cp(resolve('.next/standalone'), directory, { recursive: true, filter: copyFilter });
  await cp(resolve('.next/static'), join(directory, '.next/static'), { recursive: true, filter: copyFilter });
  await cp(resolve('public'), join(directory, 'public'), { recursive: true, filter: copyFilter });
  await scenario(false);
  await scenario(true);
  await scenario(true, true);
} finally { await rm(directory, { recursive: true, force: true }); }
