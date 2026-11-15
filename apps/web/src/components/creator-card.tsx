import { categoryLabel, type CreatorPublic, type SocialAccountPublic, type Verification } from '@takeone/shared';
import { Avatar, Badge, Flag, StatusBadge } from '@/components/ui';

export function VerificationBadge({ v }: { v: Verification }) {
  return <StatusBadge kind="verification" status={v} />;
}
const RANK: Record<Verification, number> = { self_reported: 0, checked: 1, api_verified: 2 };
/** The strongest verification across a creator's linked accounts. */
export const bestVerification = (socials: SocialAccountPublic[]): Verification => socials.reduce<Verification>((b, s) => (RANK[s.verification] > RANK[b] ? s.verification : b), 'self_reported');
const PLATFORM: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', snapchat: 'Snapchat' };
const compact = (n: number) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** Profile card shown to brands and agencies. Handles and results only — never an email, phone number or link out. */
export function CreatorCard({ c, socials, rank, earnings, children }: { c: CreatorPublic; socials: SocialAccountPublic[]; rank?: number; earnings?: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={c.display_name} src={c.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="truncate text-body font-medium">{c.display_name}</span>{c.is_pro && <Badge tone="outline">Pro</Badge>}</div>
          <div className="mt-1 flex items-center gap-2 text-caption text-secondary"><Flag code={c.country} />{c.categories.map(categoryLabel).join(' · ')}</div>
        </div>
        {rank !== undefined && <div className="text-right"><div className="tabular text-body-lg font-semibold">#{rank}</div><div className="text-caption text-tertiary">Rank</div></div>}
      </div>
      <dl className="tabular grid grid-cols-3 gap-2 text-center">
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Win rate</dt><dd className="text-small font-semibold">{Math.round(Number(c.win_rate) * 100)}%</dd></div>
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Rating</dt><dd className="text-small font-semibold">{c.rating_avg ? Number(c.rating_avg).toFixed(1) : '—'}</dd></div>
        <div className="rounded-sm bg-surface-2 py-2"><dt className="text-caption text-tertiary">Earnings</dt><dd className="truncate px-1 text-small font-semibold">{earnings ?? '—'}</dd></div>
      </dl>
      <div className="flex items-center justify-between gap-2 text-caption">
        <span className="min-w-0 truncate text-secondary">{socials.map((s) => `${PLATFORM[s.platform] ?? s.platform} ${compact(s.followers)}`).join(' · ') || 'No linked accounts'}</span>
        <VerificationBadge v={bestVerification(socials)} />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">{children}</div>}
    </div>
  );
}
