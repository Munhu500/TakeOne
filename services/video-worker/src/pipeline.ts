import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DubbingProvider, LlmProvider, SceneProvider } from '@takeone/providers';
import { AI_DISCLOSURE_NOTE, ASPECT_SIZES, ASPECTS, FORMATS, type Aspect, type Brief, type FormatDefinition, type FormatId, type Transcript } from '@takeone/shared';
import { ensureMusicBed, ffmpeg, fpath, hasBinary, probe } from './ffmpeg';

export interface Cut { s: number; e: number }
export interface CaptionCue { s: number; e: number; text: string }
export interface VariantOutput {
  format: FormatId;
  hookText: string | null;
  hookOptions: string[];
  score: number;
  scoreReason: string;
  isSynthetic: boolean;
  aiDisclosure: string | null;
  language: string | null;
  duration: number;
  /** local files */
  clean: Record<Aspect, string>;
  preview: Record<Aspect, string>;
  thumbnail: string;
}
export interface PipelineInput {
  takePath: string;
  workDir: string;
  transcript: Transcript;
  brief: Brief;
  productName: string;
  formats: FormatDefinition[];
  dubLanguage: string;
  voiceId: string | null;
  /** mock scene replacement keys this flat wall colour out (sample take only) */
  sampleWallColor: string | null;
  sceneImage: string;
  llm: LlmProvider;
  dubbing: DubbingProvider;
  scene: SceneProvider;
  /** creator-chosen hook per format (re-render); skips hook generation */
  hookOverrides?: Partial<Record<FormatId, { hook: string; options: string[] }>>;
  onProgress?: (pct: number, label: string) => unknown;
}

const LANG_NAMES: Record<string, string> = { hi: 'Hindi', ta: 'Tamil', te: 'Telugu', ar: 'Arabic', bn: 'Bengali', mr: 'Marathi', en: 'English' };

/** Sentence-level cuts with leading filler words and the dead air between sentences removed. */
export function tightCuts(t: Transcript): (Cut & { text: string; index: number })[] {
  return t.segments.flatMap((seg, index) => {
    const words = t.words.filter((w) => w.s >= seg.s - 0.01 && w.e <= seg.e + 0.01);
    let i = 0;
    while (i < words.length - 1 && words[i]!.filler) i++;
    const s = words.length ? Math.max(seg.s, words[i]!.s - 0.05) : seg.s;
    const e = seg.e + 0.08;
    const text = words.length ? words.slice(i).map((w) => w.w).join(' ') : seg.text;
    return e - s > 0.4 ? [{ s, e, text: text.replace(/^[a-z]/, (c) => c.toUpperCase()), index }] : [];
  });
}

function overlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().match(/[a-z']+/g) ?? []);
  return (b.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => wa.has(w)).length;
}

/** Order + trim the cuts for a format. Words are never re-ordered inside a sentence and never changed. */
export function planCuts(format: FormatDefinition, cuts: ReturnType<typeof tightCuts>, hook: string | null): (Cut & { index: number })[] {
  let ordered = [...cuts];
  if (format.edit.leadWithStrongest && hook && ordered.length > 1) {
    const best = ordered.reduce((b, c) => (overlap(hook, c.text) > overlap(hook, b.text) ? c : b), ordered[0]!);
    ordered = [best, ...ordered.filter((c) => c !== best)];
  }
  const max = format.edit.maxCutSeconds;
  let pieces = ordered.map((c) => ({ s: c.s, e: c.e, index: c.index }));
  if (max && format.edit.muteVoice) {
    // montage: short beats from every sentence
    pieces = ordered.flatMap((c) => {
      const n = Math.max(1, Math.min(2, Math.floor((c.e - c.s) / max)));
      return Array.from({ length: n }, (_, k) => ({ s: c.s + k * ((c.e - c.s) / n), e: Math.min(c.e, c.s + k * ((c.e - c.s) / n) + max), index: c.index }));
    });
  }
  const out: (Cut & { index: number })[] = [];
  let total = 0;
  for (const p of pieces) {
    if (total >= format.edit.maxDuration) break;
    const e = Math.min(p.e, p.s + (format.edit.maxDuration - total));
    out.push({ ...p, e });
    total += e - p.s;
  }
  return out;
}

function chunkWords(words: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i += n) out.push(words.slice(i, i + n).join(' '));
  return out;
}

