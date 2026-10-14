import type { Metadata, Viewport } from 'next';
import { Header } from '@/components/Header';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Brock — one rock paper scissors a day', template: '%s · Brock' },
  description:
    'Brock once a day. Win and your streak grows. Lose and it resets. How long can you last?',
  openGraph: {
    title: 'Brock',
    description: 'One rock paper scissors a day. How long can your streak last?',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0f1115' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Header />
        <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
