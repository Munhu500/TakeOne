import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDubbing, getLlm, getScene, getTranscriber, isDemoMode } from '@takeone/providers';
import { ASPECTS, briefSchema, computeAutoChecks, FORMAT_LIST, formatsForTier, mockPublicMetrics, scoreMetricPlausibility, type Take, type Transcript } from '@takeone/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ASSETS, connect, rpc, SAMPLE_TAG, SAMPLE_WALL, upload, WORK } from './backend';
import { ffmpeg, probe } from './ffmpeg';
import { runPipeline, sampleFrames, type VariantOutput } from './pipeline';

interface Claimed {
  job: { id: string; type: 'process_take' | 'product_check' | 'verify_metrics' | 'rerender_variant'; payload: Record<string, string> };
  context: {
    take?: Take; assignment_id?: string; creator_id?: string; is_pro?: boolean;
    campaign?: { id: string; title: string; product_name: string; product_images: string[]; brief: unknown };
    likeness?: { voice_provider_id: string | null } | null;
    variant?: { hook_options: string[] } | null;
    social?: { id: string; handle: string; followers: number; avg_views: number; engagement_rate: number } | null;
  };
}

async function download(sb: SupabaseClient, bucket: string, key: string, dest: string): Promise<void> {
  const { data, error } = await sb.storage.from(bucket).download(key);
  if (error || !data) throw new Error(`download ${bucket}/${key}: ${error?.message}`);
  await writeFile(dest, Buffer.from(await data.arrayBuffer()));
}

export async function uploadVariant(sb: SupabaseClient, takeId: string, v: VariantOutput): Promise<Record<string, unknown>> {
  const renditions: Record<string, string> = {};
  const previews: Record<string, string> = {};
  for (const aspect of ASPECTS) {
    const tag = aspect.replace(':', 'x');
    renditions[aspect] = `${takeId}/${v.format}/clean_${tag}.mp4`;
    previews[aspect] = `${takeId}/${v.format}/preview_${tag}.mp4`;
    await upload(sb, 'variants', renditions[aspect], v.clean[aspect]);
    await upload(sb, 'variants', previews[aspect], v.preview[aspect]);
  }
  const thumbnail = `${takeId}/${v.format}/thumb.jpg`;
  await upload(sb, 'variants', thumbnail, v.thumbnail);
  return {
    storage_path: renditions['9:16'], renditions, preview_renditions: previews, thumbnail, hook_text: v.hookText, hook_options: v.hookOptions,
    score: v.score, score_reason: v.scoreReason, is_synthetic: v.isSynthetic, ai_disclosure: v.aiDisclosure, language: v.language, status: 'ready',
  };
}

