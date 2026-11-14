import { Star } from 'lucide-react';
import type { CreatorPublic, SocialAccountPublic, Verification } from '@takeone/shared';
import { Avatar, Badge, ICON, StatusBadge } from '@/components/ui';

export function VerificationBadge({ v }: { v: Verification }) {
  return <StatusBadge kind="verification" status={v} />;
}
const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Profile card shown to brands and agencies. Handles and stats only — never an email, phone number or link out. */
export function CreatorCard({ c, socials, rank, children }: { c: CreatorPublic & { wins_count?: number; submissions_count?: number }; socials: SocialAccountPublic[]; rank?: number; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={c.display_name} src={c.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="truncate text-body font-medium">{c.display_name}</span>{c.is_pro && <Badge tone="outline">Pro</Badge>}</div>
          <div className="mt-1 line-clamp-2 text-caption text-secondary">{c.bio}</div>
        </div>
        {rank !== undefined && <div className="text-right"><div className="tabular text-body-lg font-semibold">#{rank}</div><div className="text-caption text-tertiary">Rank</div></div>}
      </div>
      <dl className="tabular grid grid-cols-3 gap-2 text-center">
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Win rate</dt><dd className="text-small font-semibold">{Math.round(Number(c.win_rate) * 100)}%</dd></div>
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Completed</dt><dd className="text-small font-semibold">{c.campaigns_completed}</dd></div>
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Rating</dt><dd className="flex items-center justify-center gap-1 text-small font-semibold"><Star size={16} {...ICON} className="fill-warning text-warning" aria-hidden />{c.rating_avg ? Number(c.rating_avg).toFixed(1) : '—'}</dd></div>
      </dl>
      <ul className="space-y-2">
        {socials.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-caption">
            <span className="min-w-0 truncate"><span className="capitalize text-secondary">{s.platform}</span> <span className="text-primary">@{s.handle.replace(/^@/, '')}</span> <span className="tabular text-tertiary">· {compact(s.followers)} followers</span></span>
            <VerificationBadge v={s.verification} />
          </li>
        ))}
      </ul>
      {children && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">{children}</div>}
    </div>
  );
}
