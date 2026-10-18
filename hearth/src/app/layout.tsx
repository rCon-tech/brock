import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Hearth: settle your room style together', template: '%s · Hearth' },
  description:
    'Swipe through rooms and furniture, and Hearth finds the style you both love, even when you disagree.',
  openGraph: {
    title: 'Hearth',
    description: 'Settle your room style together in five minutes.',
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f7f1e8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Loaded at runtime (not via next/font) so builds don't need to reach Google. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <Header />
        <main className="flex-1">
          <div className="gutter mx-auto w-full max-w-2xl pt-6 pb-16">{children}</div>
        </main>
        <footer className="no-print border-t border-sand">
          <div className="gutter mx-auto flex max-w-2xl flex-col gap-2 py-6 text-xs text-muted">
            <p>
              Some product links are affiliate links: if you buy, Hearth may earn a commission at no
              extra cost to you. It never changes what we suggest.{' '}
              <Link href="/disclosure" className="underline">
                Read more
              </Link>
            </p>
            <p className="flex gap-4">
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
              <Link href="/disclosure" className="underline">
                Affiliate disclosure
              </Link>
              <Link href="/designers" className="underline">
                For designers
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
