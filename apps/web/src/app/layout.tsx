import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/ui/toast';
import { fontVariables } from '@/lib/fonts';
import { hostAgency } from '@/lib/session';
import { agencyThemeCss, THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const agency = await hostAgency();
  return agency
    ? { title: `${agency.name} · Creator campaigns`, description: `${agency.name} creator campaign workspace` }
    : { title: 'TakeOne — one take, ten ads', description: 'Creators shoot one take. Brands get up to ten ad variants and license the winners.' };
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
