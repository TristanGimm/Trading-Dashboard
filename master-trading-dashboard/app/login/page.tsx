import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { readSessionSecret, safeDashboardRedirect } from '@/lib/auth-crypto';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { errorMessage } from '@/lib/auth-messages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in · Master Trading Dashboard' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const query = await searchParams;
  const next = safeDashboardRedirect(query.next);
  if (await currentUser()) redirect(next);

  return <AuthShell>
    <AuthForm
      mode="signin"
      next={next}
      configured={readSessionSecret() !== null}
      error={errorMessage(query.error)}
      notice={query.reset === '1' ? 'reset' : undefined}
    />
  </AuthShell>;
}
