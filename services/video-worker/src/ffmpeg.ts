import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';

export async function ffmpeg(args: string[]): Promise<void> {
  try {
    await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg failed: ${(err.stderr || err.message).slice(-1500)}`);
  }
}

export interface Probe { duration: number; width: number; height: number; hasAudio: boolean; comment: string }
export async function probe(path: string): Promise<Probe> {
  const { stdout } = await run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path]);
  const j = JSON.parse(stdout) as { format: { duration?: string; tags?: Record<string, string> }; streams: { codec_type: string; width?: number; height?: number; tags?: Record<string, string>; side_data_list?: { rotation?: number }[] }[] };
  const v = j.streams.find((s) => s.codec_type === 'video');
  const rot = Math.abs(Number(v?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0));
  const swap = rot === 90 || rot === 270;
  return {
    duration: Number(j.format.duration ?? 0),
    width: (swap ? v?.height : v?.width) ?? 0,
    height: (swap ? v?.width : v?.height) ?? 0,
    hasAudio: j.streams.some((s) => s.codec_type === 'audio'),
    comment: j.format.tags?.comment ?? j.format.tags?.COMMENT ?? '',
  };
}

export async function hasBinary(name: string): Promise<boolean> {
  try {
    await run('which', [name]);
    return true;
  } catch {
    return false;
  }
}

/** A soft looping music bed, synthesised once so the repo ships no licensed audio. */
export async function ensureMusicBed(path: string, seconds = 60): Promise<string> {
  if (existsSync(path)) return path;
  const chord = (f: number[], t0: number) => f.map((hz) => `0.09*sin(2*PI*${hz}*t)*exp(-3*mod(t-${t0},2))*between(mod(t,8),${t0},${t0 + 2})`).join('+');
  const expr = [chord([220, 277.18, 329.63], 0), chord([174.61, 220, 261.63], 2), chord([261.63, 329.63, 392], 4), chord([196, 246.94, 293.66], 6)].join('+');
  const beat = '0.12*sin(2*PI*55*t)*exp(-9*mod(t,1))';
  await ffmpeg(['-f', 'lavfi', '-i', `aevalsrc='${expr}+${beat}':s=44100:d=${seconds}`, '-af', 'aecho=0.8:0.7:120:0.25,lowpass=f=4200,volume=1.6', '-c:a', 'aac', '-b:a', '128k', path]);
  return path;
}

/** Escape a path for use inside an ffmpeg filter argument. */
export const fpath = (p: string) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
