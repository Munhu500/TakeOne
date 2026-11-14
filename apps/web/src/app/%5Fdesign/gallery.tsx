'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { color, motion, radius, size, space, type, type ColorToken } from '@takeone/design-tokens';
import {
  Avatar, Badge, Button, Card, Checkbox, Code, DemoPill, EmptyState, ErrorState, Flag, ICON, Input, Money, Plural, ProductImage, ProgressBar,
  RowChevron, Skeleton, Stat, StatusBadge, Table, Tabs, Td, Textarea, Th, THead, Tr, VideoFrame, type ButtonVariant, type StatusKind, type Tone,
} from '@/components/ui';
import { ConfirmDialog, Drawer, DropdownMenu, IconButton, Modal, Popover, Tooltip } from '@/components/ui/overlays';
import { Combobox, SegmentedControl, Select } from '@/components/ui/select';
import { toast, ToastHost } from '@/components/ui/toast';
import { Reveal, RevealItem } from '@/components/ui/reveal';
import { daysLeftLabel, fmtDate, pluralise } from '@/lib/utils';

type Theme = 'dark' | 'light';
const COLOR_GROUPS: [string, ColorToken[]][] = [
  ['Surfaces', ['bg', 'surface-1', 'surface-2', 'surface-3', 'inverse', 'inverse-hover']],
  ['Lines', ['border', 'border-strong']],
  ['Text', ['text-primary', 'text-secondary', 'text-tertiary', 'on-inverse', 'on-accent', 'on-media']],
  ['Accent', ['accent', 'accent-hover', 'accent-fill-hover', 'accent-soft', 'accent-text']],
  ['Status', ['success', 'success-soft', 'success-text', 'warning', 'warning-soft', 'warning-text', 'danger', 'danger-soft', 'danger-text']],
  ['Media', ['scrim', 'scrim-soft', 'glass']],
];
const TYPE_CLASS: Record<keyof typeof type, string> = {
  display: 'text-display', h1: 'text-h1', h2: 'text-h2', h3: 'text-h3', 'body-lg': 'text-body-lg', body: 'text-body', small: 'text-small', caption: 'text-caption', stat: 'text-stat', 'stat-sm': 'text-stat-sm',
};
const BUTTONS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'accent', 'destructive'];
const TONES: Tone[] = ['neutral', 'accent', 'success', 'warning', 'danger', 'outline'];
const STATUSES: [StatusKind, string[]][] = [
  ['campaign', ['draft', 'live', 'in_review', 'completed', 'cancelled']],
  ['payment', ['pending', 'held', 'released', 'refunded', 'failed']],
  ['verification', ['self_reported', 'checked', 'api_verified']],
  ['application', ['applied', 'shortlisted', 'accepted', 'rejected', 'invited']],
  ['variant', ['coming_soon', 'processing', 'ready', 'qa_pending', 'qa_rejected']],
  ['dispute', ['open', 'resolved_creator', 'resolved_brand', 'refunded']],
  ['withdrawal', ['requested', 'processing', 'paid', 'failed']],
  ['kyc', ['none', 'pending', 'verified', 'rejected']],
];
const OPTIONS = [{ value: 'in', label: 'India', icon: <Flag code="IN" /> }, { value: 'ae', label: 'United Arab Emirates', icon: <Flag code="AE" /> }, { value: 'us', label: 'United States' }];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-12">
      <div className="caption-label">{title}</div>
      {note && <p className="mt-2 max-w-prose text-small text-secondary">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 md:flex-row md:items-center"><div className="w-40 shrink-0 text-caption text-tertiary">{label}</div><div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div></div>
);

