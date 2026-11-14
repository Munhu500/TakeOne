import { readFile } from 'node:fs/promises';
import type { Transcript } from '@takeone/shared';
import { useReal } from './env';

// ───────── speech-to-text ─────────
export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audioPath: string, opts: { durationSeconds: number; sidecar?: Transcript | null }): Promise<Transcript>;
}

const FILLERS = new Set(['um', 'uh', 'erm', 'like', 'basically', 'literally', 'you know', 'so', 'okay']);
export function markFillers(t: Transcript): Transcript {
  return { ...t, words: t.words.map((w) => ({ ...w, filler: w.filler ?? FILLERS.has(w.w.toLowerCase().replace(/[^a-z ]/g, '')) })) };
}

export class WhisperTranscriber implements TranscriptionProvider {
  readonly name = 'whisper';
  constructor(private apiKey: string) {}
  async transcribe(audioPath: string): Promise<Transcript> {
    const form = new FormData();
    form.append('file', new Blob([await readFile(audioPath)]), 'audio.m4a');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form });
    if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { text: string; language: string; words?: { word: string; start: number; end: number }[]; segments?: { text: string; start: number; end: number }[] };
    return markFillers({
      text: j.text,
      language: j.language,
      words: (j.words ?? []).map((w) => ({ w: w.word, s: w.start, e: w.end })),
      segments: (j.segments ?? []).map((s) => ({ text: s.text.trim(), s: s.start, e: s.end })),
    });
  }
}

const CANNED = [
  'Okay so, um, I never used to think about this.',
  'I have been using it every day for a few weeks now.',
  'It is really easy to use, and, uh, it fits into my routine.',
  'Honestly I like it, and I would buy it again.',
];
/** Uses the sample take's sidecar transcript when present; otherwise a canned review stretched over the take's length. */
export class MockTranscriber implements TranscriptionProvider {
  readonly name = 'mock';
  async transcribe(_p: string, opts: { durationSeconds: number; sidecar?: Transcript | null }): Promise<Transcript> {
    if (opts.sidecar) return markFillers(opts.sidecar);
    const dur = Math.max(4, opts.durationSeconds);
    const per = dur / CANNED.length;
    const words: Transcript['words'] = [];
    const segments = CANNED.map((text, i) => {
      const s = i * per + 0.2;
      const e = (i + 1) * per - 0.3;
      const ws = text.split(/\s+/);
      ws.forEach((w, k) => words.push({ w, s: s + ((e - s) * k) / ws.length, e: s + ((e - s) * (k + 1)) / ws.length }));
      return { text, s, e };
    });
    return markFillers({ text: CANNED.join(' '), language: 'en', words, segments });
  }
}
export function getTranscriber(env: NodeJS.ProcessEnv = process.env): TranscriptionProvider {
  return useReal(env.OPENAI_API_KEY, env) ? new WhisperTranscriber(env.OPENAI_API_KEY) : new MockTranscriber();
}

// ───────── voice dubbing ─────────
export interface DubRequest { videoPath: string; targetLanguage: string; voiceId: string | null; segments: { text: string; s: number; e: number }[]; outDir: string }
export interface DubResult {
  /** dubbed audio track, same length as the video; null = provider could not produce audio (pipeline keeps a music bed) */
  audioPath: string | null;
  /** translated caption lines aligned to the source segments. Meaning only — never a changed verdict. */
  segments: { text: string; s: number; e: number }[];
}
export interface DubbingProvider { readonly name: string; dub(req: DubRequest): Promise<DubResult> }

export class ElevenLabsDubbing implements DubbingProvider {
  readonly name = 'elevenlabs';
  constructor(private apiKey: string) {}
  async dub(req: DubRequest): Promise<DubResult> {
    const form = new FormData();
    form.append('file', new Blob([await readFile(req.videoPath)]), 'take.mp4');
    form.append('target_lang', req.targetLanguage);
    form.append('source_lang', 'auto');
    const start = await fetch('https://api.elevenlabs.io/v1/dubbing', { method: 'POST', headers: { 'xi-api-key': this.apiKey }, body: form });
    if (!start.ok) throw new Error(`ElevenLabs dubbing failed: ${start.status} ${await start.text()}`);
    const { dubbing_id } = (await start.json()) as { dubbing_id: string };
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = (await (await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}`, { headers: { 'xi-api-key': this.apiKey } })).json()) as { status: string };
      if (st.status === 'failed') throw new Error('ElevenLabs dubbing failed');
      if (st.status !== 'dubbed') continue;
      const audio = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}/audio/${req.targetLanguage}`, { headers: { 'xi-api-key': this.apiKey } });
      const { writeFile } = await import('node:fs/promises');
      const audioPath = `${req.outDir}/dub_${req.targetLanguage}.mp3`;
      await writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
      const tr = await fetch(`https://api.elevenlabs.io/v1/dubbing/${dubbing_id}/transcript/${req.targetLanguage}?format_type=srt`, { headers: { 'xi-api-key': this.apiKey } });
      return { audioPath, segments: tr.ok ? parseSrt(await tr.text()) : req.segments };
    }
    throw new Error('ElevenLabs dubbing timed out');
  }
}
function parseSrt(srt: string): DubResult['segments'] {
  const t = (x: string) => x.split(/[:,]/).map(Number).reduce((a, n, i) => a + n * [3600, 60, 1, 0.001][i]!, 0);
  return srt.split(/\r?\n\r?\n/).flatMap((b) => {
    const m = /(\d\d:\d\d:\d\d,\d+)\s*-->\s*(\d\d:\d\d:\d\d,\d+)\r?\n([\s\S]+)/.exec(b);
    return m ? [{ s: t(m[1]!), e: t(m[2]!), text: m[3]!.replace(/\r?\n/g, ' ').trim() }] : [];
  });
}

