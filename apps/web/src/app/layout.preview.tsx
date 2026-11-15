// Root layout for the static preview build only (NEXT_PUBLIC_STATIC_PREVIEW=true). The normal build uses layout.tsx.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/ui/toast';
import { fontVariables } from '@/lib/fonts';
import { THEME_SCRIPT } from '@/lib/theme';
import { AgencyTheme } from '@/preview/host';
import './globals.css';

export const metadata: Metadata = {
  title: 'TakeOne — One take. Every winning ad.',
  description: 'Creators film one honest take with a real product. TakeOne turns it into ten ranked ad formats, and brands license the winners. Static preview with demo data.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen"><AgencyTheme />{children}<ToastHost /></body>
    </html>
  );
}
