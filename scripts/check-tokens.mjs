#!/usr/bin/env node
// Fails if apps/web uses anything outside packages/design-tokens:
//   raw hex colours · rgb()/hsl() literals · Tailwind arbitrary values (`w-[13px]`) · spacing steps that are not on the 4pt scale ·
//   Tailwind's stock palette (text-white, bg-zinc-900…) · stock font sizes / radii / shadows · emoji · external font hosts.
// A line can opt out with a `tokens-allow: <reason>` comment; a file with `tokens-allow-file: <reason>`. Both are listed in the output.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'apps/web/src');
const SPACE = '(?:0|px|1|2|3|4|5|6|8|12|16|24|32|auto|full)';
const RULES = [
  ['raw hex colour', /(?<![&\w])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?!;)/g],
  ['colour function literal', /\b(?:rgba?|hsla?|oklch|color-mix)\(\s*(?!var\()[\d.]/g],
  ['arbitrary Tailwind value', /(?<=[\s"'`:])-?[a-z][a-z0-9-]*-\[(?!\s)[^\]\n]+\](?!:)/g],
  ['spacing off the 4pt scale', new RegExp(`(?<=[\\s"'\`:])-?(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap-x|gap-y|gap|space-x|space-y)-(?!${SPACE}(?![\\w.])|[xy]-)[\\w./]+`, 'g')],
  ['stock Tailwind palette', /(?<=[\s"'`:])(?:text|bg|border|ring|fill|stroke|divide|outline|from|to|via|accent|decoration|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d+)?\b/g],
  ['opacity modifier on a colour (use a -soft token)', /(?<=[\s"'`:])(?:text|bg|border|ring|fill|stroke|divide)-[a-z0-9-]+\/\d+\b/g],
  ['stock font size (use the type scale)', /(?<=[\s"'`:])text-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g],
  ['stock radius (use sm/md/lg/xl/full)', /(?<=[\s"'`:])rounded(?:-[trblse]{1,2})?(?:-(?:2xl|3xl))?(?=[\s"'`])/g],
  ['shadow other than float', /(?<=[\s"'`:])(?:drop-)?shadow-(?!float\b|none\b)[a-z0-9]+/g],
  ['gradient / glow utility', /(?<=[\s"'`:])(?:bg-gradient-to-[a-z]+|from-[a-z]+|via-[a-z]+|blur-(?!locked\b)[a-z0-9]+)/g],
  ['font weight outside 400/500/600', /(?<=[\s"'`:])font-(?:thin|extralight|light|bold|extrabold|black)\b/g],
  ['external font host', /fonts\.googleapis|fonts\.gstatic|fontshare|typekit/g],
  ['emoji in UI', /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{FE0F}]|[\u{1F1E6}-\u{1F1FF}]{2}/gu],
  ['inline pixel font size', /fontSize:\s*['"]?\d/g],
];
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) { if (f !== 'fonts') walk(p); } else if (/\.(tsx?|css)$/.test(f)) files.push(p); } })(SRC);

const problems = [], allowed = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const text = readFileSync(file, 'utf8');
  const fileAllow = /tokens-allow-file:\s*(.+?)(?:\*\/|$)/m.exec(text);
  if (fileAllow) { allowed.push(`${rel}: ${fileAllow[1].trim()}`); continue; }
  text.split('\n').forEach((line, i) => {
    const allow = /tokens-allow:\s*(.+?)(?:\*\/|\}|$)/.exec(line);
    for (const [label, re] of RULES) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (!m) continue;
      if (allow) allowed.push(`${rel}:${i + 1}: ${allow[1].trim()}`); else problems.push(`${rel}:${i + 1}  ${label}: ${m[0]}`);
    }
  });
}
if (allowed.length) console.log(`Allowed exceptions (${new Set(allowed).size}):\n  ${[...new Set(allowed)].join('\n  ')}`);
if (problems.length) { console.error(`\ncheck:tokens failed — ${problems.length} use(s) of values outside packages/design-tokens:\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log(`check:tokens passed — ${files.length} files in apps/web/src use only design tokens.`);
