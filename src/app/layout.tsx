import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Denarixx Vision AI — AI Perception Platform',
  description:
    'Assistive AI perception platform for blind and visually impaired users. Phase 1 MVP.',
  manifest: '/manifest.json',
  keywords: ['assistive technology', 'blind', 'visually impaired', 'AI', 'perception'],
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white min-h-screen`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-yellow-400 focus:text-black focus:px-3 focus:py-1 focus:rounded"
        >
          Skip to main content
        </a>
        <nav
          className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40"
          aria-label="Main navigation"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <Link
              href="/"
              className="text-xl font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
              aria-label="Denarixx Vision AI — home"
            >
              Denarixx Vision AI
            </Link>
            <div className="flex gap-1 flex-wrap text-sm" role="navigation" aria-label="Site links">
              {[
                ['/v2-demo', '✦ V2 Guardian'],
                ['/session', 'Session'],
                ['/hazards', 'Hazards'],
                ['/memory', 'Memory'],
                ['/navigation', 'Navigation'],
                ['/settings', 'Settings'],
                ['/privacy', 'Privacy'],
                ['/admin', 'Admin'],
                ['/docs', 'Docs'],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1.5 rounded text-gray-300 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="border-t border-gray-800 mt-16 py-6 text-center text-gray-500 text-xs">
          <p>
            Denarixx Vision AI — Phase 1 MVP — Assistive support only. Not medically
            certified. Always use your own judgement.
          </p>
        </footer>
      </body>
    </html>
  );
}
