import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { readSessionSecret, safeDashboardRedirect } from '@/lib/auth-crypto';
import { countUsers } from '@/lib/users';
import { AuthShell } from '@/components/auth/auth-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { errorMessage } from '@/lib/auth-messages';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Create account · Master Trading Dashboard' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const query = await searchParams;
  const next = safeDashboardRedirect(query.next);
  if (await currentUser()) redirect(next);

  const configured = readSessionSecret() !== null;
  const firstUser = configured && (await countUsers().catch(() => 0)) === 0;

  return <AuthShell>
    <AuthForm
      mode="register"
      next={next}
      configured={configured}
      error={errorMessage(query.error)}
      firstUser={firstUser}
    />
  </AuthShell>;
}
