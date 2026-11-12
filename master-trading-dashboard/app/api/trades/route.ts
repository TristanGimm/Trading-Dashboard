import { apiError, noStoreJson, requireApiSession } from '@/lib/api-auth';
import { listTrades } from '@/lib/db';
import { createTrade } from '@/lib/trades';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const account = url.searchParams.get('account') || undefined;
    const period = url.searchParams.get('period') || undefined;
    return noStoreJson({ trades: await listTrades({ account, period }) });
  } catch (error) {
    return apiError(error, 503);
  }
}

export async function POST(request: Request) {
  const denied = await requireApiSession();
  if (denied) return denied;
  try {
    const body = await request.json();
    const result = await createTrade(body);
    return noStoreJson(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
