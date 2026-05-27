import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './global.css';

const fontSans = Inter({ subsets: ['latin'], variable: '--font-inter' });

const SITE_URL = 'https://chatarooni.com';
const SITE_TITLE = 'Chatarooni — talk to strangers';
const SITE_DESCRIPTION =
  'Free random text chat. Meet new people and make friends from around the world.';

// schema.org WebApplication — gives Google rich-result eligibility (app card,
// category, free-to-use signal). Render inline in <body> so crawlers see it.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Chatarooni',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: 'en',
  image: `${SITE_URL}/opengraph-image.png`,
  applicationCategory: 'SocialNetworkingApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            // escape '<' to its unicode form so a stray '</script>' in any
            // string field can never break out of the JSON-LD block
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
