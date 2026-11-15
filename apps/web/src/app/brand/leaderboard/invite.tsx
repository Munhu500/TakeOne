'use client';
import { useState } from 'react';
import { rpc } from '@/lib/actions';
import { Button } from '@/components/ui';
import { Popover } from '@/components/ui/overlays';
import { Select } from '@/components/ui/select';

export function InviteButton({ creatorId, name, campaigns }: { creatorId: string; name: string; campaigns: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [campaign, setCampaign] = useState(campaigns[0]?.id ?? '');
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (state?.ok) return <span role="status" className="text-caption text-success-text">{state.text}</span>;
  return (
    <Popover open={open} onOpenChange={setOpen} align="end" className="w-80"
      trigger={<Button size="sm" variant="secondary" aria-label={`Invite ${name}`}>Invite</Button>}>
      {campaigns.length === 0 ? <p className="text-small text-secondary">You need a funded campaign before you can invite creators.</p> : (
        <div className="space-y-3">
          <Select id={`invite-${creatorId}`} label={`Invite ${name} to`} value={campaign} onValueChange={setCampaign} options={campaigns.map((c) => ({ value: c.id, label: c.title }))} />
          {state && <p role="alert" className="text-caption text-danger-text">{state.text}</p>}
          <Button size="sm" loading={busy} className="w-full" onClick={async () => {
            setBusy(true);
            const r = await rpc('invite_creator', { p_campaign_id: campaign, p_creator_id: creatorId });
            setBusy(false);
            setState(r.ok ? { ok: true, text: 'Invited · 48 hours to reply' } : { ok: false, text: r.error ?? 'The invitation could not be sent.' });
            if (r.ok) setOpen(false);
          }}>Send invitation</Button>
        </div>
      )}
    </Popover>
  );
}
