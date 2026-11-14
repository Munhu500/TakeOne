// Root layout for the static preview build only (NEXT_PUBLIC_STATIC_PREVIEW=true). The normal build uses layout.tsx.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastHost } from '@/components/ui/toast';
import { fontVariables } from '@/lib/fonts';
import { THEME_SCRIPT } from '@/lib/theme';
import { AgencyTheme } from '@/preview/host';
import './globals.css';

export const metadata: Metadata = { title: 'TakeOne — one take, ten ads', description: 'Static preview with demo data.', robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="min-h-screen"><AgencyTheme />{children}<ToastHost /></body>
    </html>
  );
}