/** Pre-written translations of the sample take, keyed by language. Other takes fall back to a labelled placeholder line. */
export const SAMPLE_TRANSLATIONS: Record<string, string[]> = {
  hi: ['दोपहर तक मेरी त्वचा बहुत थकी हुई लगती थी।', 'मैं तीस दिनों से हर सुबह यह सीरम लगा रही हूँ।', 'यह हल्का है, चिपचिपा नहीं है, और सनस्क्रीन के नीचे अच्छा बैठता है।', 'सच कहूँ तो मेरी त्वचा ज़्यादा चमकदार दिखती है, और मैं इसे फिर खरीदूँगी।'],
  ar: ['كانت بشرتي تبدو متعبة جدًا بحلول الظهيرة.', 'أستخدم هذا السيروم كل صباح منذ ثلاثين يومًا.', 'إنه خفيف وغير لزج ويثبت جيدًا تحت واقي الشمس.', 'بصراحة تبدو بشرتي أكثر إشراقًا وسأشتريه مرة أخرى.'],
  ta: ['மதியத்திற்குள் என் சருமம் மிகவும் சோர்வாகத் தெரியும்.', 'முப்பது நாட்களாக தினமும் காலை இந்த சீரத்தைப் பயன்படுத்துகிறேன்.', 'இது இலகுவானது, ஒட்டாது, சன்ஸ்கிரீனுக்குக் கீழ் நன்றாக அமர்கிறது.', 'உண்மையில் என் சருமம் பிரகாசமாகத் தெரிகிறது, மீண்டும் வாங்குவேன்.'],
};
export class MockDubbing implements DubbingProvider {
  readonly name = 'mock';
  async dub(req: DubRequest): Promise<DubResult> {
    const lines = SAMPLE_TRANSLATIONS[req.targetLanguage];
    const segs = req.segments.filter((s) => s.text.trim());
    return {
      audioPath: null,
      segments: segs.map((s, i) => ({ ...s, text: lines && segs.length === lines.length ? lines[i]! : `[${req.targetLanguage.toUpperCase()}] ${s.text}` })),
    };
  }
}
export function getDubbing(env: NodeJS.ProcessEnv = process.env): DubbingProvider {
  return useReal(env.ELEVENLABS_API_KEY, env) ? new ElevenLabsDubbing(env.ELEVENLABS_API_KEY) : new MockDubbing();
}

// ───────── scene replacement ─────────
export interface SceneRequest { videoPath: string; scenePrompt: string; outDir: string }
export interface SceneResult {
  /** 'alpha' = a video with transparent background (foreground untouched) to composite over a scene; 'chroma' = key this flat colour out locally */
  kind: 'alpha' | 'chroma';
  foregroundPath: string;
  chromaColor?: string;
  backgroundPath: string | null;
}
export interface SceneProvider { readonly name: string; replaceBackground(req: SceneRequest): Promise<SceneResult> }

/** Replicate video matting (robust-video-matting). Returns a green-screen foreground; the worker composites it. */
export class ReplicateScene implements SceneProvider {
  readonly name = 'replicate';
  constructor(private token: string) {}
  async replaceBackground(req: SceneRequest): Promise<SceneResult> {
    const { writeFile } = await import('node:fs/promises');
    const data = `data:video/mp4;base64,${(await readFile(req.videoPath)).toString('base64')}`;
    const start = await fetch('https://api.replicate.com/v1/models/arielreplicate/robust_video_matting/predictions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'content-type': 'application/json', Prefer: 'wait' },
      body: JSON.stringify({ input: { input_video: data, output_type: 'green-screen' } }),
    });
    if (!start.ok) throw new Error(`Replicate failed: ${start.status} ${await start.text()}`);
    let p = (await start.json()) as { status: string; output?: string; urls: { get: string } };
    for (let i = 0; i < 120 && !['succeeded', 'failed', 'canceled'].includes(p.status); i++) {
      await new Promise((r) => setTimeout(r, 3000));
      p = (await (await fetch(p.urls.get, { headers: { Authorization: `Bearer ${this.token}` } })).json()) as typeof p;
    }
    if (p.status !== 'succeeded' || !p.output) throw new Error('Replicate matting did not finish');
    const fg = `${req.outDir}/matte.mp4`;
    await writeFile(fg, Buffer.from(await (await fetch(p.output)).arrayBuffer()));
    return { kind: 'chroma', foregroundPath: fg, chromaColor: '0x00FF00', backgroundPath: null };
  }
}
/** Demo: the sample take is shot against a flat wall, so the worker keys that colour out and drops in a pre-rendered scene. */
export class MockScene implements SceneProvider {
  readonly name = 'mock';
  async replaceBackground(req: SceneRequest): Promise<SceneResult> {
    return { kind: 'chroma', foregroundPath: req.videoPath, backgroundPath: null };
  }
}
export function getScene(env: NodeJS.ProcessEnv = process.env): SceneProvider {
  return useReal(env.REPLICATE_API_TOKEN, env) ? new ReplicateScene(env.REPLICATE_API_TOKEN) : new MockScene();
}
