import { notFound } from 'next/navigation';
import { CREDITS_ENABLED, FORMATS, formatMoney, QA_REQUIRED_FIRST_N_CAMPAIGNS, VERIFICATION_BADGES, type FormatId, type Verification } from '@takeone/shared';
import { supabaseServer } from '@/lib/supabase-server';
import { Avatar, Badge, Card, Empty, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { RpcButton } from '@/components/client';
import { VerificationBadge } from '@/components/creator-card';
import { cn, fmtDate, timeAgo, titleCase } from '@/lib/utils';

const METHOD: Record<string, string> = { upi: 'UPI', bank_transfer: 'Bank transfer', paypal: 'PayPal', wise: 'Wise', payoneer: 'Payoneer' };
import { CreditForm, DisputeActions, FxForm, QaCard, RunJobs, SettingForm, ScreenRecordingLink } from '../widgets';

type Sb = Awaited<ReturnType<typeof supabaseServer>>;
const Table = ({ head, children, min = 720 }: { head: string[]; children: React.ReactNode; min?: number }) => (
  <div className="card overflow-x-auto"><table className={cn('data-table', min > 720 ? 'min-w-table-wide' : 'min-w-table')}><thead><tr className="border-b border-border text-left text-caption text-tertiary">{head.map((h) => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{children}</tbody></table></div>
);
const names = async (sb: Sb, ids: string[]) => new Map(((ids.length ? (await sb.from('profiles').select('id, display_name, role, country').in('id', [...new Set(ids)])).data : []) ?? []).map((p) => [p.id as string, p]));

async function Qa({ sb }: { sb: Sb }) {
  const [{ data }, { count: live }, { data: setting }] = await Promise.all([
    sb.from('variants').select('*, takes!inner(assignment_id, assignments!inner(creator_id, campaigns!inner(title, product_name, brief, brands(name))))').eq('status', 'qa_pending').order('created_at'),
    sb.from('campaigns').select('id', { count: 'exact', head: true }).not('published_at', 'is', null),
    sb.from('settings').select('value').eq('key', 'qa_required_first_n_campaigns').maybeSingle(),
  ]);
  type Row = { id: string; format: FormatId; hook_text: string | null; score: number | null; score_reason: string | null; is_synthetic: boolean; thumbnail: string | null; preview_renditions: Record<string, string>; takes: { assignments: { creator_id: string; campaigns: { title: string; product_name: string; brief: { must_not_say?: string[] }; brands: { name: string } } } } };
  const rows = (data ?? []) as unknown as Row[];
  const paths = rows.flatMap((v) => [v.thumbnail, v.preview_renditions['9:16']]).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await sb.storage.from('variants').createSignedUrls(paths, 3600) : { data: [] };
  const urls: Record<string, string> = {};
  for (const x of signed ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
  const who = await names(sb, rows.map((r) => r.takes.assignments.creator_id));
  const threshold = Number(setting?.value ?? QA_REQUIRED_FIRST_N_CAMPAIGNS);
  return (
    <>
      <PageHeader title="QA queue" sub={`Submitted variants are reviewed here before the brand sees them, for the first ${threshold} campaigns (${live ?? 0} published so far).`} />
      {rows.length === 0 ? <Empty title="Queue is clear" body="New submissions appear here when creators submit from Studio." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {rows.map((v) => {
            const c = v.takes.assignments.campaigns;
            return <QaCard key={v.id} id={v.id} title={FORMATS[v.format]?.name ?? v.format} video={urls[v.preview_renditions['9:16'] ?? '']} poster={urls[v.thumbnail ?? '']} media={`variants/${v.format}`} hook={v.hook_text} score={v.score} reason={v.score_reason} synthetic={v.is_synthetic}
              meta={`${who.get(v.takes.assignments.creator_id)?.display_name ?? 'Creator'} · ${c.brands.name} · ${c.product_name}`} mustNot={c.brief?.must_not_say ?? []} />;
          })}
        </div>
      )}
    </>
  );
}

async function Verification({ sb }: { sb: Sb }) {
  const { data } = await sb.from('social_accounts').select('*').or('ownership_requested_at.not.is.null,screen_recording_path.not.is.null,flags.neq.{}').order('ownership_requested_at', { ascending: false, nullsFirst: false });
  const rows = (data ?? []).filter((r) => r.verification === 'self_reported' || (r.flags as string[]).length > 0);
  const who = await names(sb, rows.map((r) => r.creator_id));
  return (
    <>
      <PageHeader title="Verification queue" sub="Ownership codes, screen recordings and claims that look implausible against public data." />
      {rows.length === 0 ? <Empty title="Nothing to verify" /> : (
        <Table head={['Creator', 'Account', 'Claimed', 'Public cross-check', 'Evidence', 'Badge', '']} min={980}>
          {rows.map((r) => {
            const pub = r.public_metrics as { followers?: number; avgLikes?: number } | null;
            const flags = r.flags as string[];
            return (
              <tr key={r.id}>
                <td className="p-4 font-medium">{who.get(r.creator_id)?.display_name}</td>
                <td className="p-4"><span className="capitalize text-secondary">{r.platform}</span> @{r.handle}</td>
                <td className="tabular p-4 text-caption text-secondary">{r.followers.toLocaleString()} followers<br />{r.avg_views.toLocaleString()} avg views · {r.engagement_rate}%</td>
                <td className="tabular p-4 text-caption">{pub ? <span className="text-secondary">{pub.followers?.toLocaleString()} followers · {pub.avgLikes?.toLocaleString()} avg likes</span> : <span className="text-tertiary">pending</span>}<div className="mt-1 flex flex-wrap gap-1">{r.plausibility_score !== null && <Badge tone={r.plausibility_score >= 75 ? 'success' : r.plausibility_score >= 45 ? 'warning' : 'danger'}>Plausibility {r.plausibility_score}</Badge>}{flags.map((f) => <Badge key={f} tone="danger">{titleCase(f)}</Badge>)}</div></td>
                <td className="p-4 text-caption">{r.ownership_requested_at && <div>Bio/story code <code className="rounded-sm bg-surface-2 px-2 py-1">{r.ownership_code}</code><div className="text-tertiary">requested {timeAgo(r.ownership_requested_at)}</div></div>}{r.screen_recording_path && <ScreenRecordingLink path={r.screen_recording_path} code={r.screen_recording_code} />}</td>
                <td className="p-4"><VerificationBadge v={r.verification as Verification} /></td>
                <td className="p-4"><div className="flex justify-end gap-2">
                  <RpcButton size="sm" fn="admin_verify_social" args={{ p_social_id: r.id, p_verification: 'checked' }} path="/admin">Mark {VERIFICATION_BADGES.checked}</RpcButton>
                  <RpcButton size="sm" variant="ghost" fn="admin_verify_social" args={{ p_social_id: r.id, p_verification: 'self_reported' }} path="/admin">Keep self-reported</RpcButton>
                </div></td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}

async function Users({ sb }: { sb: Sb }) {
  const [{ data: profiles }, { data: creators }] = await Promise.all([
    sb.from('profiles').select('*').neq('role', 'worker').order('created_at', { ascending: false }).limit(200),
    sb.from('creators').select('profile_id, tier, is_founding, kyc_status, flagged, win_rate, campaigns_completed, rating_avg'),
  ]);
  const cm = new Map((creators ?? []).map((c) => [c.profile_id as string, c]));
  const count = (r: string) => (profiles ?? []).filter((p) => p.role === r).length;
  return (
    <>
      <PageHeader title="Users" />
      <div className="mb-6 grid gap-4 sm:grid-cols-4"><Stat label="Creators" value={count('creator')} /><Stat label="Brand members" value={count('brand_member')} /><Stat label="Agency members" value={count('agency_member')} /><Stat label="Pro creators" value={(creators ?? []).filter((c) => c.tier === 'pro' || c.is_founding).length} /></div>
      <Table head={['User', 'Role', 'Country', 'Tier', 'KYC', 'Stats', 'Joined']}>
        {(profiles ?? []).map((p) => {
          const c = cm.get(p.id);
          return (
            <tr key={p.id}>
              <td className="p-4"><span className="flex items-center gap-3"><Avatar name={p.display_name || '?'} src={p.avatar} size="sm" /><span className="font-medium">{p.display_name}</span>{c?.flagged && <Badge tone="danger">Flagged</Badge>}</span></td>
              <td className="p-4 text-secondary">{titleCase(p.role)}</td><td className="p-4 text-secondary">{p.country}</td>
              <td className="p-4">{c ? <Badge tone={c.tier === 'pro' || c.is_founding ? 'accent' : 'neutral'}>{c.is_founding ? 'Founding · Pro for life' : titleCase(c.tier)}</Badge> : '—'}</td>
              <td className="p-4">{c ? <StatusBadge kind="kyc" status={c.kyc_status} /> : '—'}</td>
              <td className="tabular p-4 text-caption text-secondary">{c ? `${Math.round(Number(c.win_rate) * 100)}% win · ${c.campaigns_completed} done · rating ${c.rating_avg ?? '—'}` : '—'}</td>
              <td className="p-4 text-caption text-tertiary">{fmtDate(p.created_at)}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}

async function Campaigns({ sb }: { sb: Sb }) {
  const { data } = await sb.from('campaigns').select('*, brands(name), assignments(status), applications(count)').order('created_at', { ascending: false });
  return (
    <>
      <PageHeader title="Campaigns" />
      <Table head={['Campaign', 'Brand', 'Status', 'Budget', 'Creators', 'Applicants', 'QA gate', 'Deadline']} min={900}>
        {(data ?? []).map((c) => (
          <tr key={c.id}>
            <td className="p-4 font-medium">{c.title}</td><td className="p-4 text-secondary">{(c.brands as { name: string }).name}</td>
            <td className="p-4"><StatusBadge kind="campaign" status={c.status} /></td>
            <td className="tabular p-4">{formatMoney(Number(c.fee_per_creator_minor) * c.creators_needed, c.currency)}</td>
            <td className="tabular p-4 text-secondary">{(c.assignments as unknown[]).length}/{c.creators_needed}</td>
            <td className="tabular p-4 text-secondary">{(c.applications as { count: number }[])[0]?.count ?? 0}</td>
            <td className="p-4">{c.qa_required ? <Badge tone="warning">On</Badge> : <Badge>Off</Badge>}</td>
            <td className="p-4 text-caption text-tertiary">{fmtDate(c.deadline)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

async function Disputes({ sb }: { sb: Sb }) {
  const [{ data }, { data: refunds }] = await Promise.all([
    sb.from('disputes').select('*, assignments(creator_id, campaigns(title, fee_per_creator_minor, currency, brands(name)))').order('created_at', { ascending: false }),
    sb.from('payments').select('*, campaigns(title), brands(name)').eq('status', 'refunded').order('created_at', { ascending: false }),
  ]);
  type D = { id: string; reason: string; status: string; resolution: string | null; opened_by: string; created_at: string; assignments: { creator_id: string; campaigns: { title: string; fee_per_creator_minor: number; currency: string; brands: { name: string } } } };
  const rows = (data ?? []) as unknown as D[];
  const who = await names(sb, rows.flatMap((d) => [d.opened_by, d.assignments.creator_id]));
  return (
    <>
      <PageHeader title="Disputes & refunds" sub="Escrow stays held while a dispute is open." />
      {rows.length === 0 ? <Empty title="No disputes" /> : (
        <div className="space-y-3">
          {rows.map((d) => {
            const c = d.assignments.campaigns;
            return (
              <Card key={d.id} className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.title}</span><StatusBadge kind="dispute" status={d.status} /></div>
                  <div className="mt-1 text-caption text-secondary">{c.brands.name} ↔ {who.get(d.assignments.creator_id)?.display_name} · opened by {who.get(d.opened_by)?.display_name} ({titleCase(who.get(d.opened_by)?.role ?? '')}) {timeAgo(d.created_at)} · slot value {formatMoney(Number(c.fee_per_creator_minor), c.currency)}</div>
                  <p className="mt-2 text-small">“{d.reason}”</p>
                  {d.resolution && <p className="mt-1 text-caption text-secondary">Resolution: {d.resolution}</p>}
                </div>
                {d.status === 'open' && <DisputeActions id={d.id} />}
              </Card>
            );
          })}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-h3">Refunds</h2>
      {(refunds ?? []).length === 0 ? <p className="text-small text-secondary">No refunds issued.</p> : (
        <Table head={['Date', 'Brand', 'Campaign', 'Amount', 'Provider']}>{(refunds ?? []).map((p) => (<tr key={p.id}><td className="p-4 text-secondary">{fmtDate(p.created_at)}</td><td className="p-4">{(p.brands as { name: string }).name}</td><td className="p-4 text-secondary">{(p.campaigns as { title: string } | null)?.title}</td><td className="tabular p-4">{formatMoney(Number(p.amount_minor), p.currency)}</td><td className="p-4 text-secondary">{p.provider}</td></tr>))}</Table>
      )}
    </>
  );
}

async function Payouts({ sb }: { sb: Sb }) {
  const [{ data: ledger }, { data: w }] = await Promise.all([sb.from('ledger_entries').select('state, amount_minor, currency'), sb.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(100)]);
  const who = await names(sb, (w ?? []).map((x) => x.creator_id));
  const sum = (state: string, cur: string) => (ledger ?? []).filter((l) => l.state === state && l.currency === cur).reduce((a, l) => a + Number(l.amount_minor), 0);
  const curs = [...new Set((ledger ?? []).map((l) => l.currency as string))];
  return (
    <>
      <PageHeader title="Payout overview" sub="Creator earnings by ledger state. Payouts use the mock provider in demo mode." />
      <Table head={['Currency', 'Pending (in escrow)', 'Cleared (in payout delay)', 'Available to withdraw', 'Withdrawn']}>
        {curs.map((c) => <tr key={c} className="tabular"><td className="p-4 font-medium">{c}</td>{['pending', 'cleared', 'available', 'withdrawn'].map((s) => <td key={s} className="p-4">{formatMoney(sum(s, c), c)}</td>)}</tr>)}
      </Table>
      <h2 className="mb-3 mt-8 text-h3">Withdrawals</h2>
      {(w ?? []).length === 0 ? <Empty title="No withdrawals yet" /> : (
        <Table head={['Date', 'Creator', 'Method', 'Amount', 'Status', 'Reference']}>
          {(w ?? []).map((x) => <tr key={x.id}><td className="p-4 text-secondary">{fmtDate(x.created_at)}</td><td className="p-4 font-medium">{who.get(x.creator_id)?.display_name}</td><td className="p-4 text-secondary">{METHOD[x.method] ?? titleCase(x.method)}</td><td className="tabular p-4">{formatMoney(Number(x.amount_minor), x.currency)}</td><td className="p-4"><StatusBadge kind="withdrawal" status={x.status} /></td><td className="p-4 text-caption text-tertiary">{x.provider_ref}</td></tr>)}
        </Table>
      )}
    </>
  );
}

async function Masking({ sb }: { sb: Sb }) {
  const { data } = await sb.from('masking_attempts').select('*, campaigns(title)').order('created_at', { ascending: false }).limit(300);
  const by = new Map<string, NonNullable<typeof data>>();
  for (const a of data ?? []) by.set(a.profile_id, [...(by.get(a.profile_id) ?? []), a]);
  const who = await names(sb, [...by.keys()]);
  const rows = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  return (
    <>
      <PageHeader title="Message-masking flags" sub="Every attempt to share contact details or move off-platform is masked and logged. Users are flagged after 3 attempts." />
      {rows.length === 0 ? <Empty title="No masked messages" /> : (
        <Table head={['User', 'Role', 'Attempts', 'What was masked', 'Last campaign', 'Last attempt']}>
          {rows.map(([id, list]) => (
            <tr key={id}>
              <td className="p-4 font-medium">{who.get(id)?.display_name}</td><td className="p-4 text-secondary">{titleCase(who.get(id)?.role ?? '')}</td>
              <td className="p-4"><Badge tone={list.length >= 3 ? 'danger' : 'warning'}>{list.length}{list.length >= 3 ? ' · flagged' : ''}</Badge></td>
              <td className="p-4"><div className="flex flex-wrap gap-1">{[...new Set(list.flatMap((l) => l.kinds as string[]))].map((k) => <Badge key={k}>{titleCase(k)}</Badge>)}</div></td>
              <td className="p-4 text-secondary">{(list[0]!.campaigns as { title: string } | null)?.title}</td><td className="p-4 text-caption text-tertiary">{timeAgo(list[0]!.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

async function Credits({ sb }: { sb: Sb }) {
  const [{ data }, { data: brands }] = await Promise.all([sb.from('credits').select('*, brands(name)').order('created_at', { ascending: false }), sb.from('brands').select('id, name, currency').order('name')]);
  return (
    <>
      <PageHeader title="Credits" sub="First-campaign credit (Option B) is issued automatically: 25% of the campaign value, valid 60 days, usable only against the platform fee." />
      <div className="grid gap-6 lg:grid-cols-main-narrow">
        {(data ?? []).length === 0 ? <Empty title="No credits issued" /> : (
          <Table head={['Brand', 'Amount', 'Used', 'Source', 'Expires']} min={560}>
            {(data ?? []).map((c) => <tr key={c.id} className="tabular"><td className="p-4 font-medium">{(c.brands as { name: string }).name}</td><td className="p-4">{formatMoney(Number(c.amount_minor), c.currency)}</td><td className="p-4 text-secondary">{formatMoney(Number(c.used_minor), c.currency)}</td><td className="p-4 text-secondary">{c.source_campaign_id ? 'First campaign completed' : 'Issued by admin'}</td><td className="p-4"><Badge tone={new Date(c.expires_at) < new Date() ? 'danger' : 'neutral'}>{fmtDate(c.expires_at)}</Badge></td></tr>)}
          </Table>
        )}
        <Card><div className="text-small font-medium">Issue a credit</div><CreditForm brands={(brands ?? []) as { id: string; name: string; currency: string }[]} /></Card>
      </div>
    </>
  );
}

async function Settings({ sb }: { sb: Sb }) {
  const [{ data: settings }, { data: fx }] = await Promise.all([sb.from('settings').select('*').order('key'), sb.from('fx_rates').select('*').order('currency')]);
  const get = (k: string) => settings?.find((s) => s.key === k)?.value;
  return (
    <>
      <PageHeader title="Settings" action={<RunJobs />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><div className="text-small font-medium">Quality review</div><p className="mt-1 text-caption text-secondary">While fewer campaigns than this have been published, submissions pass through the QA queue.</p><SettingForm k="qa_required_first_n_campaigns" kind="number" value={get('qa_required_first_n_campaigns')} label="QA required for the first N campaigns" /></Card>
        <Card><div className="text-small font-medium">Pricing defaults</div><SettingForm k="pro_prices" kind="json" value={get('pro_prices')} label="Creator Pro price per month, fixed per market (minor units)" /><p className="mt-3 text-caption text-secondary">Platform fee is fixed at 25% (creators keep 75%) on every payment.</p></Card>
        <Card><div className="text-small font-medium">Licence prices</div><p className="mt-1 text-caption text-secondary">Basis points of the per-creator campaign fee (10000 = 100%).</p><SettingForm k="license_pricing" kind="json" value={get('license_pricing')} label="extraVariantBps · renewalBps · buyoutBps · whitelistBps (Partnership ad) · termDays (35 to 45)" /></Card>
        <Card><div className="text-small font-medium">Feature flags</div><SettingForm k="feature_flags" kind="json" value={get('feature_flags')} label="Flags" /><SettingForm k="demo_mode" kind="json" value={get('demo_mode')} label="Demo mode (mock checkout, instant KYC and payouts)" /></Card>
        <Card className="lg:col-span-2"><div className="text-small font-medium">FX rates</div><p className="mt-1 text-caption text-secondary">USD value of one unit. Used to show amounts in each user’s local currency. A scheduled refresh can update these.</p><FxForm rates={(fx ?? []).map((r) => ({ currency: r.currency as string, rate: String(r.rate_to_usd), updated: fmtDate(r.updated_at) }))} /></Card>
      </div>
    </>
  );
}

const SECTIONS = { qa: Qa, verification: Verification, users: Users, campaigns: Campaigns, disputes: Disputes, payouts: Payouts, masking: Masking, credits: Credits, settings: Settings };
export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === 'credits' && !CREDITS_ENABLED) notFound();
  const Section = SECTIONS[section as keyof typeof SECTIONS];
  if (!Section) notFound();
  return <Section sb={await supabaseServer()} />;
}
