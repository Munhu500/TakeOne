'use client';
import { useEffect, useRef, useState } from 'react';
import { Send, ShieldAlert } from 'lucide-react';
import { MASKING_NOTICE, maskContactInfo } from '@takeone/shared';
import { rpc } from '@/lib/actions';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { Button } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';

interface Msg { id: string; sender_id: string; body_masked: string; had_masking: boolean; created_at: string }

/** Campaign-scoped chat. Masking is enforced in the database; the local check only previews the notice while typing. */
export function Chat({ campaignId, creatorId, me, initial, otherName }: { campaignId: string; creatorId: string; me: string; initial: Msg[]; otherName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const willMask = text.trim() ? maskContactInfo(text).hadMasking : false;

  useEffect(() => {
    const sb = supabaseBrowser();
    const add = (m: Msg) => setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m].sort((a, b) => a.created_at.localeCompare(b.created_at))));
    const load = async () => {
      const { data } = await sb.from('messages').select('id, sender_id, body_masked, had_masking, created_at').eq('campaign_id', campaignId).eq('creator_id', creatorId).order('created_at');
      (data as Msg[] | null)?.forEach(add);
    };
    const ch = sb.channel(`chat:${campaignId}:${creatorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `campaign_id=eq.${campaignId}` }, (p: { new: Msg & { creator_id: string } }) => { if (p.new.creator_id === creatorId) add(p.new); })
      .subscribe();
    const poll = setInterval(load, 8000); // fallback when websockets are blocked
    return () => { clearInterval(poll); sb.removeChannel(ch); };
  }, [campaignId, creatorId]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(null);
    const r = await rpc<Msg>('send_message', { p_campaign_id: campaignId, p_creator_id: creatorId, p_body: text.trim() });
    setBusy(false);
    if (!r.ok || !r.data) return setError(r.error ?? 'Message not sent');
    setMsgs((cur) => (cur.some((x) => x.id === r.data!.id) ? cur : [...cur, r.data!]));
    setText('');
  }
  return (
    <div className="card flex h-[520px] flex-col">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">{otherName}<span className="ml-2 text-xs font-normal text-faint">Contact details are never shared</span></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && <p className="pt-10 text-center text-sm text-muted">No messages yet. Say hello and confirm shipping details here.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={cn('flex flex-col', m.sender_id === me ? 'items-end' : 'items-start')}>
            <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.sender_id === me ? 'bg-accent text-accent-fg' : 'bg-raised')}>{m.body_masked}</div>
            {m.had_masking && <div className="mt-1 flex max-w-[80%] items-center gap-1 text-[11px] text-warn"><ShieldAlert size={12} />{MASKING_NOTICE}</div>}
            <div className="mt-0.5 text-[11px] text-faint">{timeAgo(m.created_at)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="border-t border-line p-3">
        {willMask && <p className="mb-2 flex items-center gap-1 text-xs text-warn"><ShieldAlert size={12} />Contact details and off-platform requests will be hidden before this is sent.</p>}
        {error && <p role="alert" className="mb-2 text-xs text-bad">{error}</p>}
        <div className="flex gap-2">
          <input className="input" aria-label="Message" placeholder="Write a message" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send size={15} /></Button>
        </div>
      </form>
    </div>
  );
}
