import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteHeader } from '@/components/site-header';
import './global.css';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-inter' });

const SITE_TITLE = 'Chatarooni — talk to strangers';
const SITE_DESCRIPTION =
  'Free random text chat. Meet new people and make friends from around the world.';

export const metadata: Metadata = {
  metadataBase: new URL('https://chatarooni.com'),
  title: {
    default: SITE_TITLE,
    template: '%s — Chatarooni',
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Chatarooni',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
