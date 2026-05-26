import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Terms of Service
      </h1>
      <p className="mt-6 max-w-prose text-balance text-lg text-foreground/80">
        Our terms of service are being drafted and will be published before
        public launch.
      </p>
    </main>
  );
}
