import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { MascotCluster } from '@/components/mascot';

export const metadata: Metadata = {
  title: 'Sign in',
  alternates: { canonical: '/login' },
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <section className="relative w-full overflow-hidden">
      <MascotCluster />
      <main className="relative z-10 mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-4 sm:px-6">
        <LoginForm />
      </main>
    </section>
  );
}
