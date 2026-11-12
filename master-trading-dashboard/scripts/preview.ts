import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { constants } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { hashPassword } from '../lib/auth-crypto.ts';

// This runner never loads project .env files and binds only to the loopback interface.
const ci = process.argv.includes('--ci');
const built = process.argv.includes('--built');
const temporary: string[] = [];
let server: ChildProcess | undefined;
let stopping = false;
const copyFilter = (path: string) => !basename(path).startsWith('.env') && !['.git', '.aws', '.ssh', '.codex', '.agents', '.npmrc', '.DS_Store', 'artifacts', 'uploads'].includes(basename(path));
const safeEnv = (home: string) => ({ PATH: process.env.PATH, HOME: home, TMPDIR: process.env.TMPDIR, NODE_ENV: 'production' as const, NEXT_TELEMETRY_DISABLED: '1' });
async function temporaryDirectory(prefix: string) { const path = await mkdtemp(join(tmpdir(), prefix)); temporary.push(path); return path; }

async function stop() {
  if (stopping) return;
  stopping = true;
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const timeout = setTimeout(() => server?.kill('SIGKILL'), 5000);
    await exited; clearTimeout(timeout);
  }
  for (const path of temporary.reverse()) await rm(path, { recursive: true, force: true });
}

async function main() {
  let project = process.cwd();
  if (!built) {
    project = await temporaryDirectory('gimm-preview-source-');
    console.log('Preparing an isolated preview without .env files…');
    await cp(process.cwd(), project, { recursive: true, mode: constants.COPYFILE_FICLONE, filter: path => copyFilter(path) && basename(path) !== '.next' });
    const builder = spawn(process.execPath, [join(project, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], { cwd: project, env: safeEnv(project), stdio: 'inherit' });
    const [code] = await once(builder, 'exit');
    if (code !== 0) throw new Error('Preview production build failed. Run npm ci first if dependencies are missing.');
  }
  const runtime = await temporaryDirectory('gimm-preview-runtime-');
  await cp(join(project, '.next/standalone'), runtime, { recursive: true, mode: constants.COPYFILE_FICLONE, filter: copyFilter });
  await cp(join(project, '.next/static'), join(runtime, '.next/static'), { recursive: true, mode: constants.COPYFILE_FICLONE, filter: copyFilter });
  await cp(join(project, 'public'), join(runtime, 'public'), { recursive: true, filter: copyFilter });
  const probe = createServer();
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const address = probe.address();
  if (!address || typeof address !== 'object') throw new Error('Could not allocate preview port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const username = 'preview', password = 'gimm-local-preview-only';
  server = spawn(process.execPath, ['server.js'], {
    cwd: runtime,
    env: { ...safeEnv(runtime), NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), AUTH_USERNAME: username, AUTH_PASSWORD_HASH: await hashPassword(password), AUTH_SECRET: 'only-a-local-preview-secret-not-for-real-deployment', PGHOST: '127.0.0.1', PGPORT: '1', DB_USER: 'preview-only', DB_NAME: 'preview-only', DB_PASSWORD: 'preview-only', GIMM_DEMO_MODE: 'true' },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('Preview server exited during startup');
    try { ready = (await fetch(url + '/login', { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Startup */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error('Preview server startup timed out');
  if (ci) console.log('GIMM_PREVIEW_READY ' + JSON.stringify({ url, username, password }));
  else console.log(`\nGIMM local demo: ${url}/login\nUsername: ${username}\nPassword: ${password}\n\nSynthetic trades only. No database access. Press Ctrl+C to stop.\n`);
  process.once('SIGINT', () => { void stop(); });
  process.once('SIGTERM', () => { void stop(); });
  await once(server, 'exit');
}

try { await main(); }
catch (error) { console.error(error instanceof Error ? error.message : 'Preview failed'); process.exitCode = 1; }
finally { await stop(); }
