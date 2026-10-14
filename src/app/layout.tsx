import type { Metadata, Viewport } from 'next';
import { HandDefs } from '@/components/Hands';
import { Header } from '@/components/Header';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Brock: one rock paper scissors a day', template: '%s · Brock' },
  description:
    'Brock once a day. Win and your streak grows. Lose and it resets. How long can you last?',
  openGraph: {
    title: 'Brock',
    description: 'One rock paper scissors a day. How long can your streak last?',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#5f7a26' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Loaded at runtime (not via next/font) so builds don't need to reach Google. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Arvo:wght@400;700&family=Josefin+Sans:wght@600;700&display=swap"
        />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <HandDefs />
        <Header />
        <main className="stage flex-1">
          <div className="gutter mx-auto flex w-full max-w-2xl flex-col items-center gap-6 pt-6 pb-12">
            {children}
          </div>
        </main>
        <footer className="border-t-4 border-ink bg-rust">
          <p className="gutter mx-auto max-w-2xl py-2.5 text-center font-slab text-xs tracking-[0.18em] [font-variant:small-caps]">
            One throw a day · Win and your streak grows · Miss a day and it’s gone
          </p>
        </footer>
      </body>
    </html>
  );
}
