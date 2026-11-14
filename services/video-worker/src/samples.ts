/**
 * Builds the demo media with no API keys:
 *   1. a synthetic "creator take" (illustrated creator + real product bottle, synthesised speech)
 *   2. the five v1 variants in three aspect ratios, through the real FFmpeg pipeline with mock AI providers
 *   3. (with --upload) uploads everything the seed data points at
 * Usage: pnpm samples [--upload]
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { MockDubbing, MockLlm, MockScene, MockTranscriber } from '@takeone/providers';
import { briefSchema, V1_FORMATS, type Transcript } from '@takeone/shared';
import { ASSETS, connect, SAMPLE_TAG, SAMPLE_WALL, upload, WORK } from './backend';
import { ffmpeg, probe } from './ffmpeg';
import { uploadVariant } from './index';
import { runPipeline } from './pipeline';

const run = promisify(execFile);
const SENTENCES = [
  'Okay so, um, my skin used to look really tired by the afternoon.',
  'I have been using this serum every morning for thirty days.',
  'It is lightweight, it is not sticky, and it sits well under sunscreen.',
  'Honestly, my skin looks brighter, and I would buy it again.',
];
const SEED_TAKES = [
  { takeId: '7a000000-0000-4000-8000-000000000001', creator: 'aaaaaaaa-0000-4000-8000-000000000001' },
  { takeId: '7a000000-0000-4000-8000-000000000002', creator: 'aaaaaaaa-0000-4000-8000-000000000005' },
  { takeId: '7a000000-0000-4000-8000-000000000003', creator: 'aaaaaaaa-0000-4000-8000-000000000002' },
];

async function buildTake(dir: string): Promise<{ take: string; transcript: Transcript }> {
  await run('python3', [path.join(ASSETS, '..', 'scripts', 'make_assets.py'), ASSETS]);
  const lead = 0.5, gap = 0.75;
  let t = lead;
  const segs: { s: number; e: number; text: string; wav: string }[] = [];
  for (const [i, text] of SENTENCES.entries()) {
    const wav = path.join(dir, `s${i}.wav`);
    await ffmpeg(['-f', 'lavfi', '-i', `flite=text='${text.replace(/'/g, '')}':voice=slt`, '-ar', '44100', wav]);
    const d = (await probe(wav)).duration;
    segs.push({ s: t, e: t + d, text, wav });
    t += d + gap;
  }
  const total = t - gap + 0.6;
  const audioInputs = segs.flatMap((s) => ['-i', s.wav]);
  const delays = segs.map((s, i) => `[${i + 3}:a]adelay=${Math.round(s.s * 1000)}:all=1[d${i}]`).join(';');
  const speaking = segs.map((s) => `between(t,${s.s.toFixed(2)},${s.e.toFixed(2)})`).join('+');
  const take = path.join(ASSETS, 'sample-take.mp4');
  await ffmpeg([
    '-f', 'lavfi', '-i', `color=c=${SAMPLE_WALL}:s=720x1280:r=30:d=${total.toFixed(2)}`,
    '-loop', '1', '-i', path.join(ASSETS, 'creator_closed.png'), '-loop', '1', '-i', path.join(ASSETS, 'creator_open.png'),
    ...audioInputs,
    '-filter_complex',
    `[0:v][1:v]overlay=0:'6*sin(2*PI*t/3.2)':shortest=1[b];[b][2:v]overlay=0:'6*sin(2*PI*t/3.2)':enable='(${speaking})*lt(mod(t,0.26),0.13)'[v];${delays};${segs.map((_, i) => `[d${i}]`).join('')}amix=inputs=${segs.length}:normalize=0,apad=whole_dur=${total.toFixed(2)},volume=1.6[a]`,
    '-map', '[v]', '-map', '[a]', '-t', total.toFixed(2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
    '-metadata', `comment=${SAMPLE_TAG}`, '-movflags', '+faststart', take,
  ]);
  const words: Transcript['words'] = [];
  for (const s of segs) {
    const ws = s.text.split(/\s+/);
    const weights = ws.map((w) => w.length + 2);
    const sum = weights.reduce((a, b) => a + b, 0);
    let acc = 0;
    ws.forEach((w, k) => { const a = s.s + ((s.e - s.s) * acc) / sum; acc += weights[k]!; words.push({ w, s: a, e: s.s + ((s.e - s.s) * acc) / sum }); });
  }
  const transcript: Transcript = { text: SENTENCES.join(' '), language: 'en', words, segments: segs.map(({ s, e, text }) => ({ s, e, text })) };
  await writeFile(path.join(ASSETS, 'sample-take.transcript.json'), JSON.stringify(transcript, null, 1));
  return { take, transcript };
}

async function main() {
  const dir = path.join(WORK, 'samples');
  await mkdir(dir, { recursive: true });
  console.log('1/3 building the sample take…');
  const { take, transcript: sidecar } = await buildTake(dir);
  const transcript = await new MockTranscriber().transcribe('', { durationSeconds: (await probe(take)).duration, sidecar });
  console.log('2/3 rendering 5 formats × 3 aspect ratios…');
  const brief = briefSchema.parse({ key_benefits: ['Brightens dull skin', 'Lightweight, non-sticky'], target_audience: 'Women 22–35 who want a simple routine', must_not_say: ['Medical claims'] });
  const outputs = await runPipeline({
    takePath: take, workDir: path.join(dir, 'out'), transcript, brief, productName: 'Vitamin C Glow Serum', formats: V1_FORMATS, dubLanguage: 'hi', voiceId: 'mock-voice',
    sampleWallColor: SAMPLE_WALL, sceneImage: path.join(ASSETS, 'scene_morning.jpg'), llm: new MockLlm(), dubbing: new MockDubbing(), scene: new MockScene(),
    onProgress: (p, l) => console.log(`   ${p}% ${l}`),
  });
  const pre = path.join(ASSETS, 'prerendered');
  for (const v of outputs) {
    await mkdir(path.join(pre, v.format), { recursive: true });
    await copyFile(v.preview['9:16'], path.join(pre, v.format, 'preview_9x16.mp4'));
    await copyFile(v.thumbnail, path.join(pre, v.format, 'thumb.jpg'));
    console.log(`   ${v.format}: score ${v.score}, ${v.duration.toFixed(1)}s, hook="${v.hookText ?? '-'}"${v.isSynthetic ? ' [AI-labelled]' : ''}`);
  }
  if (!process.argv.includes('--upload')) return console.log('Done (local only). Re-run with --upload to push to Supabase.');
  console.log('3/3 uploading…');
  const sb = await connect();
  await upload(sb, 'public-assets', 'seed/sample-take.mp4', take);
  await upload(sb, 'public-assets', 'seed/sample-take.jpg', outputs[0]!.thumbnail);
  const { readdir } = await import('node:fs/promises');
  for (const f of await readdir(path.join(ASSETS, 'products'))) await upload(sb, 'public-assets', `seed/products/${f}`, path.join(ASSETS, 'products', f));
  for (const { takeId, creator } of SEED_TAKES) {
    await upload(sb, 'takes', `${creator}/seed-take.mp4`, take);
    for (const v of outputs) await uploadVariant(sb, takeId, v);
    console.log(`   uploaded variants for take ${takeId}`);
  }
  console.log('Done.');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
