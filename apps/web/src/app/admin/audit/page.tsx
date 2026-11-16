import { requireAdmin, paginate } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase-server';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { Pager } from '@/components/admin/bits';
import { AuditFilters, AuditTable, type AuditRow } from './table';

type SP = { q?: string; admin?: string; entity?: string; action?: string; page?: string };

export default async function AuditLog({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await requireAdmin();
  const sb = await supabaseServer();
  let query = sb.from('audit_log').select('id, actor_id, action, entity, entity_id, before, after, reason, created_at').not('reason', 'is', null).order('created_at', { ascending: false }).limit(1000);
  if (sp.admin) query = query.eq('actor_id', sp.admin);
  if (sp.entity) query = query.eq('entity', sp.entity);
  if (sp.action) query = query.like('action', `${sp.action}.%`);
  const { data } = await query;
  const all = (data ?? []) as Omit<AuditRow, 'admin'>[];
  const { data: admins } = await sb.from('profiles').select('id, display_name').eq('role', 'admin').order('display_name');
  const name = new Map((admins ?? []).map((p) => [p.id as string, p.display_name as string]));
  const q = (sp.q ?? '').trim().toLowerCase();
  const rows: AuditRow[] = all.map((r) => ({ ...r, admin: name.get(r.actor_id ?? '') ?? 'System' }))
    .filter((r) => !q || [r.action, r.entity, r.entity_id, r.reason, r.admin].some((v) => (v ?? '').toLowerCase().includes(q)));
  const pg = paginate(rows, sp.page);
  const href = (n: number) => `/admin/audit?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.admin ? { admin: sp.admin } : {}), ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(n) })}`;
  return (
    <>
      <PageHeader title="Audit log" sub="Every admin action that changed money, a status, a verification or a setting: who, what, why, and the values before and after." />
      <AuditFilters q={sp.q ?? ''} admin={sp.admin ?? ''} entity={sp.entity ?? ''} action={sp.action ?? ''} admins={(admins ?? []).map((p) => ({ value: p.id as string, label: p.display_name as string }))} />
      {rows.length === 0 ? <EmptyState title={all.length ? 'Nothing matches these filters.' : 'No admin actions have been recorded yet.'} action={<LinkButton href="/admin/audit" variant="secondary">Clear filters</LinkButton>} />
        : <><AuditTable rows={pg.rows} /><Pager {...pg} href={href} /></>}
    </>
  );
}
