import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { hostAgency } from '@/lib/session';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const agency = await hostAgency();
  return agency
    ? { title: `${agency.name} · Creator campaigns`, description: `${agency.name} creator campaign workspace` }
    : { title: 'TakeOne — one take, ten ads', description: 'Creators shoot one take. Brands get up to ten ad variants and license the winners.' };
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const agency = await hostAgency();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning style={agency ? ({ '--accent': hexToRgb(agency.primary_color) } as React.CSSProperties) : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('t1-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