/** Captions on the output timeline. `lines` overrides the spoken text per source sentence (used for dubbed versions). */
export function buildCaptions(cuts: (Cut & { index: number })[], t: Transcript, perCue: number, lines?: Record<number, string>): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let offset = 0;
  for (const c of cuts) {
    const dur = c.e - c.s;
    const seg = t.segments[c.index];
    let words: string[];
    if (lines) {
      const full = (lines[c.index] ?? '').split(/\s+/).filter(Boolean);
      const segDur = seg ? seg.e - seg.s : dur;
      const from = seg ? Math.max(0, (c.s - seg.s) / segDur) : 0;
      const to = seg ? Math.min(1, (c.e - seg.s) / segDur) : 1;
      words = full.slice(Math.floor(from * full.length), Math.max(Math.floor(from * full.length) + 1, Math.ceil(to * full.length)));
    } else {
      words = t.words.filter((w) => !w.filler && w.s >= c.s - 0.06 && w.s < c.e - 0.02).map((w) => w.w);
      if (!words.length && seg) words = seg.text.split(/\s+/);
    }
    const chunks = chunkWords(words, perCue);
    chunks.forEach((text, i) => cues.push({ s: offset + (dur * i) / chunks.length, e: offset + (dur * (i + 1)) / chunks.length - 0.02, text }));
    offset += dur;
  }
  return cues;
}

const assTime = (t: number) => {
  const cs = Math.max(0, Math.round(t * 100));
  return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`;
};
const assText = (s: string) => s.replace(/[{}]/g, '').replace(/\n/g, '\\N');

export function buildAss(aspect: Aspect, cues: CaptionCue[], hook: string | null, size: 'standard' | 'large' | 'none', badge: string | null): string {
  const { w, h } = ASPECT_SIZES[aspect];
  const fs = size === 'large' ? 62 : 46;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter,${fs},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,50,50,${Math.round(h * (size === 'large' ? 0.2 : 0.13))},1
Style: Hook,Inter Display,54,&H00FFFFFF,&H00FFFFFF,&H00FF5C7C,&H00FF5C7C,-1,0,0,0,100,100,0,0,3,14,0,8,60,60,${Math.round(h * 0.09)},1
Style: Badge,Inter,22,&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,-1,0,0,0,100,100,0,0,3,8,0,7,24,24,24,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  const total = cues.length ? cues[cues.length - 1]!.e : 5;
  if (hook) lines.push(`Dialogue: 2,${assTime(0)},${assTime(Math.min(3, total))},Hook,,0,0,0,,{\\fad(120,200)}${assText(hook)}`);
  if (badge) lines.push(`Dialogue: 1,${assTime(0)},${assTime(total + 10)},Badge,,0,0,0,,${assText(badge)}`);
  if (size !== 'none') for (const c of cues) lines.push(`Dialogue: 0,${assTime(c.s)},${assTime(c.e)},Cap,,0,0,0,,${assText(c.text)}`);
  return header + lines.join('\n') + '\n';
}

/** Concatenate the planned cuts into one 720x1280 intermediate (video + voice). */
async function renderCut(src: string, cuts: Cut[], out: string, hasAudio: boolean): Promise<void> {
  const parts: string[] = [];
  cuts.forEach((c, i) => {
    parts.push(`[0:v]trim=start=${c.s.toFixed(3)}:end=${c.e.toFixed(3)},setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v${i}]`);
    parts.push(hasAudio ? `[0:a]atrim=start=${c.s.toFixed(3)}:end=${c.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,aresample=44100[a${i}]` : `anullsrc=r=44100:cl=stereo,atrim=duration=${(c.e - c.s).toFixed(3)}[a${i}]`);
  });
  parts.push(`${cuts.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${cuts.length}:v=1:a=1[v][a]`);
  await ffmpeg(['-i', src, '-filter_complex', parts.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', out]);
}

/** Product integrity: only the background changes. Creator + product pixels are passed through untouched. */
// TODO(product-mask): add a dedicated product-mask lock so even matting errors can never touch product pixels.
async function compositeScene(cutPath: string, out: string, chroma: string | null, sceneImage: string): Promise<boolean> {
  if (!chroma) return false;
  await ffmpeg([
    '-i', cutPath, '-loop', '1', '-i', sceneImage,
    '-filter_complex', `[1:v]scale=720:1280,setsar=1[bg];[0:v]colorkey=${chroma}:0.07:0.03[fg];[bg][fg]overlay=shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-c:a', 'copy', out,
  ]);
  return true;
}

