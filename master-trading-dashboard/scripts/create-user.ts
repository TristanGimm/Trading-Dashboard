import { randomBytes } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { hashPassword } from '../lib/auth-crypto.ts';
import { createUser, UserExistsError } from '../lib/users.ts';
import { getPool } from '../lib/db.ts';

/**
 * Create an account from the command line.
 *
 *   npm run user:create -- --username "Tristan Gimm" --email you@example.com [--password '…']
 *
 * Without --password a 24-character password is generated and printed once.
 */

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function generated(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
  const bytes = randomBytes(24);
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
}

async function main() {
  const username = arg('username');
  const email = arg('email');
  const displayName = arg('name') || username;
  if (!username || !email) throw new Error('Usage: user:create --username "Name" --email you@example.com [--password …]');

  const password = arg('password') || generated();
  if (password.length < 12) throw new Error('The password must be at least 12 characters.');

  let user;
  try {
    user = await createUser({ username, email, displayName, password }, hashPassword);
  } catch (error) {
    if (error instanceof UserExistsError) throw new Error(error.message);
    throw error;
  }

  const lines = [
    'Trading Dashboard account',
    `  Username: ${user.username}`,
    `  Email:    ${user.email}`,
    `  Password: ${password}`,
    '',
    'Change the password on the server after the first sign-in if it was generated.',
    '',
  ].join('\n');
  console.log(lines);

  const file = process.env.CREDENTIALS_FILE || '.account-credentials.txt';
  try {
    await mkdir(path.dirname(path.resolve(file)), { recursive: true });
    await appendFile(path.resolve(file), `\n[${new Date().toISOString()}]\n${lines}`, { mode: 0o600 });
    console.log(`Saved to ${path.resolve(file)} (mode 600).`);
  } catch (error) {
    console.warn('Could not write the credentials file:', error instanceof Error ? error.message : error);
  }
  await getPool().end();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
