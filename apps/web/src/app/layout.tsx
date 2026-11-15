import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/ui/toast';
import { fontVariables } from '@/lib/fonts';
import { hostAgency } from '@/lib/session';
import { agencyThemeCss, THEME_SCRIPT } from '@/lib/theme';
import { DEMO } from '@/lib/utils';
import './globals.css';

const TITLE = 'TakeOne — One take. Every winning ad.';
const DESCRIPTION = 'Creators film one honest take with a real product. TakeOne turns it into ten ranked ad formats, and brands license the winners. Now open in India and the UAE.';

export async function generateMetadata(): Promise<Metadata> {
  const agency = await hostAgency();
  if (agency) return { title: `${agency.name} · Creator campaigns`, description: `${agency.name} creator campaign workspace`, robots: { index: false, follow: false } };
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: TITLE,
    description: DESCRIPTION,
    icons: { icon: '/favicon.svg' },
    openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', siteName: 'TakeOne', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'TakeOne — one take, every winning ad' }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og.png'] },
    // the demo is not for search engines; indexing starts when demo mode is switched off
    robots: DEMO ? { index: false, follow: false } : undefined,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const agency = await hostAgency();
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        {agency && <style dangerouslySetInnerHTML={{ __html: agencyThemeCss(agency.primary_color) }} />}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen">{children}<ToastHost /></body>
    </html>
  );
}
