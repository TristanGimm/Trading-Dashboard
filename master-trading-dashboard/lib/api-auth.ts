import { NextResponse } from 'next/server';
import { isAuthenticated } from './auth';

/** API routes must return 401 rather than redirecting a fetch() to the login HTML. */
export async function requireApiSession(): Promise<NextResponse | null> {
  if (await isAuthenticated()) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}

export function apiError(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : 'Request failed.';
  return NextResponse.json({ error: message.slice(0, 500) }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}
