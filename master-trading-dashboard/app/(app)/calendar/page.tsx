import { Dashboard } from '@/components/dashboard';
import { loadDashboardData, type DashboardQuery } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<DashboardQuery> }) {
  const query = await searchParams;
  const { data, loadError } = await loadDashboardData('calendar', query, '/calendar');
  return <Dashboard data={data} loadError={loadError}/>;
}
