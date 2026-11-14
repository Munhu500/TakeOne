import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getLlm } from '@takeone/providers';
import { briefSchema } from '@takeone/shared';
import { supabaseServer } from '@/lib/supabase-server';

const body = z.object({ product_name: z.string().min(1).max(160), brief: briefSchema });

export async function POST(req: NextRequest) {
  const sb = await supabaseServer();
  if (!(await sb.auth.getUser()).data.user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Add a product name first' }, { status: 400 });
  try {
    const llm = getLlm();
    return NextResponse.json({ shot_list: await llm.generateShotList(parsed.data.product_name, parsed.data.brief), provider: llm.name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
