import { after } from 'next/server';
import { noStoreJson } from '@/lib/api-auth';
import { requireNewsAuth } from '@/lib/news/auth';
import { generateNewsEdition, NewsBusyError, NewsGenerationError } from '@/lib/news/generate';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Die Analyse konnte nicht erstellt werden.';
}

export async function POST(request: Request) {
  const denied = await requireNewsAuth(request);
  if (denied) return denied;

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    // An empty body is valid: generate today's edition.
  }

  const date = typeof body.date === 'string' ? body.date : undefined;
  const force = body.force === true;
  const wait = url.searchParams.get('wait') === '1' || body.wait === true;

  if (wait) {
    try {
      const edition = await generateNewsEdition({ date, force, trigger: 'cron' });
      return noStoreJson({ edition });
    } catch (error) {
      if (error instanceof NewsBusyError) {
        return noStoreJson({ error: error.message, busy: true }, 409);
      }
      if (error instanceof NewsGenerationError) {
        return noStoreJson({ error: error.message }, 502);
      }
      return noStoreJson({ error: messageOf(error) }, 502);
    }
  }

  after(async () => {
    try {
      await generateNewsEdition({ date, force, trigger: 'manual' });
    } catch (error) {
      // The status endpoint and the daily edition row carry the failure; the
      // background task must not reject after the response has been sent.
      if (!(error instanceof NewsBusyError)) console.error('[news] background generation failed:', messageOf(error));
    }
  });

  return noStoreJson({ accepted: true, date: date ?? null }, 202);
}
