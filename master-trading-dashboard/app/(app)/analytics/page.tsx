import { Dashboard } from '@/components/dashboard';
import { loadDashboardData, type DashboardQuery } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const query = await searchParams;
  const { data, loadError } = await loadDashboardData('analytics', query, '/analytics');
  return <Dashboard data={data} loadError={loadError}/>;
}
