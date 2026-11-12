import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { getPage } from '@/lib/workspace';
import { PageEditor } from '@/components/workspace/page-editor';
import { isUuid } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export default async function WorkspacePageView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/workspace/${id}`);
  if (!isUuid(id)) notFound();
  const page = await getPage(id);
  if (!page) notFound();
  if (page.kind === 'trade' && page.tradeId) redirect(`/journal/${page.tradeId}`);
  return <PageEditor page={page}/>;
}
