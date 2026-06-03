// Generate ElevenLabs voice-over clips for the LC Connect install film.
// Reads the API key from demo/.env (gitignored). One MP3 per narration line,
// plus a durations.json so the Remotion timeline can place each line precisely.
//
//   node demo/film/gen-voiceover.mjs
//
// Swappable: change voice_id/model_id in narration.json and re-run.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(__dirname, '..', '.env');
const OUT = path.join(__dirname, 'audio');

function readEnv(k) {
  const line = fs.readFileSync(ENV, 'utf8').split('\n').find((l) => l.startsWith(k + '='));
  return line ? line.slice(k.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const KEY = readEnv('ELEVENLABS_API_KEY');
if (!KEY) { console.error('No ELEVENLABS_API_KEY in demo/.env'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'narration.json'), 'utf8'));
const VOICE = readEnv('ELEVENLABS_VOICE_ID') || cfg.voice_id;

fs.mkdirSync(OUT, { recursive: true });

function durationOf(file) {
  try {
    return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim());
  } catch { return null; }
}

async function tts(text, outFile) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: cfg.model_id || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outFile, buf);
}

const durations = {};
for (const line of cfg.lines) {
  const out = path.join(OUT, `${line.id}.mp3`);
  try {
    await tts(line.text, out);
    const d = durationOf(out);
    durations[line.id] = { scene: line.scene, dur: d, text: line.text };
    console.log(`${line.id.padEnd(12)} ${d ? d.toFixed(2) + 's' : '?'}  ${line.text.slice(0, 50)}…`);
  } catch (e) {
    console.error(`${line.id} FAILED: ${e.message}`);
  }
}
fs.writeFileSync(path.join(__dirname, 'durations.json'), JSON.stringify(durations, null, 2));
const total = Object.values(durations).reduce((s, d) => s + (d.dur || 0), 0);
console.log(`\nTotal narration: ${total.toFixed(1)}s across ${Object.keys(durations).length} lines.`);
console.log('Wrote durations.json');
