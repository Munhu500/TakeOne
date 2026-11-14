'use client';
import { useState } from 'react';
import { rpc } from '@/lib/actions';
import { Button } from '@/components/ui';
import { Select } from '@/components/ui/select';

export function InviteButton({ creatorId, campaigns }: { creatorId: string; campaigns: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '');
  const [state, setState] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (state?.tone === 'ok') return <span className="text-caption text-success-text">{state.text}</span>;
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={!campaigns.length} title={campaigns.length ? undefined : 'Fund a campaign to invite creators'}>Invite</Button>;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Select id={`invite-${creatorId}`} compact className="w-56" label="Campaign to invite to" value={campaign} onValueChange={setCampaign} options={campaigns.map((c) => ({ value: c.id, label: c.title }))} />
        <Button size="sm" loading={busy} onClick={async () => {
          setBusy(true);
          const r = await rpc('invite_creator', { p_campaign_id: campaign, p_creator_id: creatorId });
          setBusy(false);
          setState(r.ok ? { tone: 'ok', text: 'Invited · 48h to respond' } : { tone: 'bad', text: r.error ?? 'Could not invite' });
        }}>Send</Button>
      </div>
      {state?.tone === 'bad' && <span role="alert" className="text-caption text-danger-text">{state.text}</span>}
    </div>
  );
}
