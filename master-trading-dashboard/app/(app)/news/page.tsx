import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { dateInZone, isDateString } from '@/lib/news/dates';
import { loadNewsPage } from '@/lib/news/data';
import { Newsroom } from '@/components/news/newsroom';

export const dynamic = 'force-dynamic';

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireSession('/news');
  const query = await searchParams;
  const timeZone = getDashboardTimezone(process.env.DASHBOARD_TIMEZONE);
  const today = dateInZone(timeZone);
  const requested = query?.date;
  const selected = isDateString(requested) && requested <= today ? requested : today;
  const data = await loadNewsPage(selected, today, timeZone);
  return <Newsroom key={selected} data={data}/>;
}
