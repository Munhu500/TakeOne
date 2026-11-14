// Root layout for the static preview build only (NEXT_PUBLIC_STATIC_PREVIEW=true). The normal build uses layout.tsx.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AgencyTheme, PreviewBanner } from '@/preview/host';
import './globals.css';

export const metadata: Metadata = { title: 'TakeOne — one take, ten ads (preview)', description: 'Static preview with demo data.', robots: { index: false, follow: false } };

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('t1-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-screen font-sans"><AgencyTheme />{children}<PreviewBanner /></body>
    </html>
  );
}