interface RenderOpts { video: string; ass: string; aspect: Aspect; music: string | null; musicMode: 'none' | 'bed' | 'lead'; muteVoice: boolean; voiceOverride: string | null; meta: Record<string, string>; clean: string; preview: string; duration: number }
async function renderAspect(o: RenderOpts): Promise<void> {
  const { w, h } = ASPECT_SIZES[o.aspect];
  const y = Math.round((1280 - h) * 0.22); // bias the crop upward: faces and held products sit in the upper frame
  const inputs = ['-i', o.video];
  let ai = 1;
  let voice = '[0:a]';
  if (o.voiceOverride) { inputs.push('-i', o.voiceOverride); voice = `[${ai++}:a]`; }
  let audio: string;
  if (o.music && o.musicMode !== 'none') {
    inputs.push('-stream_loop', '-1', '-i', o.music);
    const m = `[${ai++}:a]`;
    audio = o.muteVoice && !o.voiceOverride ? `${m}volume=0.9[a]` : `${voice}volume=1.0[vo];${m}volume=${o.musicMode === 'lead' ? 0.5 : 0.16}[mu];[vo][mu]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`;
  } else {
    audio = o.muteVoice && !o.voiceOverride ? `anullsrc=r=44100:cl=stereo[a]` : `${voice}anull[a]`;
  }
  const wm = `drawtext=text='TakeOne preview':fontcolor=white@0.5:fontsize=38:font=Inter:x=(w-text_w)/2:y=(h-text_h)/2:shadowcolor=black@0.4:shadowx=2:shadowy=2,drawtext=text='Unlicensed':fontcolor=white@0.35:fontsize=24:font=Inter:x=(w-text_w)/2:y=(h/2)+34`;
  const fc = `[0:v]crop=${w}:${h}:0:${y},ass='${fpath(o.ass)}',format=yuv420p,split=2[c][p0];[p0]${wm}[p];${audio};[a]atrim=duration=${o.duration.toFixed(3)},asplit=2[a1][a2]`;
  const meta = Object.entries(o.meta).flatMap(([k, v]) => ['-metadata', `${k}=${v}`]);
  const enc = ['-t', o.duration.toFixed(3), '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
  await ffmpeg([...inputs, '-filter_complex', fc, '-map', '[c]', '-map', '[a1]', ...enc, '-crf', '21', ...meta, o.clean, '-map', '[p]', '-map', '[a2]', ...enc, '-crf', '26', ...meta, o.preview]);
}

/** AI disclosure: C2PA manifest when c2patool is installed, otherwise the same facts as container metadata tags. */
async function stampSynthetic(file: string, actions: string[], workDir: string): Promise<void> {
  if (!(await hasBinary('c2patool'))) return; // tags were already written at encode time
  const manifest = path.join(workDir, 'c2pa.json');
  await writeFile(manifest, JSON.stringify({
    claim_generator: 'TakeOne/0.1',
    assertions: [{ label: 'c2pa.actions', data: { actions: actions.map((a) => ({ action: 'c2pa.edited', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia', description: a })) } }],
  }));
  const { execFile } = await import('node:child_process');
  await new Promise<void>((res) => execFile('c2patool', [file, '-m', manifest, '-o', file, '-f'], () => res()));
}

export async function runPipeline(input: PipelineInput): Promise<VariantOutput[]> {
  const { takePath, workDir, transcript, brief, llm } = input;
  await mkdir(workDir, { recursive: true });
  const info = await probe(takePath);
  const music = await ensureMusicBed(path.join(workDir, '..', 'music_bed.m4a'));
  const base = tightCuts(transcript);
  if (!base.length) throw new Error('No speech found in the take');
  const outputs: VariantOutput[] = [];

  for (const [fi, format] of input.formats.entries()) {
    const dir = path.join(workDir, format.id);
    await mkdir(dir, { recursive: true });
    await input.onProgress?.(15 + Math.round((fi / input.formats.length) * 80), `Building ${format.name}`);
    const language = format.usesDubbing ? input.dubLanguage : null;

    // hooks come only from the creator's own words (enforced in the provider prompt and the mock)
    const chosen = input.hookOverrides?.[format.id];
    const hookOptions = chosen ? [chosen.hook, ...chosen.options.filter((o) => o !== chosen.hook)] : await llm.writeHooks(format.id, transcript.text, brief, language ? LANG_NAMES[language] : undefined);
    const cuts = planCuts(format, base, hookOptions[0] ?? null);
    const duration = cuts.reduce((a, c) => a + (c.e - c.s), 0);
    const cutPath = path.join(dir, 'cut.mp4');
    await renderCut(takePath, cuts, cutPath, info.hasAudio);

    let video = cutPath;
    let synthetic = false;
    const aiActions: string[] = [];
    if (format.usesSceneReplacement) {
      const res = await input.scene.replaceBackground({ videoPath: cutPath, scenePrompt: `Bright lifestyle scene for: ${brief.target_audience}`, outDir: dir });
      const chroma = res.chromaColor ?? input.sampleWallColor;
      const scenePath = path.join(dir, 'scene.mp4');
      if (await compositeScene(res.foregroundPath, scenePath, chroma, res.backgroundPath ?? input.sceneImage)) video = scenePath;
      synthetic = true;
      aiActions.push('AI scene replacement (background only; creator and product untouched)');
    }

    let lines: Record<number, string> | undefined;
    let voiceOverride: string | null = null;
    let hookText = format.edit.hookOverlay ? hookOptions[0] ?? null : null;
    let hooks = hookOptions;
    if (format.usesDubbing && language) {
      // Opinion integrity: dubbing translates meaning only. The verdict and every claim stay the creator's own.
      const dub = await input.dubbing.dub({ videoPath: takePath, targetLanguage: language, voiceId: input.voiceId, segments: transcript.segments, outDir: dir });
      lines = Object.fromEntries(dub.segments.map((s, i) => [i, s.text]));
      if (dub.audioPath) {
        voiceOverride = path.join(dir, 'dub_cut.m4a');
        const parts = cuts.map((c, i) => `[0:a]atrim=start=${c.s.toFixed(3)}:end=${c.e.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
        await ffmpeg(['-i', dub.audioPath, '-filter_complex', `${parts.join(';')};${cuts.map((_, i) => `[a${i}]`).join('')}concat=n=${cuts.length}:v=0:a=1[a]`, '-map', '[a]', '-c:a', 'aac', voiceOverride]);
      }
      if (!chosen) hooks = dub.segments.slice(0, 3).map((s) => s.text.split(/\s+/).slice(0, 9).join(' '));
      hookText = null;
      synthetic = true;
      aiActions.push(`AI voice dubbing to ${LANG_NAMES[language] ?? language} in the creator's consented voice clone`);
    }

    const cues = buildCaptions(cuts, transcript, format.edit.captions === 'large' ? 3 : 4, lines);
    const meta: Record<string, string> = {
      title: `${input.productName} — ${format.name}`,
      comment: synthetic ? `takeone;is_synthetic=true;ai=${format.usesDubbing ? 'voice_dubbing' : 'scene_replacement'}` : 'takeone;is_synthetic=false',
      description: synthetic ? `AI-assisted: ${aiActions.join('; ')}. ${AI_DISCLOSURE_NOTE}.` : 'Edited from one creator take: cuts, captions, crop.',
    };
    const badge = format.usesDubbing && !voiceOverride ? `${LANG_NAMES[language ?? ''] ?? ''} · demo audio` : null;
    const clean = {} as Record<Aspect, string>;
    const preview = {} as Record<Aspect, string>;
    for (const aspect of ASPECTS) {
      const tag = aspect.replace(':', 'x');
      const ass = path.join(dir, `captions_${tag}.ass`);
      await writeFile(ass, buildAss(aspect, cues, hookText, format.edit.captions, badge));
      clean[aspect] = path.join(dir, `clean_${tag}.mp4`);
      preview[aspect] = path.join(dir, `preview_${tag}.mp4`);
      await renderAspect({ video, ass, aspect, music, musicMode: format.usesDubbing && !voiceOverride ? 'lead' : format.edit.music, muteVoice: format.edit.muteVoice, voiceOverride, meta, clean: clean[aspect], preview: preview[aspect], duration });
      if (synthetic) await stampSynthetic(clean[aspect], aiActions, dir);
    }
    const thumbnail = path.join(dir, 'thumb.jpg');
    await ffmpeg(['-ss', String(Math.min(1.2, duration / 2)), '-i', clean['9:16'], '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4', thumbnail]);

    const rank = await llm.rankVariant({ format: format.id, hook: hookText, transcript: transcript.text, brief, productName: input.productName, durationSeconds: Math.round(duration) });
    outputs.push({
      format: format.id, hookText, hookOptions: hooks, score: rank.score, scoreReason: rank.reason, isSynthetic: synthetic,
      aiDisclosure: synthetic ? AI_DISCLOSURE_NOTE : null, language, duration, clean, preview, thumbnail,
    });
  }
  await input.onProgress?.(96, 'Ranking variants');
  return outputs.sort((a, b) => b.score - a.score);
}

/** Sample frames (as JPEG base64) for the product-in-frame check. */
export async function sampleFrames(takePath: string, workDir: string, n = 5): Promise<{ mediaType: 'image/jpeg'; base64: string }[]> {
  const { readFile } = await import('node:fs/promises');
  await mkdir(workDir, { recursive: true });
  const { duration } = await probe(takePath);
  const frames: { mediaType: 'image/jpeg'; base64: string }[] = [];
  for (let i = 0; i < n; i++) {
    const f = path.join(workDir, `frame_${i}.jpg`);
    try {
      await ffmpeg(['-ss', ((duration * (i + 0.5)) / n).toFixed(2), '-i', takePath, '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '5', f]);
      frames.push({ mediaType: 'image/jpeg', base64: (await readFile(f)).toString('base64') });
    } catch { /* skip unreadable frame */ }
  }
  return frames;
}
void FORMATS;
