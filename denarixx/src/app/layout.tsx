import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { PWASetup } from '@/components/PWASetup';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Denarixx Vision AI — AI Perception Platform',
  description:
    'Assistive AI perception platform for blind and visually impaired users. Real-time hazard detection, scene understanding and audio guidance.',
  manifest: '/manifest.json',
  keywords: ['assistive technology', 'blind', 'visually impaired', 'AI', 'perception', 'PWA'],
  appleWebApp: {
    capable: true,
    title: 'Denarixx',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#030712',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  maximumScale: 5,
};

const NAV_LINKS = [
  ['/session', 'Session'],
  ['/vision', 'Vision AI'],
  ['/pilot', 'Pilot'],
  ['/field-trials', 'Field Trials'],
  ['/devices', 'Devices'],
  ['/guardian', 'Guardian'],
  ['/reasoning', 'Reasoning'],
  ['/hazards', 'Hazards'],
  ['/memory', 'Memory'],
  ['/navigation', 'Navigation'],
  ['/performance', 'Performance'],
  ['/settings', 'Settings'],
  ['/privacy', 'Privacy'],
  ['/admin', 'Admin'],
  ['/docs', 'Docs'],
] as const;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white min-h-screen`}
      >
        <PWASetup />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-yellow-400 focus:text-black focus:px-3 focus:py-1 focus:rounded"
        >
          Skip to main content
        </a>
        <nav
          className="border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm sticky top-0 z-40"
          aria-label="Main navigation"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <Link
              href="/"
              className="text-xl font-black text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded hover:text-yellow-300 transition-colors"
              aria-label="Denarixx Vision AI — home"
            >
              Denarixx Vision AI
            </Link>
            <div className="flex gap-0.5 flex-wrap text-sm" role="list">
              {NAV_LINKS.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  role="listitem"
                  className={`px-3 py-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-colors ${
                    label === 'Guardian' ? 'text-purple-400 hover:text-purple-300' : ''
                  }`}
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
        <footer className="border-t border-gray-800 mt-16 py-8">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-yellow-400 font-bold text-sm">Denarixx Vision AI</p>
            <p className="text-gray-600 text-xs text-center">
              Phase 1 MVP · Simulation mode · Assistive support only · Not medically certified
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="text-gray-600 hover:text-gray-400 transition-colors">Privacy</Link>
              <Link href="/docs" className="text-gray-600 hover:text-gray-400 transition-colors">Docs</Link>
              <Link href="/admin" className="text-gray-600 hover:text-gray-400 transition-colors">Admin</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
