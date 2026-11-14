import { BadgeCheck, CircleCheck, CircleDashed, Star } from 'lucide-react';
import { VERIFICATION_BADGES, type CreatorPublic, type SocialAccountPublic, type Verification } from '@takeone/shared';
import { Avatar, Badge } from '@/components/ui';

const VTONE = { api_verified: 'ok', checked: 'accent', self_reported: 'neutral' } as const;
const VICON = { api_verified: BadgeCheck, checked: CircleCheck, self_reported: CircleDashed };
export function VerificationBadge({ v }: { v: Verification }) {
  const Icon = VICON[v];
  return <Badge tone={VTONE[v]}><Icon size={11} />{VERIFICATION_BADGES[v]}</Badge>;
}
const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Profile card shown to brands and agencies. Handles and stats only — never an email, phone number or link out. */
export function CreatorCard({ c, socials, rank, children }: { c: CreatorPublic & { wins_count?: number; submissions_count?: number }; socials: SocialAccountPublic[]; rank?: number; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <Avatar name={c.display_name} src={c.avatar} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="truncate font-medium">{c.display_name}</span>{c.is_pro && <Badge tone="accent">Pro</Badge>}{c.has_likeness && <Badge>Likeness on file</Badge>}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-muted">{c.bio}</div>
        </div>
        {rank !== undefined && <div className="text-right"><div className="tabular font-display text-lg font-semibold">#{rank}</div><div className="text-[11px] text-faint">leaderboard</div></div>}
      </div>
      <dl className="tabular grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-raised py-2"><dt className="text-[11px] text-faint">Win rate</dt><dd className="text-sm font-semibold">{Math.round(Number(c.win_rate) * 100)}%</dd></div>
        <div className="rounded-xl bg-raised py-2"><dt className="text-[11px] text-faint">Completed</dt><dd className="text-sm font-semibold">{c.campaigns_completed}</dd></div>
        <div className="rounded-xl bg-raised py-2"><dt className="text-[11px] text-faint">Rating</dt><dd className="flex items-center justify-center gap-1 text-sm font-semibold"><Star size={12} className="fill-warn text-warn" />{c.rating_avg ? Number(c.rating_avg).toFixed(1) : '—'}</dd></div>
      </dl>
      <ul className="space-y-1.5">
        {socials.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate"><span className="capitalize text-muted">{s.platform}</span> <span className="text-fg">@{s.handle.replace(/^@/, '')}</span> <span className="tabular text-faint">· {compact(s.followers)} followers · {compact(s.avg_views)} avg views</span></span>
            <VerificationBadge v={s.verification} />
          </li>
        ))}
      </ul>
      {children && <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">{children}</div>}
    </div>
  );
}
