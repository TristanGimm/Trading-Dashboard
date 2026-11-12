import { requireSession } from '@/lib/auth';
import { getDashboardTimezone } from '@/lib/timezone';
import { listPageSummaries } from '@/lib/workspace';
import type { WorkspacePageSummary } from '@/lib/workspace-types';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

/**
 * The shell lives in a layout so the sidebar and topbar survive navigation.
 * There is deliberately no <Suspense> around it: a boundary here would replace
 * the entire shell with its fallback whenever a child suspended, which is what
 * made every navigation blank the page for a moment.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const demo = process.env.GIMM_DEMO_MODE === 'true' && process.env.PGHOST === '127.0.0.1' && process.env.PGPORT === '1';
  let pages: WorkspacePageSummary[] = [];
  if (!demo) {
    try {
      pages = await listPageSummaries('page');
    } catch {
      // A database outage must not take the whole shell down; the page body reports it.
      pages = [];
    }
  }
  return <AppShell pages={pages} demo={demo} timeZone={getDashboardTimezone(process.env.DASHBOARD_TIMEZONE)}>{children}</AppShell>;
}
