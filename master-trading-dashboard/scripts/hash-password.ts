import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../lib/auth-crypto.ts';

if (!process.stdin.isTTY) throw new Error('Run this command in a terminal. The password is requested without echo.');
let muted = false;
const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: true });
function question(label: string): Promise<string> {
  process.stdout.write(label);
  muted = true;
  return new Promise(resolve => prompt.question('', answer => { muted = false; process.stdout.write('\n'); resolve(answer); }));
}
try {
  const password = await question('Password (12+ characters): ');
  const confirmation = await question('Confirm password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  console.log(`AUTH_PASSWORD_HASH='${await hashPassword(password)}'`);
} finally { muted = false; prompt.close(); }
