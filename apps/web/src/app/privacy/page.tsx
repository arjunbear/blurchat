import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-6 max-w-prose text-balance text-lg text-foreground/80">
        Our privacy policy is being drafted and will be published before public
        launch.
      </p>
    </main>
  );
}
