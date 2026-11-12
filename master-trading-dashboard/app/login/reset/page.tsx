import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { readSessionSecret, safeDashboardRedirect } from '@/lib/auth-crypto';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { errorMessage } from '@/lib/auth-messages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset password · Master Trading Dashboard' };

export default async function ResetRequestPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; sent?: string }> }) {
  const query = await searchParams;
  const next = safeDashboardRedirect(query.next);
  if (await currentUser()) redirect(next);

  return <AuthShell>
    <AuthForm
      mode="reset"
      next={next}
      configured={readSessionSecret() !== null}
      error={errorMessage(query.error)}
      notice={query.sent === '1' ? 'sent' : undefined}
    />
  </AuthShell>;
}
