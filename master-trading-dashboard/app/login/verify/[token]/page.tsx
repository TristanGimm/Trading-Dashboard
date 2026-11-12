import { redirect } from 'next/navigation';
import { confirmEmail } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = new FormData();
  data.set('token', token);
  await confirmEmail(data);
  redirect('/dashboard');
}
