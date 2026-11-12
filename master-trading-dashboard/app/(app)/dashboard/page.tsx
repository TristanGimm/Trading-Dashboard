import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard';
import { loadDashboardData, type DashboardQuery } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

const legacy: Record<string, string> = {
  journal: '/journal',
  calendar: '/calendar',
  analytics: '/analytics',
};

export default async function OverviewPage({ searchParams }: { searchParams: Promise<DashboardQuery & { view?: string }> }) {
  const query = await searchParams;
  // Old bookmarks used /dashboard?view=…; send them to the real route.
  const target = typeof query.view === 'string' ? legacy[query.view] : undefined;
  if (target) {
    const params = new URLSearchParams();
    if (typeof query.account === 'string') params.set('account', query.account);
    if (typeof query.period === 'string') params.set('period', query.period);
    redirect(params.size ? `${target}?${params}` : target);
  }
  const { data, loadError } = await loadDashboardData('overview', query, '/dashboard');
  return <Dashboard data={data} loadError={loadError}/>;
}