async function processTake(sb: SupabaseClient, c: Claimed): Promise<void> {
  const take = c.context.take!;
  const campaign = c.context.campaign!;
  const dir = path.join(WORK, take.id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const progress = (p: number, label: string) => { console.log(`  ${p}% ${label}`); return rpc(sb, 'worker_update_job', { p_job_id: c.job.id, p_status: 'running', p_progress: p }); };

  await progress(3, 'Downloading take');
  const takePath = path.join(dir, 'take.mp4');
  await download(sb, 'takes', take.storage_path, takePath);
  const info = await probe(takePath);
  const isSample = info.comment.includes(SAMPLE_TAG);

  await progress(8, 'Transcribing');
  const audio = path.join(dir, 'audio.m4a');
  if (info.hasAudio) await ffmpeg(['-i', takePath, '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', audio]);
  const sidecarPath = path.join(ASSETS, 'sample-take.transcript.json');
  const sidecar = isSample && existsSync(sidecarPath) ? (JSON.parse(await readFile(sidecarPath, 'utf8')) as Transcript) : null;
  const transcript = await getTranscriber().transcribe(audio, { durationSeconds: info.duration, sidecar });
  await rpc(sb, 'worker_update_take', { p_take_id: take.id, p_patch: { transcript, duration: info.duration } });

  const formats = formatsForTier(!!c.context.is_pro);
  for (const f of formats) await rpc(sb, 'worker_upsert_variant', { p_take_id: take.id, p_format: f.id, p: { status: 'processing' } });
  for (const f of FORMAT_LIST.filter((x) => !x.v1)) await rpc(sb, 'worker_upsert_variant', { p_take_id: take.id, p_format: f.id, p: { status: 'coming_soon' } });

  const outputs = await runPipeline({
    takePath, workDir: path.join(dir, 'out'), transcript, brief: briefSchema.parse(campaign.brief ?? {}), productName: campaign.product_name, formats,
    dubLanguage: take.dub_language ?? 'hi', voiceId: c.context.likeness?.voice_provider_id ?? null,
    sampleWallColor: isSample ? SAMPLE_WALL : null, sceneImage: path.join(ASSETS, 'scene_morning.jpg'),
    llm: getLlm(), dubbing: getDubbing(), scene: getScene(), onProgress: progress,
  });
  const brief = briefSchema.parse(campaign.brief ?? {});
  for (const v of outputs) {
    // automated QA checks are computed here, once, and stored with the variant for reviewers
    const auto_checks = computeAutoChecks({ productName: campaign.product_name, brief, transcript: transcript.text, hook: v.hookText, format: v.format, isSynthetic: v.isSynthetic, aiDisclosure: v.aiDisclosure,
      language: v.language, productCheck: take.product_check === 'pending' ? null : take.product_check, productCheckReason: take.product_check_reason });
    await rpc(sb, 'worker_upsert_variant', { p_take_id: take.id, p_format: v.format, p: { ...(await uploadVariant(sb, take.id, v)), auto_checks } });
  }
  await rpc(sb, 'worker_finish_take', { p_take_id: take.id });
  await rm(dir, { recursive: true, force: true });
}

/** The creator picked a different hook in Studio: rebuild just that format with the chosen text. */
async function rerenderVariant(sb: SupabaseClient, c: Claimed): Promise<void> {
  const take = c.context.take!;
  const campaign = c.context.campaign!;
  const format = FORMAT_LIST.find((f) => f.id === c.job.payload.format);
  if (!format || !take.transcript) throw new Error('Nothing to re-render');
  const dir = path.join(WORK, `${take.id}-${format.id}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const takePath = path.join(dir, 'take.mp4');
  await download(sb, 'takes', take.storage_path, takePath);
  const isSample = (await probe(takePath)).comment.includes(SAMPLE_TAG);
  const [v] = await runPipeline({
    takePath, workDir: path.join(dir, 'out'), transcript: take.transcript, brief: briefSchema.parse(campaign.brief ?? {}), productName: campaign.product_name, formats: [format],
    dubLanguage: take.dub_language ?? 'hi', voiceId: c.context.likeness?.voice_provider_id ?? null, sampleWallColor: isSample ? SAMPLE_WALL : null, sceneImage: path.join(ASSETS, 'scene_morning.jpg'),
    llm: getLlm(), dubbing: getDubbing(), scene: getScene(), hookOverrides: { [format.id]: { hook: c.job.payload.hook!, options: c.context.variant?.hook_options ?? [] } },
    onProgress: (p) => rpc(sb, 'worker_update_job', { p_job_id: c.job.id, p_status: 'running', p_progress: p }),
  });
  const auto_checks = computeAutoChecks({ productName: campaign.product_name, brief: briefSchema.parse(campaign.brief ?? {}), transcript: take.transcript?.text ?? '', hook: v!.hookText, format: format.id, isSynthetic: v!.isSynthetic,
    aiDisclosure: v!.aiDisclosure, language: v!.language, productCheck: take.product_check === 'pending' ? null : take.product_check, productCheckReason: take.product_check_reason });
  await rpc(sb, 'worker_upsert_variant', { p_take_id: take.id, p_format: format.id, p: { ...(await uploadVariant(sb, take.id, v!)), auto_checks } });
  await rm(dir, { recursive: true, force: true });
}

async function productCheck(sb: SupabaseClient, c: Claimed): Promise<void> {
  const take = c.context.take!;
  const dir = path.join(WORK, `${take.id}-check`);
  await mkdir(dir, { recursive: true });
  const takePath = path.join(dir, 'take.mp4');
  await download(sb, 'takes', take.storage_path, takePath);
  const frames = await sampleFrames(takePath, dir);
  let reference: { mediaType: 'image/jpeg'; base64: string } | null = null;
  const img = c.context.campaign?.product_images?.[0];
  if (img && !img.startsWith('http')) {
    const ref = path.join(dir, 'ref.jpg');
    try { await download(sb, 'public-assets', img, ref); reference = { mediaType: 'image/jpeg', base64: (await readFile(ref)).toString('base64') }; } catch { /* no reference image */ }
  }
  const res = await getLlm().checkProductInFrame(frames, reference, c.context.campaign?.product_name ?? 'the product');
  await rpc(sb, 'worker_update_take', { p_take_id: take.id, p_patch: { product_check: res.visible ? 'passed' : 'failed', product_check_reason: res.reason } });
  await rm(dir, { recursive: true, force: true });
}

async function verifyMetrics(sb: SupabaseClient, c: Claimed): Promise<void> {
  const s = c.context.social;
  if (!s) return;
  const claimed = { followers: s.followers, avgViews: s.avg_views, engagementRate: Number(s.engagement_rate) };
  // Hook for a real public-data source (official APIs / a data partner). Demo uses deterministic mocked public numbers.
  const pub = mockPublicMetrics(s.handle, claimed);
  const r = scoreMetricPlausibility(claimed, pub);
  await rpc(sb, 'worker_set_metrics', { p_social_id: s.id, p_public: pub, p_score: r.score, p_flags: r.flags });
}

async function main() {
  const sb = await connect();
  const poll = Number(process.env.POLL_INTERVAL_MS ?? 3000);
  console.log(`TakeOne video worker up · demo=${isDemoMode()} · llm=${getLlm().name} · stt=${getTranscriber().name} · dub=${getDubbing().name} · scene=${getScene().name}`);
  let lastTick = 0;
  let stopping = false;
  process.on('SIGTERM', () => (stopping = true));
  process.on('SIGINT', () => (stopping = true));
  const once = process.argv.includes('--once');
  while (!stopping) {
    if (Date.now() - lastTick > 60_000) {
      lastTick = Date.now();
      try { console.log('tick', JSON.stringify(await rpc(sb, 'run_scheduled_jobs'))); } catch (e) { console.error('tick failed:', (e as Error).message); }
    }
    let claimed: Claimed | null = null;
    try { claimed = await rpc<Claimed | null>(sb, 'worker_claim_job'); } catch (e) { console.error('claim failed:', (e as Error).message); }
    if (!claimed) {
      if (once) break;
      await new Promise((r) => setTimeout(r, poll));
      continue;
    }
    const { job } = claimed;
    console.log(`job ${job.id} ${job.type}`);
    try {
      if (job.type === 'process_take') await processTake(sb, claimed);
      else if (job.type === 'product_check') await productCheck(sb, claimed);
      else if (job.type === 'rerender_variant') await rerenderVariant(sb, claimed);
      else await verifyMetrics(sb, claimed);
      await rpc(sb, 'worker_update_job', { p_job_id: job.id, p_status: 'done', p_progress: 100 });
    } catch (e) {
      console.error(`job ${job.id} failed:`, (e as Error).message);
      await rpc(sb, 'worker_update_job', { p_job_id: job.id, p_status: 'failed', p_error: (e as Error).message.slice(0, 1000) }).catch(() => {});
    }
  }
  process.exit(0);
}

if (process.argv[1]?.endsWith('index.ts')) main().catch((e) => { console.error(e); process.exit(1); });