export function Gallery() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState<null | 'plain' | 'text' | 'reason'>(null);
  const [drawer, setDrawer] = useState(false);
  const [sel, setSel] = useState('');
  const [combo, setCombo] = useState('in');
  const [seg, setSeg] = useState('9:16');
  const [check, setCheck] = useState(true);

  // the gallery is the one place either theme can be forced: ?theme=light
  useEffect(() => { const t = new URLSearchParams(location.search).get('theme'); if (t === 'light') setTheme('light'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; return () => { document.documentElement.dataset.theme = 'dark'; }; }, [theme]);

  return (
    <main className="container-page py-12">
      <ToastHost />
      <header className="flex flex-wrap items-end justify-between gap-6 pb-12">
        <div>
          <div className="flex items-center gap-3"><span className="caption-label">Studio Noir</span><DemoPill /></div>
          <h1 className="mt-4 text-h1 font-semibold">Design system</h1>
          <p className="mt-3 max-w-prose text-body text-secondary">Every token and component used on the web. Values come from <Code>packages/design-tokens</Code>; nothing here is defined locally.</p>
        </div>
        <SegmentedControl label="Theme" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
      </header>

      <Section title="Colour" note="Text tokens meet WCAG AA on every surface they are used on; the pairs are tested in packages/design-tokens.">
        <div className="space-y-6">
          {COLOR_GROUPS.map(([group, names]) => (
            <div key={group}>
              <div className="text-caption text-tertiary">{group}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {names.map((n) => (
                  <div key={n}>
                    <div className="h-16 rounded-sm border border-border" style={{ background: `var(--${n})` }} />
                    <div className="mt-2 text-caption">{n}</div>
                    <div className="font-mono text-caption text-tertiary">{color[theme][n]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type" note="Geist for interface text, Geist Mono for codes, Instrument Serif italic for one emphasised word in a headline. All three are served from this site.">
        {(Object.keys(type) as (keyof typeof type)[]).map((k) => (
          <Row key={k} label={`${k} · ${type[k].desktop[0]}/${type[k].desktop[1]} · ${type[k].mobile[0]}/${type[k].mobile[1]}`}>
            <span className={`${TYPE_CLASS[k]} ${type[k].weight === 600 ? 'font-semibold' : type[k].weight === 500 ? 'font-medium' : ''} ${k.startsWith('stat') ? 'tabular' : ''} truncate`}>{k.startsWith('stat') ? '₹4,82,000' : 'One take, ten ads'}</span>
          </Row>
        ))}
        <Row label="caption label"><span className="caption-label">Usage and licences</span></Row>
        <Row label="serif accent"><span className="text-h2 font-semibold">One take. Ten <em className="font-serif font-normal">ads</em>.</span></Row>
        <Row label="mono"><span className="font-mono text-small">TK1-48291 · INV-2026-0042</span></Row>
        <Row label="tabular figures"><span className="tabular text-body">1,111,111 · 9,999,999 · 45 days</span></Row>
      </Section>

      <Section title="Spacing, radius, size">
        <Row label="space (4pt scale)">{Object.entries(space).filter(([, v]) => v > 0).map(([k, v]) => <div key={k} className="text-center"><div className="h-6 rounded-sm bg-accent-soft" style={{ width: v }} /><div className="mt-2 text-caption text-tertiary">{k} · {v}</div></div>)}</Row>
        <Row label="radius">{Object.entries(radius).map(([k, v]) => <div key={k} className="text-center"><div className="h-16 w-16 border border-border-strong bg-surface-2" style={{ borderRadius: v }} /><div className="mt-2 text-caption text-tertiary">{k} · {v === 999 ? 'pill' : v}</div></div>)}</Row>
        <Row label="control heights"><span className="text-small text-secondary">sm {size['control-sm']} · md {size['control-md']} · lg {size['control-lg']} · input {size.input} · row {size.row} · media row {size['row-media']}</span></Row>
        <Row label="elevation"><div className="rounded-md border border-border-strong bg-surface-2 px-5 py-4 text-small shadow-float">Floating layers only: menus, dialogs, toasts</div><div className="glass rounded-md px-5 py-4 text-small">Glass: sticky navigation</div></Row>
      </Section>

      <Section title="Motion" note={`${motion.duration.fast}ms for presses and hovers, ${motion.duration.base}ms for overlays, ${motion.duration.slow}ms for reveals. One easing curve. Reduced motion falls back to opacity.`}>
        <Reveal className="grid gap-4 md:grid-cols-3">{['Reveal', 'Staggered', `${motion.stagger}ms apart`].map((t) => <RevealItem key={t}><Card>{t}</Card></RevealItem>)}</Reveal>
      </Section>

      <Section title="Buttons" note="Primary is a white pill. The filled accent is reserved for the single key action in a view.">
        {BUTTONS.map((v) => (
          <Row key={v} label={v}>
            <Button variant={v} size="sm">Small</Button><Button variant={v}>Default</Button><Button variant={v} size="lg">Large</Button>
            <Button variant={v}><Plus size={16} {...ICON} />With icon</Button><Button variant={v} loading>Saving</Button><Button variant={v} disabled>Disabled</Button>
          </Row>
        ))}
        <Row label="icon button"><IconButton label="Search"><Search size={20} {...ICON} /></IconButton><IconButton label="More" disabled><MoreHorizontal size={20} {...ICON} /></IconButton><Tooltip label="Tooltips name icon-only controls"><span className="text-small text-secondary underline underline-offset-4">Hover or focus for a tooltip</span></Tooltip></Row>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Input id="g-in" label="Campaign title" placeholder="Glow serum launch" helper="Shown to creators in the feed." />
          <Input id="g-in2" label="Filled" defaultValue="Glow serum launch" />
          <Input id="g-err" label="Budget per creator" defaultValue="12" error="Enter at least ₹500." />
          <Input id="g-dis" label="Disabled" defaultValue="Locked after payment" disabled />
          <Select id="g-sel" label="Country" value={sel} onValueChange={setSel} options={OPTIONS} helper="Sets the currency." />
          <Combobox id="g-combo" label="Client workspace" value={combo} onValueChange={setCombo} options={OPTIONS} />
          <Textarea id="g-ta" label="Brief" placeholder="What should the creator show and say?" rows={3} />
          <div className="space-y-4"><Checkbox id="g-ck" checked={check} onChange={setCheck}>I accept the non-circumvention terms</Checkbox><SegmentedControl label="Aspect ratio" value={seg} onChange={setSeg} options={['9:16', '4:5', '1:1'].map((v) => ({ value: v, label: v }))} /></div>
          <div className="flex flex-wrap content-start gap-2"><button className="chip is-on" aria-pressed>Beauty</button><button className="chip" aria-pressed={false}>Fitness</button><button className="chip" aria-pressed={false}><Flag code="IN" />India</button></div>
        </div>
      </Section>

      <Section title="Badges and status" note="One vocabulary for every status in the product. Badges are tinted, never filled.">
        <Row label="tones">{TONES.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}<DemoPill /></Row>
        {STATUSES.map(([kind, list]) => <Row key={kind} label={kind}>{list.map((s) => <StatusBadge key={s} kind={kind} status={s} />)}</Row>)}
        <Row label="flags"><Flag code="IN" /><Flag code="AE" size={20} /><Flag code="US" size={24} /></Row>
      </Section>

      <Section title="Cards and stats">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card><Stat label="In escrow" value={<Money minor={48200000} currency="INR" />} hint="Across 3 live campaigns" /></Card>
          <Card><Stat label="Licences" value="12" delta={{ text: '+3 this month', tone: 'success' }} /></Card>
          <Card><Stat label="Approval time" value="1.4 days" delta={{ text: '+0.3 days', tone: 'danger' }} /></Card>
          <Card interactive><div className="text-small font-medium">Interactive card</div><p className="mt-2 text-small text-secondary">Border strengthens on hover and focus. No shadow.</p></Card>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <Card><ProgressBar value={2} max={3} label="2 of 3 included variants selected" /></Card>
          <Card><ProgressBar value={11} max={15} label="11 of 15 applications" tone="accent" /></Card>
          <Card><ProgressBar value={45} max={45} label="Paid" tone="success" /></Card>
        </div>
      </Section>

      <Section title="Avatars and media" note="Initials come from the first letters of the first two words. Product and footage slots show a neutral frame until real files are added under apps/web/public/media.">
        <Row label="avatar"><Avatar name="Naina (Founding)" size="sm" /><Avatar name="Aarav Mehta" /><Avatar name="Layla Al Farsi" size="lg" /><Avatar name="Lumière Skin" square /><Avatar name="Mirage Media" size="lg" square /></Row>
        <Row label="product image"><ProductImage name="Glow Serum" className="w-24" /><ProductImage name="Cold Brew Chai" ratio="square" className="w-24" /></Row>
        <Row label="video frame"><VideoFrame label="Hook first, 9:16" className="w-32" /><VideoFrame label="Testimonial, 4:5" ratio="portrait" className="w-32" /><VideoFrame label="Silent montage, 1:1" ratio="square" className="w-32" /></Row>
      </Section>

      <Section title="Navigation">
        <Tabs active="#overview" tabs={[{ href: '#overview', label: 'Overview' }, { href: '#applicants', label: 'Applicants', count: 14 }, { href: '#creators', label: 'Creators', count: 3 }, { href: '#messages', label: 'Messages' }]} />
      </Section>

      <Section title="Table" note="56px rows, 72px with media. Numbers right-aligned in tabular figures. Rows that open something carry a chevron.">
        <Table>
          <THead><Th>Variant</Th><Th>Licence</Th><Th>Ends</Th><Th numeric>Fee</Th><Th aria-label="Open" /></THead>
          <tbody>
            {[['Hook first', 'Base', 5, 0], ['Testimonial', 'Partnership ad', 43, 22500000], ['Silent montage', 'Renewal', 31, 37500000]].map(([name, kind, d, fee]) => (
              <Tr key={String(name)} media>
                <Td><div className="flex items-center gap-3"><ProductImage name={String(name)} ratio="square" radius="sm" className="w-12" /><span className="font-medium">{name}</span></div></Td>
                <Td><Badge>{kind}</Badge></Td>
                <Td className="text-secondary">{fmtDate(new Date(Date.now() + Number(d) * 86_400_000))} · {daysLeftLabel(new Date(Date.now() + Number(d) * 86_400_000 - 1000))}</Td>
                <Td numeric>{fee ? <Money minor={Number(fee)} currency="INR" /> : 'Included'}</Td>
                <Td><RowChevron /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Loading, empty and error" note="Every list and table has all three. Empty states are one sentence and one action.">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3"><Skeleton shape="stat" /><Skeleton /><Skeleton /><Skeleton shape="text" className="w-40" /></div>
          <EmptyState title="No campaigns yet. Post one to start receiving applications." action={<Button>New campaign</Button>} />
          <ErrorState retry={<Button variant="secondary">Try again</Button>} />
        </div>
      </Section>

      <Section title="Overlays">
        <Row label="modal and drawer"><Button variant="secondary" onClick={() => setModal(true)}>Open modal</Button><Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button></Row>
        <Row label="confirm"><Button variant="secondary" onClick={() => setConfirm('plain')}>Confirm</Button><Button variant="secondary" onClick={() => setConfirm('reason')}>Confirm with reason</Button><Button variant="destructive" onClick={() => setConfirm('text')}>Type to confirm</Button></Row>
        <Row label="popover and menu">
          <Popover trigger={<Button variant="secondary">Popover</Button>}><p className="max-w-xs text-small text-secondary">Paid usage runs for 45 days from the licence date and can be renewed.</p></Popover>
          <DropdownMenu trigger={<Button variant="secondary">Menu</Button>} items={[{ label: 'Download invoice', onSelect: () => toast('Invoice downloaded') }, { label: 'Unavailable', onSelect: () => {}, disabled: true }, { label: 'Cancel campaign', onSelect: () => toast('Not available in the demo', 'danger'), destructive: true }]} />
        </Row>
        <Row label="toast"><Button variant="secondary" onClick={() => toast('Licence renewed for 45 days')}>Show toast</Button><Button variant="secondary" onClick={() => toast('Payment could not be taken', 'danger')}>Show error toast</Button></Row>
      </Section>

      <Section title="Formatting">
        <Row label="money (summary)"><Money minor={48200000} currency="INR" /><Money minor={1250000} currency="AED" /><Money minor={199900} currency="USD" /></Row>
        <Row label="money (precise)"><Money minor={48200050} currency="INR" precise /><Money minor={1250075} currency="AED" precise /></Row>
        <Row label="plurals"><span className="text-small">{pluralise(1, 'creator')} · {pluralise(3, 'creator')} · <Plural n={0} one="variant" /> · {pluralise(1, 'day')} left</span></Row>
        <Row label="dates"><span className="text-small">{fmtDate('2026-11-15')}</span></Row>
      </Section>

      <Modal open={modal} onOpenChange={setModal} title="Invite to a campaign" description="The creator has 48 hours to reply." footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => setModal(false)}>Send invite</Button></>}>
        <Input id="g-m" label="Note (optional)" placeholder="Why this creator fits" />
      </Modal>
      <Drawer open={drawer} onOpenChange={setDrawer} title="Creator" footer={<Button onClick={() => setDrawer(false)}>Done</Button>}>
        <div className="flex items-center gap-3"><Avatar name="Aarav Mehta" size="lg" /><div><div className="font-medium">Aarav Mehta</div><div className="text-caption text-secondary">Beauty · Lifestyle</div></div></div>
      </Drawer>
      <ConfirmDialog open={confirm === 'plain'} onOpenChange={() => setConfirm(null)} title="Renew this licence" effect="Adds 45 days of paid usage after the current end date. The creator receives 75%." confirmLabel="Renew" onConfirm={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'reason'} onOpenChange={() => setConfirm(null)} title="Reject this variant" effect="The creator is told why and can submit again." confirmLabel="Reject" destructive requireReason onConfirm={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'text'} onOpenChange={() => setConfirm(null)} title="Refund this campaign" effect="Returns the escrow payment to the brand. This cannot be undone." confirmLabel="Refund" destructive requireText="REFUND" onConfirm={() => setConfirm(null)} />
    </main>
  );
}
