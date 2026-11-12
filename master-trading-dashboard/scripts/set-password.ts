import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { hashPassword } from '../lib/auth-crypto.ts';
import { findUserByLogin, setPassword } from '../lib/users.ts';
import { getPool } from '../lib/db.ts';

/**
 * Set a password for an existing account.
 *
 *   npm run user:password -- --username tristan [--password '…'] [--show]
 *
 * Bumps the session version, so every existing session is logged out.
 */

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function generate(): string {
  const words = ['Anchor', 'Atlas', 'Beacon', 'Cobalt', 'Compass', 'Cypher', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor', 'Lumen', 'Meridian', 'Nimbus', 'Onyx', 'Orbit', 'Pilot', 'Quartz', 'Ridge', 'Sable', 'Summit', 'Titan', 'Vector', 'Vertex', 'Aurora', 'Zenith'];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const digits = randomBytes(2).readUInt16BE(0) % 10000;
  return `${pick()}-${pick()}-${String(digits).padStart(4, '0')}-${randomBytes(3).toString('base64url')}`;
}

async function main() {
  const username = arg('username');
  if (!username) throw new Error('Usage: user:password --username <name> [--password …]');
  const user = await findUserByLogin(username);
  if (!user) throw new Error(`No account matches "${username}".`);
  const password = arg('password') || generate();
  if (password.length < 12) throw new Error('Use at least 12 characters.');
  await setPassword(user.id, await hashPassword(password));
  const block = `\n[${new Date().toISOString()}] password changed\n  Username: ${user.username}\n  Email:    ${user.email}\n  Password: ${password}\n`;
  const file = path.resolve(process.env.CREDENTIALS_FILE || '.account-credentials.txt');
  await appendFile(file, block, { mode: 0o600 });
  console.log(block.trim());
  console.log(`\nSaved to ${file}. All existing sessions were signed out.`);
  await getPool().end();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
