import { noStoreJson, apiError } from '@/lib/api-auth';
import { requireNewsAuth } from '@/lib/news/auth';
import { getNewsEdition } from '@/lib/news/data';
import { dateInZone, isDateString } from '@/lib/news/dates';
import { getDashboardTimezone } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireNewsAuth(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
    const requested = url.searchParams.get('date');
    const date = isDateString(requested) ? requested : dateInZone(timeZone);
    const edition = await getNewsEdition(date);
    if (!edition) return noStoreJson({ edition: null });
    return noStoreJson({
      edition: {
        date: edition.date,
        status: edition.status,
        generatedAt: edition.generatedAt,
        startedAt: edition.startedAt,
        model: edition.model,
        sourceCount: edition.sourceCount,
        error: edition.error,
      },
    });
  } catch (error) {
    return apiError(error, 503);
  }
}
