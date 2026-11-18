import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextResponse } from 'next/server';
import { requireApiSession } from '../api-auth.ts';

function sameSecret(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * The scheduler and the browser both call the briefing endpoint, but they do
 * not share a credential: a session cookie works for the UI, a bearer token
 * for the Kubernetes CronJob. Without NEWS_CRON_TOKEN the bearer path is
 * disabled rather than accepting an empty string.
 */
export async function requireNewsAuth(request: Request): Promise<NextResponse | null> {
  const expected = process.env.NEWS_CRON_TOKEN?.trim();
  const header = request.headers.get('authorization') || '';
  if (expected && header.toLowerCase().startsWith('bearer ')) {
    const provided = header.slice(7).trim();
    if (provided && sameSecret(provided, expected)) return null;
  }
  return requireApiSession();
}
