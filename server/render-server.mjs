import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

const PORT = Number(process.env.RENDER_PORT || 4321);
const ROOT_DIR = process.cwd();
const SFX_DIR = path.join(ROOT_DIR, 'assets', 'sfx');
const AE_SFX_DIR = path.join(SFX_DIR, 'ae');
const PRESETS_DIR = path.join(ROOT_DIR, 'assets', 'presets');
const APPLE_GLASS_PRESET = path.join(PRESETS_DIR, 'apple-glass-card.png');
const RENDERS_DIR = path.join(ROOT_DIR, 'renders');
const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';
const EFFECTCRAFT_BIN = process.env.EFFECTCRAFT_PATH || 'E:\\latihan\\AE\\effectcraft-x64\\effectcraft-cli.exe';

const HALAL_SFX_CATALOG = [
  {
    id: 'none',
    name: 'Tanpa SFX (Hening / Suara Saja)',
    category: 'none',
    description: 'Hanya narasi suara Anda tanpa efek suara tambahan.',
    halalNote: 'Aman mutlak — nol audio tambahan.',
  },
  {
    id: 'ae_swoosh_lembut',
    name: 'Swoosh Lembut (Koleksi AE)',
    category: 'transisi',
    file: path.join(AE_SFX_DIR, 'sfx_swoosh_lembut.mp3'),
    description: 'Transisi hembusan lembut dari folder E:\\latihan\\AE\\sfx.',
    halalNote: 'Hanya suara hembusan angin/transisi non-musikal.',
  },
  {
    id: 'ae_whoosh_fast',
    name: 'Whoosh Cepat (Koleksi AE)',
    category: 'transisi',
    file: path.join(AE_SFX_DIR, 'whoosh_fast.mp3'),
    description: 'Transisi cepat bergaya video Apple/tech.',
    halalNote: 'Hanya efek gerakan udara cepat (non-musikal).',
  },
  {
    id: 'ae_pop_click',
    name: 'Pop Click (Koleksi AE)',
    category: 'tech',
    file: path.join(AE_SFX_DIR, 'pop_click.mp3'),
    description: 'Klik singkat untuk munculnya fitur/teks.',
    halalNote: 'Klik benda singkat tanpa nada melodi.',
  },
  {
    id: 'ae_pop_muncul',
    name: 'Pop Muncul (Koleksi AE)',
    category: 'transisi',
    file: path.join(AE_SFX_DIR, 'sfx_pop_muncul.mp3'),
    description: 'Letupan pop singkat saat kartu atau CTA muncul.',
    halalNote: 'Efek pop non-alat musik.',
  },
  {
    id: 'ae_impact_slam',
    name: 'Impact Slam (Koleksi AE)',
    category: 'transisi',
    file: path.join(AE_SFX_DIR, 'impact_slam.mp3'),
    description: 'Hentakan berat untuk hook pembuka atau judul besar.',
    halalNote: 'Efek benturan fisik non-melodik.',
  },
  {
    id: 'ae_langkah_sepatu',
    name: 'Langkah Sepatu (Koleksi AE)',
    category: 'home',
    file: path.join(AE_SFX_DIR, 'sfx_langkah_sepatu.mp3'),
    description: 'Suara langkah alami untuk B-roll rumah/aktivitas.',
    halalNote: 'Foley langkah alami.',
  },
  {
    id: 'soft-whoosh',
    name: 'Soft Air Whoosh (Built-in)',
    category: 'transisi',
    description: 'Hembusan udara lembut untuk perpindahan adegan.',
    halalNote: 'White-noise tersaring (non-musikal, tanpa nada/instrumen).',
  },
  {
    id: 'mech-click',
    name: 'Mechanical Switch Click (Built-in)',
    category: 'tech',
    description: 'Suara klik tombol mekanik untuk gadget & elektronik.',
    halalNote: 'Impuls mekanik singkat (suara benda).',
  },
  {
    id: 'desk-tap',
    name: 'Wood Desk Tap (Built-in)',
    category: 'home',
    description: 'Ketukan meja kayu halus untuk penekanan poin fitur.',
    halalNote: 'Ketukan benda non-melodik.',
  },
  {
    id: 'box-rustle',
    name: 'Unboxing Box Rustle (Built-in)',
    category: 'unboxing',
    description: 'Gesekan kertas/kardus ringan saat buka kemasan produk.',
    halalNote: 'Tekstur gesekan kertas/kardus (foley alami).',
  },
  {
    id: 'shutter-snap',
    name: 'Camera Shutter Snap (Built-in)',
    category: 'tech',
    description: 'Klik rana kamera untuk pergantian foto detail produk.',
    halalNote: 'Suara rana mekanik.',
  },
  {
    id: 'air-pop',
    name: 'Air Puff Pop (Built-in)',
    category: 'transisi',
    description: 'Letupan udara halus tanpa nada untuk munculnya CTA.',
    halalNote: 'Impuls udara tersaring (bukan nada lonceng/musik).',
  },
];

const SFX_BLACKLIST_RE = /\b(beatbox|xilofon|xylophone|piano|guitar|drum|chord|melody|song|musik|music|instrument|chime|bell|ting)\b/i;
const SFX_REVIEW_FOLDERS = new Set(['money', 'risers', 'ui sound effects', 'data collect']);
const AUDIO_EXTS = new Set(['.wav', '.mp3', '.ogg', '.m4a', '.wma', '.aac']);

async function getDynamicSfxCatalog() {
  const catalog = [...HALAL_SFX_CATALOG];
  const existingFiles = new Set(
    catalog.filter((c) => c.file).map((c) => path.resolve(c.file).toLowerCase()),
  );
  // Also mark built-in root WAVs as registered
  for (const item of HALAL_SFX_CATALOG) {
    if (item.id !== 'none' && !item.file) {
      existingFiles.add(path.resolve(path.join(SFX_DIR, `${item.id}.wav`)).toLowerCase());
    }
  }

  const blockedNames = [];
  const walk = async (dir) => {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (!AUDIO_EXTS.has(ext)) continue;
      if (existingFiles.has(path.resolve(full).toLowerCase())) continue;

      if (SFX_BLACKLIST_RE.test(ent.name)) {
        blockedNames.push(ent.name);
        continue;
      }

      const rel = path.relative(SFX_DIR, full);
      const topFolder = rel.includes(path.sep) ? rel.split(path.sep)[0] : 'lainnya';
      const id = `custom_${Buffer.from(rel).toString('base64url')}`;
      const baseName = path.basename(ent.name, ext).replace(/[_-]+/g, ' ').trim();
      const needsReview = SFX_REVIEW_FOLDERS.has(topFolder.toLowerCase());

      catalog.push({
        id,
        name: baseName,
        category: topFolder,
        safety: needsReview ? 'review' : 'safe',
        file: full,
        description: `File lokal: assets/sfx/${rel.replace(/\\/g, '/')}`,
        halalNote: needsReview
          ? `Kategori "${topFolder}" — dengarkan dulu untuk memastikan tidak bernada musik/lonceng.`
          : `Foley non-musikal dari folder "${topFolder}".`,
      });
    }
  };

  await walk(SFX_DIR);
  return { items: catalog, blockedNames };
}

async function resolveSfxFilePath(sfxId) {
  if (!sfxId || sfxId === 'none') return null;
  if (sfxId.startsWith('custom_')) {
    try {
      const rel = Buffer.from(sfxId.slice('custom_'.length), 'base64url').toString('utf-8');
      const full = path.resolve(SFX_DIR, rel);
      const rootResolved = path.resolve(SFX_DIR) + path.sep;
      if (!full.startsWith(rootResolved)) return null;
      if (SFX_BLACKLIST_RE.test(path.basename(full))) return null;
      return fsSync.existsSync(full) ? full : null;
    } catch {
      return null;
    }
  }
  const entry = HALAL_SFX_CATALOG.find((s) => s.id === sfxId && s.id !== 'none');
  if (!entry) return null;
  if (entry.file && fsSync.existsSync(entry.file)) return entry.file;
  const fallbackWav = path.join(SFX_DIR, `${entry.id}.wav`);
  return fsSync.existsSync(fallbackWav) ? fallbackWav : null;
}

function writePcmWav(filePath, samples, sampleRate = 44100) {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return fs.writeFile(filePath, buffer);
}

function createNoiseGenerator(seed = 1337) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return (s / 0xffffffff) * 2 - 1;
  };
}

function lowPassFilter(input, alpha) {
  const out = new Float32Array(input.length);
  let prev = 0;
  for (let i = 0; i < input.length; i++) {
    prev = prev + alpha * (input[i] - prev);
    out[i] = prev;
  }
  return out;
}

function highPassFilter(input, alpha) {
  const out = new Float32Array(input.length);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < input.length; i++) {
    prevOut = alpha * (prevOut + input[i] - prevIn);
    prevIn = input[i];
    out[i] = prevOut;
  }
  return out;
}

async function ensureHalalSfxLibrary() {
  await fs.mkdir(SFX_DIR, { recursive: true });
  await fs.mkdir(RENDERS_DIR, { recursive: true });
  const sr = 44100;

  // 1. soft-whoosh.wav (0.42s non-tonal filtered air sweep)
  {
    const file = path.join(SFX_DIR, 'soft-whoosh.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.42);
      const rand = createNoiseGenerator(101);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.sin(Math.PI * t) ** 1.6;
        raw[i] = rand() * env * 0.65;
      }
      const band = lowPassFilter(highPassFilter(raw, 0.92), 0.14);
      await writePcmWav(file, band, sr);
    }
  }

  // 2. mech-click.wav (0.09s crisp mechanical switch click)
  {
    const file = path.join(SFX_DIR, 'mech-click.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.09);
      const rand = createNoiseGenerator(202);
      const out = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env1 = Math.exp(-t * 180);
        const env2 = t > 0.018 ? Math.exp(-(t - 0.018) * 240) * 0.55 : 0;
        out[i] = rand() * (env1 + env2) * 0.85;
      }
      const crisp = highPassFilter(lowPassFilter(out, 0.55), 0.78);
      await writePcmWav(file, crisp, sr);
    }
  }

  // 3. desk-tap.wav (0.14s dull wood table knock, strictly non-melodic)
  {
    const file = path.join(SFX_DIR, 'desk-tap.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.14);
      const rand = createNoiseGenerator(303);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const thump = Math.exp(-t * 65);
        raw[i] = rand() * thump * 0.95;
      }
      const warm = lowPassFilter(lowPassFilter(raw, 0.06), 0.08);
      await writePcmWav(file, warm, sr);
    }
  }

  // 4. box-rustle.wav (0.35s light cardboard/paper rustle)
  {
    const file = path.join(SFX_DIR, 'box-rustle.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.35);
      const rand = createNoiseGenerator(404);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const burst = (Math.sin(t * Math.PI * 3) ** 2) * (1 - t * 0.4);
        raw[i] = rand() * burst * 0.5;
      }
      const crinkle = highPassFilter(lowPassFilter(raw, 0.42), 0.85);
      await writePcmWav(file, crinkle, sr);
    }
  }

  // 5. shutter-snap.wav (0.12s dual micro-transient camera shutter)
  {
    const file = path.join(SFX_DIR, 'shutter-snap.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.12);
      const rand = createNoiseGenerator(505);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const c1 = Math.exp(-t * 280);
        const c2 = t > 0.032 ? Math.exp(-(t - 0.032) * 260) * 0.85 : 0;
        raw[i] = rand() * (c1 + c2) * 0.85;
      }
      const snap = highPassFilter(lowPassFilter(raw, 0.6), 0.72);
      await writePcmWav(file, snap, sr);
    }
  }

  // 6. air-pop.wav (0.08s filtered air impulse without tonal pitch)
  {
    const file = path.join(SFX_DIR, 'air-pop.wav');
    if (!fsSync.existsSync(file)) {
      const len = Math.floor(sr * 0.08);
      const rand = createNoiseGenerator(606);
      const raw = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        raw[i] = rand() * Math.exp(-t * 95) * 0.9;
      }
      const puff = lowPassFilter(highPassFilter(raw, 0.9), 0.18);
      await writePcmWav(file, puff, sr);
    }
  }
}

function runProcess(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited with code ${code}: ${stderr.slice(-1600)}`));
    });
  });
}

async function getMediaDuration(filePath) {
  try {
    const { stdout } = await runProcess(
      FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      path.dirname(filePath),
    );
    const val = Number.parseFloat(stdout.trim());
    return Number.isFinite(val) && val > 0 ? val : 0;
  } catch {
    return 0;
  }
}

function formatAssTime(seconds) {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function wrapSubtitleChunks(text, maxWordsPerChunk = 15) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  // Keep normal sentences (<= maxWordsPerChunk) in a single steady 2-line card so there is never an orphan 1-word tail
  if (words.length <= maxWordsPerChunk) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    return [line2 ? `${line1}\\N${line2}` : line1];
  }
  // If longer, split into 2 balanced halves
  const half = Math.ceil(words.length / 2);
  return [words.slice(0, half), words.slice(half)].map((slice) => {
    const mid = Math.ceil(slice.length / 2);
    const line1 = slice.slice(0, mid).join(' ');
    const line2 = slice.slice(mid).join(' ');
    return line2 ? `${line1}\\N${line2}` : line1;
  });
}

function escapeAssText(text) {
  return text.replace(/\{/g, '(').replace(/\}/g, ')').replace(/\r?\n/g, ' ');
}

function buildAssSubtitleFile(timelineEntries, captionStyle = 'apple-kinetic') {
  const isApple = captionStyle === 'apple-kinetic';
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,60,&H00FFFFFF,&H0000FFFF,&H00101418,&H96000000,-1,0,0,0,100,100,0,0,1,5,2,2,70,70,310,1
Style: AppleHero,Inter,64,&H00FFFFFF,&H0000FFFF,&H000B1412,&H00000000,-1,0,0,0,100,100,-1,0,1,2,3,2,95,95,515,1
Style: AppleSub,Inter,42,&H00F2FBF8,&H0000FFFF,&H000B1412,&H00000000,-1,0,0,0,100,100,0,0,1,2,2,2,100,100,388,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = [];
  for (const entry of timelineEntries) {
    if (isApple && entry.kineticText) {
      const heroEnd = Math.min(entry.endSec, entry.startSec + Math.max(1.2, entry.endSec - entry.startSec));
      const anim = '{\\fad(180,140)\\fscx86\\fscy86\\t(0,220,\\fscx100\\fscy100)}';
      events.push(
        `Dialogue: 1,${formatAssTime(entry.startSec)},${formatAssTime(heroEnd)},AppleHero,,0,0,0,,${anim}${escapeAssText(entry.kineticText)}`,
      );
    }

    if (!entry.captionText) continue;
    const chunks = wrapSubtitleChunks(escapeAssText(entry.captionText), 15);
    if (chunks.length === 0) continue;
    const total = Math.max(0.5, entry.endSec - entry.startSec);
    const perChunk = total / chunks.length;
    for (let i = 0; i < chunks.length; i++) {
      const start = entry.startSec + i * perChunk;
      const end = i === chunks.length - 1 ? entry.endSec : entry.startSec + (i + 1) * perChunk;
      const styleName = isApple ? 'AppleSub' : 'Default';
      const fadeTag = isApple ? '{\\fad(140,110)}' : '';
      events.push(`Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},${styleName},,0,0,0,,${fadeTag}${chunks[i]}`);
    }
  }
  return header + events.join('\n') + '\n';
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(raw);
}

function normalizeChatCompletionsUrl(rawBaseUrl) {
  const trimmed = String(rawBaseUrl || '').trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Base URL harus menggunakan http:// atau https://');
  }
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  if (trimmed.endsWith('/v1') || trimmed.endsWith('/openai')) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

async function handleAiChatProxy(req, res) {
  try {
    const body = await readJsonBody(req);
    const { baseUrl, apiKey, model, messages, temperature = 0.7 } = body;
    if (!baseUrl || !model || !Array.isArray(messages)) {
      return sendJson(res, 400, { error: 'baseUrl, model, dan messages wajib diisi.' });
    }

    const endpoint = normalizeChatCompletionsUrl(baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && String(apiKey).trim()) {
      headers.Authorization = `Bearer ${String(apiKey).trim()}`;
    }

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature }),
    });

    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!upstream.ok) {
      return sendJson(res, upstream.status, {
        error: parsed?.error?.message || `Upstream error (${upstream.status})`,
        details: parsed,
        endpoint,
      });
    }

    return sendJson(res, 200, { endpoint, data: parsed });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractMetaTag(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeHtmlEntities(m[1]) : '';
}

async function fetchImageAsDataUrl(imageUrl) {
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 6 * 1024 * 1024) return null;
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    return {
      dataUrl: `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`,
      filename: `produk-link.${ext}`,
    };
  } catch {
    return null;
  }
}

function detectCategoryFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (
    /\b(mic|microphone|wireless|bluetooth|tws|earphone|headset|powerbank|charger|kabel|usb|laptop|keyboard|mouse|kamera|tripod|speaker|led|smart|gadget|hdmi|ssd|wifi|vlog)\b/.test(
      lower,
    )
  ) {
    return 'tech';
  }
  if (
    /\b(fryer|vacuum|dapur|rak|sapu|pel|blender|dispenser|kompor|panci|wajan|rumah|kamar|kasur|bantal|sabun|cuci|setrika)\b/.test(
      lower,
    )
  ) {
    return 'home';
  }
  return '';
}

function extractTitleFromUrl(parsedUrl) {
  try {
    const segs = parsedUrl.pathname
      .split('/')
      .map((s) => decodeURIComponent(s))
      .filter(Boolean);
    if (segs.length === 0) return { title: '', category: '' };
    // Shopee pattern: /Product-Name-Here-i.12345.67890 or Tokopedia: /shop/product-name-here
    let candidate = segs[segs.length - 1];
    candidate = candidate.replace(/-i\.\d+\.\d+$/i, '').replace(/\.[a-z0-9]{2,5}$/i, '');
    const cleaned = candidate.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 4 || /^\d+$/.test(cleaned)) {
      return { title: '', category: '' };
    }
    return {
      title: cleaned.slice(0, 110),
      category: detectCategoryFromText(cleaned),
    };
  } catch {
    return { title: '', category: '' };
  }
}

function collectProductImageCandidates(html, origin, initialUrls) {
  const seenKeys = new Set();
  const results = [];

  const pushUrl = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    let url = decodeHtmlEntities(raw).replace(/\\u002F/g, '/').replace(/\\/g, '');
    if (url.startsWith('//')) url = `https:${url}`;
    else if (url.startsWith('/')) url = `${origin}${url}`;
    if (!/^https?:\/\//i.test(url)) return;

    const lower = url.toLowerCase();
    if (
      lower.includes('logo') ||
      lower.includes('icon') ||
      lower.includes('favicon') ||
      lower.includes('avatar') ||
      lower.includes('badge') ||
      lower.includes('sprite') ||
      lower.includes('placeholder') ||
      lower.includes('100-square') ||
      lower.endsWith('.svg')
    ) {
      return;
    }

    // Deduplicate same CDN asset across different resize tokens
    const dedupeKey = url.split('?')[0].split('~')[0].replace(/\/cache\/\d+\//, '/cache/X/');
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    results.push(url);
  };

  for (const u of initialUrls) pushUrl(u);

  // Extract gallery image URLs embedded in HTML or hydration JSON (e.g. Tokopedia/e-commerce CDNs)
  const cdnMatches = html.matchAll(
    /https?:\/\/[^"'\s<>\\]+?(?:tokopedia-static\.net|tokopedia\.net\/img|alicdn\.com|shopify\.com\/s\/files)[^"'\s<>\\]+?\.(?:jpe?g|png|webp)(?:[^"'\s<>\\]*)?/gi,
  );
  for (const m of cdnMatches) {
    pushUrl(m[0]);
    if (results.length >= 6) break;
  }

  return results.slice(0, 5);
}

async function handleFetchProduct(req, res) {
  try {
    const body = await readJsonBody(req);
    const rawUrl = String(body?.url || '').trim();
    if (!rawUrl) {
      return sendJson(res, 400, { error: 'Masukkan URL produk terlebih dahulu.' });
    }
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return sendJson(res, 400, { error: 'URL harus diawali http:// atau https://' });
    }

    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.startsWith('image/')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > 0 && buf.length <= 6 * 1024 * 1024) {
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        return sendJson(res, 200, {
          ok: true,
          blocked: false,
          title: '',
          description: '',
          priceText: '',
          imageDataUrl: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
          imageFilename: `produk-url.${ext}`,
          sourceUrl: parsed.toString(),
        });
      }
    }

    const slugHint = extractTitleFromUrl(parsed);

    if (!upstream.ok) {
      return sendJson(res, 200, {
        ok: false,
        blocked: true,
        status: upstream.status,
        suggestedTitle: slugHint.title,
        suggestedCategory: slugHint.category,
        message:
          'Marketplace membatasi pembacaan otomatis (butuh sesi login browser). Klik kanan foto di tab Shopee/TikTok Anda → Copy Image → tekan Ctrl+V di studio ini, atau klik tombol Upload Media.',
      });
    }

    const html = await upstream.text();
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = extractMetaTag(html, 'og:title') || (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1]) : '');
    const description =
      extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description') || '';
    const ogImage = extractMetaTag(html, 'og:image') || extractMetaTag(html, 'twitter:image');
    let priceAmount =
      extractMetaTag(html, 'product:price:amount') || extractMetaTag(html, 'og:price:amount');

    // Parse JSON-LD Product schema if available
    let jsonLdName = '';
    let jsonLdDesc = '';
    const jsonLdImages = [];
    const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of ldMatches) {
      try {
        const obj = JSON.parse(m[1].trim());
        const candidates = Array.isArray(obj) ? obj : [obj];
        for (const item of candidates) {
          if (item && (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product')))) {
            if (!jsonLdName && item.name) jsonLdName = String(item.name);
            if (!jsonLdDesc && item.description) jsonLdDesc = String(item.description);
            if (item.image) {
              const list = Array.isArray(item.image) ? item.image : [item.image];
              for (const img of list) {
                jsonLdImages.push(typeof img === 'string' ? img : String(img?.url || ''));
              }
            }
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (!priceAmount && offer?.price) priceAmount = String(offer.price);
          }
        }
      } catch {
        // ignore invalid JSON-LD
      }
    }

    const cleanedTitle = (jsonLdName || rawTitle).replace(/^(?:Promo|Jual)\s+/i, '').trim();
    const lowerTitle = cleanedTitle.toLowerCase();
    const looksBlocked =
      !cleanedTitle ||
      lowerTitle.includes('captcha') ||
      lowerTitle.includes('just a moment') ||
      lowerTitle.includes('access denied') ||
      lowerTitle.includes('robot') ||
      (lowerTitle === 'shopee indonesia' && !description);

    if (looksBlocked) {
      return sendJson(res, 200, {
        ok: false,
        blocked: true,
        suggestedTitle: slugHint.title,
        suggestedCategory: slugHint.category,
        message:
          'Marketplace membatasi pembacaan otomatis (butuh sesi login browser). Klik kanan foto di tab Shopee/TikTok Anda → Copy Image → tekan Ctrl+V di studio ini, atau klik tombol Upload Media.',
      });
    }

    // Extract rich product description from Tokopedia PDP body (lblPDPDescriptionProduk) if available
    let pdpBodyDesc = '';
    const pdpMatch = html.match(/data-testid=["']lblPDPDescriptionProduk["'][^>]*>([\s\S]*?)<\/div>/i);
    if (pdpMatch?.[1]) {
      const lines = decodeHtmlEntities(
        pdpMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, ' '),
      )
        .split(/\r?\n/)
        .map((l) => l.replace(/^[•\-*]+\s*/, '').replace(/\s+/g, ' ').trim())
        .filter(
          (l) =>
            l.length > 3 &&
            !/^(?:highlight product|specifications?|spesifikasi|isi paket|barang baru)/i.test(l),
        );
      if (lines.length > 0) {
        pdpBodyDesc = lines.slice(0, 7).join(', ');
      }
    }

    const rawCandidateDesc = pdpBodyDesc || jsonLdDesc || description;
    const cleanedDesc = rawCandidateDesc
      .replace(/^Promo\s+.+?\s+di\s+.+?\.\s*Promo khusus pengguna baru[^!.]*[!.]?\s*/i, '')
      .trim();

    const imageCandidates = collectProductImageCandidates(html, parsed.origin, [...jsonLdImages, ogImage]);
    const fetchedImages = (
      await Promise.all(imageCandidates.map((imgUrl) => fetchImageAsDataUrl(imgUrl)))
    ).filter(Boolean);

    const formattedPrice = priceAmount
      ? /^\d+([.,]\d+)?$/.test(priceAmount)
        ? `Rp ${Number(priceAmount.replace(/[^\d]/g, '')).toLocaleString('id-ID')}`
        : priceAmount
      : '';

    const suggestedCategory = detectCategoryFromText(`${cleanedTitle} ${cleanedDesc}`) || slugHint.category;

    return sendJson(res, 200, {
      ok: true,
      blocked: false,
      title: cleanedTitle.slice(0, 120),
      description: (cleanedDesc || rawCandidateDesc).slice(0, 340),
      priceText: formattedPrice,
      suggestedCategory,
      images: fetchedImages,
      imageDataUrl: fetchedImages[0]?.dataUrl || null,
      imageFilename: fetchedImages[0]?.filename || null,
      sourceUrl: parsed.toString(),
    });
  } catch (err) {
    return sendJson(res, 200, {
      ok: false,
      blocked: true,
      message: `Gagal membaca link produk (${err instanceof Error ? err.message : String(err)}). Anda tetap bisa isi detail produk atau unggah foto langsung.`,
    });
  }
}

function wrapPlainMultiline(text, maxWordsPerLine = 6) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length <= maxWordsPerLine) return words.join(' ');
  const mid = Math.ceil(words.length / 2);
  return `${words.slice(0, mid).join(' ')}\n${words.slice(mid).join(' ')}`;
}

async function renderAeHookVideoWithEffectCraft({ scene, visualPath, durationSec, burnSubtitles, tempDir }) {
  if (!fsSync.existsSync(EFFECTCRAFT_BIN)) return null;
  const ecprojPath = path.join(tempDir, 'hook_ae_scene0.ecproj');
  const jsxPath = path.join(tempDir, 'hook_ae_scene0.jsx');
  const rawHookMp4 = path.join(tempDir, 'hook_ae_raw.mp4');
  const dur = Number(Math.max(2.5, durationSec).toFixed(2));

  const runArgs = [
    '--empty',
    '--save-as',
    ecprojPath,
    'run',
    'comp.new',
    JSON.stringify({ name: 'AE_Hook', width: 1080, height: 1920, frameRate: 30, duration: dur }),
    'layer.newSolid',
    JSON.stringify({ name: 'BG_DARK', color: '#07110F', width: 1080, height: 1920 }),
    'layer.newShape',
    JSON.stringify({
      name: 'GLOW_ORB_TOP',
      kind: 'ellipse',
      size: [820, 820],
      fill: '#0D7A6F',
      fillOpacity: 32,
      strokeWidth: 0,
      position: [540, 690],
    }),
    'layer.newShape',
    JSON.stringify({
      name: 'PRODUCT_FRAME_BG',
      kind: 'rounded',
      size: [790, 830],
      fill: '#10211E',
      fillOpacity: 86,
      stroke: '#2DD4BF',
      strokeOpacity: 68,
      strokeWidth: 3,
      position: [540, 700],
    }),
  ];

  if (visualPath && fsSync.existsSync(visualPath)) {
    runArgs.push('file.import', JSON.stringify({ paths: [visualPath], addToComp: true }));
  }

  runArgs.push(
    'layer.newShape',
    JSON.stringify({
      name: 'LEFT_EDGE',
      kind: 'rect',
      size: [14, 1920],
      fill: '#2DD4BF',
      fillOpacity: 85,
      strokeWidth: 0,
      position: [7, 960],
    }),
    'layer.newShape',
    JSON.stringify({
      name: 'RIGHT_EDGE',
      kind: 'rect',
      size: [14, 1920],
      fill: '#2DD4BF',
      fillOpacity: 85,
      strokeWidth: 0,
      position: [1073, 960],
    }),
    'layer.newShape',
    JSON.stringify({
      name: 'TOP_PILL_BG',
      kind: 'rounded',
      size: [480, 66],
      fill: '#102622',
      fillOpacity: 92,
      stroke: '#2DD4BF',
      strokeOpacity: 95,
      strokeWidth: 3,
      position: [540, 165],
    }),
    'layer.newText',
    JSON.stringify({
      name: 'TOP_PILL_TXT',
      text: '⚡ HOOK · WAJIB TAHU',
      font: 'Inter',
      style: 'Bold',
      size: 28,
      fill: '#5EEAD4',
      justify: 'center',
      position: [540, 175],
    }),
  );

  if (burnSubtitles) {
    runArgs.push(
      'layer.newShape',
      JSON.stringify({
        name: 'GLASS_CARD',
        kind: 'rounded',
        size: [956, 360],
        fill: '#0D1B18',
        fillOpacity: 88,
        stroke: '#FFFFFF',
        strokeOpacity: 62,
        strokeWidth: 3,
        position: [540, 1410],
      }),
      'layer.newShape',
      JSON.stringify({
        name: 'ACCENT_BAR',
        kind: 'rounded',
        size: [520, 10],
        fill: '#FACC15',
        fillOpacity: 100,
        strokeWidth: 0,
        position: [540, 1388],
      }),
      'layer.newText',
      JSON.stringify({
        name: 'HOOK_HERO',
        text: scene.kineticText || 'PILIHAN TEPAT',
        font: 'Inter',
        style: 'Bold',
        size: 64,
        fill: '#FFFFFF',
        justify: 'center',
        position: [540, 1348],
      }),
      'layer.newText',
      JSON.stringify({
        name: 'HOOK_SUB',
        text: wrapPlainMultiline(scene.voiceText || '', 6),
        font: 'Inter',
        style: 'Bold',
        size: 38,
        leading: 50,
        fill: '#E8F8F4',
        justify: 'center',
        position: [540, 1455],
      }),
    );
  }

  runArgs.push(
    'layer.newShape',
    JSON.stringify({
      name: 'SWEEP_WIPE',
      kind: 'rect',
      size: [1080, 1920],
      fill: '#2DD4BF',
      fillOpacity: 95,
      strokeWidth: 0,
      position: [-540, 960],
    }),
  );

  await runProcess(EFFECTCRAFT_BIN, runArgs, tempDir);

  const jsxCode = `
(function() {
  var p = app.project;
  var comp = null;
  for (var i = 1; i <= p.items.length; i++) {
    if (p.items[i].name === "AE_Hook") { comp = p.items[i]; break; }
  }
  if (!comp) return;
  comp.openInViewer();

  function findLayer(name) {
    for (var i = 1; i <= comp.layers.length; i++) {
      if (comp.layers[i].name === name) return comp.layers[i];
    }
    return null;
  }
  function ease(prop, idx, influence) {
    try { prop.setTemporalEaseAtKey(idx, [new KeyframeEase(0, influence)], [new KeyframeEase(0, influence)]); } catch(e) {}
  }
  function key(prop, t, v) {
    prop.setValueAtTime(t, v);
    ease(prop, prop.numKeys, 80);
  }
  function popIn(name, t, scaleFrom, dy) {
    var l = findLayer(name);
    if (!l) return;
    var tr = l.property("Transform");
    var pos = tr.property("Position"), sc = tr.property("Scale"), op = tr.property("Opacity");
    var base = pos.value;
    key(op, t, 0); key(op, t + 0.14, 100);
    key(pos, t, [base[0], base[1] + dy]); key(pos, t + 0.36, base);
    key(sc, t, [scaleFrom, scaleFrom]); key(sc, t + 0.32, [105, 105]); key(sc, t + 0.48, [100, 100]);
  }

  for (var i = 1; i <= comp.layers.length; i++) {
    var lyr = comp.layers[i];
    if (lyr.name.indexOf("visual_") !== -1 || lyr.name.indexOf(".png") !== -1 || lyr.name.indexOf(".jpg") !== -1 || lyr.name.indexOf(".jpeg") !== -1 || lyr.name.indexOf(".webp") !== -1) {
      var tr = lyr.property("Transform");
      var pos = tr.property("Position"), sc = tr.property("Scale"), op = tr.property("Opacity");
      var w = lyr.width || 800, h = lyr.height || 800;
      var fitScale = Math.min(730 / w, 770 / h) * 100;
      pos.setValue([540, 700]);
      key(op, 0.05, 0); key(op, 0.22, 100);
      key(pos, 0.05, [540, 790]); key(pos, 0.42, [540, 700]);
      key(sc, 0.05, [fitScale * 0.78, fitScale * 0.78]);
      key(sc, 0.38, [fitScale * 1.04, fitScale * 1.04]);
      key(sc, 0.54, [fitScale, fitScale]);
      key(sc, ${Math.max(1.5, dur - 0.1).toFixed(2)}, [fitScale * 1.08, fitScale * 1.08]);
    }
  }

  var sweep = findLayer("SWEEP_WIPE");
  if (sweep) {
    var sp = sweep.property("Transform").property("Position");
    var so = sweep.property("Transform").property("Opacity");
    key(sp, 0.0, [-540, 960]);
    key(sp, 0.18, [540, 960]);
    key(sp, 0.40, [1620, 960]);
    key(so, 0.0, 92); key(so, 0.20, 85); key(so, 0.40, 0);
  }

  popIn("PRODUCT_FRAME_BG", 0.04, 80, 80);
  popIn("TOP_PILL_BG", 0.08, 70, -55);
  popIn("TOP_PILL_TXT", 0.10, 70, -55);
  popIn("GLASS_CARD", 0.12, 82, 120);
  popIn("HOOK_HERO", 0.18, 62, 70);
  popIn("HOOK_SUB", 0.28, 86, 50);

  var bar = findLayer("ACCENT_BAR");
  if (bar) {
    var bs = bar.property("Transform").property("Scale");
    var bo = bar.property("Transform").property("Opacity");
    key(bo, 0.22, 0); key(bo, 0.30, 100);
    key(bs, 0.22, [0, 100]); key(bs, 0.56, [108, 100]); key(bs, 0.72, [100, 100]);
  }
})();
`;

  await fs.writeFile(jsxPath, jsxCode, 'utf-8');
  await runProcess(EFFECTCRAFT_BIN, ['--project', ecprojPath, '--save', 'script', jsxPath], tempDir);
  await runProcess(
    EFFECTCRAFT_BIN,
    [
      '--project',
      ecprojPath,
      'render',
      '--comp',
      'AE_Hook',
      '--out',
      rawHookMp4,
      '--format',
      'h264',
      '--start',
      '0',
      '--end',
      String(dur),
      '--fps',
      '30',
      '--resolution',
      'full',
      '--quality',
      'draft',
    ],
    tempDir,
  );

  return fsSync.existsSync(rawHookMp4) ? rawHookMp4 : null;
}

async function handleRenderRequest(req, res) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'selin-render-'));
  try {
    const webRequest = new Request('http://localhost/api/render', {
      method: 'POST',
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: 'half',
    });

    const formData = await webRequest.formData();
    const manifestRaw = formData.get('manifest');
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      return sendJson(res, 400, { error: 'Manifest render tidak ditemukan.' });
    }

    const manifest = JSON.parse(manifestRaw);
    const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];
    if (scenes.length === 0) {
      return sendJson(res, 400, { error: 'Minimal 1 adegan dibutuhkan untuk render.' });
    }

    const segmentFiles = [];
    const subtitleTimeline = [];
    let currentCursor = 0;
    let scene0BakedByEffectCraft = false;
    let scene0EndSec = 0;
    const captionStyle = manifest.captionStyle || 'apple-kinetic';

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const visualFile = formData.get(`visual_${i}`);
      const presenterFile = formData.get(`presenter_${i}`);
      const audioFile = formData.get(`audio_${i}`);

      let presenterPath = null;
      let isVideoPresenter = false;
      if (presenterFile && typeof presenterFile === 'object' && 'arrayBuffer' in presenterFile && presenterFile.size > 0) {
        const ext = (presenterFile.name?.split('.').pop() || 'webm').toLowerCase();
        isVideoPresenter = ['mp4', 'mov', 'webm', 'mkv'].includes(ext);
        presenterPath = path.join(tempDir, `presenter_${i}.${ext}`);
        await fs.writeFile(presenterPath, Buffer.from(await presenterFile.arrayBuffer()));
      }

      const clipStartSec = Number.isFinite(Number(scene.clipStartSec)) && Number(scene.clipStartSec) >= 0 ? Number(scene.clipStartSec) : null;
      const requestedDuration = Math.max(2.5, Number(scene.durationSec || 4));

      let audioPath = null;
      let audioDuration = 0;
      if (audioFile && typeof audioFile === 'object' && 'arrayBuffer' in audioFile && audioFile.size > 0) {
        const ext = audioFile.name?.split('.').pop() || 'webm';
        const rawAudioPath = path.join(tempDir, `voice_raw_${i}.${ext}`);
        await fs.writeFile(rawAudioPath, Buffer.from(await audioFile.arrayBuffer()));
        if (clipStartSec !== null) {
          const slicedAudioPath = path.join(tempDir, `voice_${i}.wav`);
          try {
            await runProcess(
              FFMPEG_BIN,
              [
                '-y',
                '-ss',
                clipStartSec.toFixed(2),
                '-t',
                requestedDuration.toFixed(2),
                '-i',
                path.basename(rawAudioPath),
                '-vn',
                '-acodec',
                'pcm_s16le',
                '-ar',
                '44100',
                '-ac',
                '2',
                path.basename(slicedAudioPath),
              ],
              tempDir,
            );
            audioPath = slicedAudioPath;
            audioDuration = await getMediaDuration(audioPath);
          } catch {
            audioPath = rawAudioPath;
            audioDuration = await getMediaDuration(audioPath);
          }
        } else {
          audioPath = rawAudioPath;
          audioDuration = await getMediaDuration(audioPath);
        }
      } else if (scene.usePresenterAudio && presenterPath && isVideoPresenter) {
        // Extract recorded talking-head microphone audio (optionally sliced at clipStartSec)
        const extractedAudio = path.join(tempDir, `presenter_voice_${i}.wav`);
        try {
          const extractArgs = ['-y'];
          if (clipStartSec !== null) {
            extractArgs.push('-ss', clipStartSec.toFixed(2), '-t', requestedDuration.toFixed(2));
          }
          extractArgs.push('-i', path.basename(presenterPath), '-vn', '-acodec', 'pcm_s16le', '-ar', '44100', '-ac', '2', path.basename(extractedAudio));
          await runProcess(FFMPEG_BIN, extractArgs, tempDir);
          audioPath = extractedAudio;
          audioDuration = await getMediaDuration(audioPath);
        } catch {
          audioPath = null;
        }
      }

      const targetDuration = Math.max(2.5, requestedDuration, audioDuration > 0 ? audioDuration + 0.35 : 0);
      let visualPath = null;
      let isVideoVisual = false;

      if (visualFile && typeof visualFile === 'object' && 'arrayBuffer' in visualFile && visualFile.size > 0) {
        const ext = (visualFile.name?.split('.').pop() || 'png').toLowerCase();
        isVideoVisual = ['mp4', 'mov', 'webm', 'mkv'].includes(ext);
        visualPath = path.join(tempDir, `visual_${i}.${ext}`);
        await fs.writeFile(visualPath, Buffer.from(await visualFile.arrayBuffer()));
      }

      const segmentPath = path.join(tempDir, `segment_${i}.mp4`);
      const sfxPath = await resolveSfxFilePath(scene.sfxId);
      const layout = scene.layout || 'full';

      // Use EffectCraft After Effects Keyframe Engine for Scene 0 (Hook) when applicable
      let aeHookRawVideoPath = null;
      if (
        i === 0 &&
        captionStyle === 'apple-kinetic' &&
        layout === 'full' &&
        !isVideoVisual &&
        fsSync.existsSync(EFFECTCRAFT_BIN)
      ) {
        try {
          aeHookRawVideoPath = await renderAeHookVideoWithEffectCraft({
            scene,
            visualPath,
            durationSec: targetDuration,
            burnSubtitles: Boolean(manifest.burnSubtitles),
            tempDir,
          });
        } catch (hookErr) {
          console.warn('[ae-hook-fallback]', hookErr);
          aeHookRawVideoPath = null;
        }
      }

      const args = ['-y'];
      let videoFilter = '';
      let nextInputIdx = 1;

      const buildSingleStreamFilter = (idx, filePath, isVideo, w, h, motion) => {
        if (!filePath) {
          return `[${idx}:v]format=yuv420p`;
        }
        if (isVideo) {
          return (
            `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=22:8[bg_${idx}];` +
            `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg_${idx}];` +
            `[bg_${idx}][fg_${idx}]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p`
          );
        }
        const frames = Math.max(30, Math.round(targetDuration * 30));
        let zoomExpr = `min(zoom+0.0012,1.12)`;
        let xExpr = `iw/2-(iw/zoom/2)`;
        let yExpr = `ih/2-(ih/zoom/2)`;
        if (motion === 'zoom-out') {
          zoomExpr = `if(eq(on,1),1.12,max(1.0,zoom-0.0012))`;
        } else if (motion === 'pan-right') {
          zoomExpr = `1.08`;
          xExpr = `(iw-iw/zoom)*on/${frames}`;
        } else if (motion === 'pan-left') {
          zoomExpr = `1.08`;
          xExpr = `(iw-iw/zoom)*(1-on/${frames})`;
        }
        return (
          `[${idx}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=24:8,loop=loop=-1:size=1:start=0[bg_${idx}];` +
          `[${idx}:v]scale=${Math.max(200, w - 40)}:${Math.max(200, h - 80)}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(${w}-iw)/2:(${h}-ih)/2:color=0x00000000,` +
          `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${frames}:s=${w}x${h}:fps=30[fg_${idx}];` +
          `[bg_${idx}][fg_${idx}]overlay=0:0:shortest=1,trim=duration=${targetDuration.toFixed(2)},setpts=PTS-STARTPTS,format=yuv420p`
        );
      };

      const pushVisualInput = (filePath, isVideo, w, h, seekSec = null) => {
        if (!filePath) {
          args.push('-f', 'lavfi', '-i', `color=c=0x111827:s=${w}x${h}:r=30:d=${targetDuration.toFixed(2)}`);
        } else if (isVideo) {
          if (seekSec !== null) args.push('-ss', seekSec.toFixed(2));
          args.push('-stream_loop', '-1', '-i', path.basename(filePath));
        } else {
          args.push('-i', path.basename(filePath));
        }
      };

      if (aeHookRawVideoPath) {
        args.push('-i', path.basename(aeHookRawVideoPath));
        nextInputIdx = 1;
        videoFilter = `[0:v]scale=1080:1920,fps=30,trim=duration=${targetDuration.toFixed(2)},setpts=PTS-STARTPTS,format=yuv420p[vout]`;
        scene0BakedByEffectCraft = true;
        scene0EndSec = targetDuration;
      } else if (layout === 'split-top-presenter' && presenterPath && visualPath) {
        // Top 1080x760: Talking-Head / Presenter, Bottom 1080x1160: Product B-Roll
        pushVisualInput(presenterPath, isVideoPresenter, 1080, 760, clipStartSec);
        pushVisualInput(visualPath, isVideoVisual, 1080, 1160);
        nextInputIdx = 2;
        const topFilter = isVideoPresenter
          ? `[0:v]scale=1080:760:force_original_aspect_ratio=increase,crop=1080:760,fps=30,format=yuv420p[topv]`
          : `${buildSingleStreamFilter(0, presenterPath, false, 1080, 760, 'zoom-in')}[topv]`;
        const botFilter = `${buildSingleStreamFilter(1, visualPath, isVideoVisual, 1080, 1160, scene.motion || 'zoom-in')}[botv]`;
        videoFilter = `${topFilter};${botFilter};[topv][botv]vstack=inputs=2,trim=duration=${targetDuration.toFixed(2)},setpts=PTS-STARTPTS,format=yuv420p[vout]`;
      } else if (layout === 'pip-presenter' && presenterPath && visualPath) {
        // Full 1080x1920 Product B-Roll + 320x440 Top-Right Presenter PiP
        pushVisualInput(visualPath, isVideoVisual, 1080, 1920);
        pushVisualInput(presenterPath, isVideoPresenter, 320, 440, clipStartSec);
        nextInputIdx = 2;
        const baseFilter = `${buildSingleStreamFilter(0, visualPath, isVideoVisual, 1080, 1920, scene.motion || 'zoom-in')}[basev]`;
        const pipFilter = isVideoPresenter
          ? `[1:v]scale=320:440:force_original_aspect_ratio=increase,crop=320:440,fps=30,format=yuv420p[pipv]`
          : `[1:v]scale=320:440:force_original_aspect_ratio=increase,crop=320:440,loop=loop=-1:size=1:start=0,fps=30,format=yuv420p[pipv]`;
        videoFilter = `${baseFilter};${pipFilter};[basev][pipv]overlay=W-w-36:140:shortest=1,trim=duration=${targetDuration.toFixed(2)},setpts=PTS-STARTPTS,format=yuv420p[vout]`;
      } else {
        // Full frame: prefer visualPath, or presenterPath if scene is presenter-only cutaway
        const chosenPath = visualPath || presenterPath;
        const chosenIsVideo = visualPath ? isVideoVisual : isVideoPresenter;
        const chosenSeek = !visualPath && presenterPath ? clipStartSec : null;
        pushVisualInput(chosenPath, chosenIsVideo, 1080, 1920, chosenSeek);
        nextInputIdx = 1;
        videoFilter = `${buildSingleStreamFilter(0, chosenPath, chosenIsVideo, 1080, 1920, scene.motion || 'zoom-in')}[vout]`;
      }

      // Audio inputs: voice (or silence), optional SFX
      const audioInputIdx = nextInputIdx;
      if (audioPath) {
        args.push('-i', path.basename(audioPath));
      } else {
        args.push('-f', 'lavfi', '-t', targetDuration.toFixed(2), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
      }
      nextInputIdx += 1;

      let sfxInputIdx = null;
      if (sfxPath && fsSync.existsSync(sfxPath)) {
        sfxInputIdx = nextInputIdx;
        args.push('-i', sfxPath);
      }

      let audioFilter = '';
      if (audioPath) {
        audioFilter += `[${audioInputIdx}:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,dynaudnorm=f=150:g=15:p=0.9,apad=whole_dur=${targetDuration.toFixed(2)}[voice];`;
      } else {
        audioFilter += `[${audioInputIdx}:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=0:${targetDuration.toFixed(2)}[voice];`;
      }

      if (sfxInputIdx !== null) {
        audioFilter += `[${sfxInputIdx}:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0.55[sfx];`;
        audioFilter += `[voice][sfx]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,atrim=0:${targetDuration.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`;
      } else {
        audioFilter += `[voice]atrim=0:${targetDuration.toFixed(2)},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[aout]`;
      }

      args.push(
        '-filter_complex',
        `${videoFilter};${audioFilter}`,
        '-map',
        '[vout]',
        '-map',
        '[aout]',
        '-t',
        targetDuration.toFixed(2),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '21',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
        path.basename(segmentPath),
      );

      await runProcess(FFMPEG_BIN, args, tempDir);
      segmentFiles.push(segmentPath);

      if (!(i === 0 && scene0BakedByEffectCraft)) {
        subtitleTimeline.push({
          startSec: currentCursor,
          endSec: currentCursor + targetDuration,
          captionText: manifest.burnSubtitles ? scene.voiceText : '',
          kineticText: manifest.burnSubtitles ? scene.kineticText || '' : '',
        });
      }
      currentCursor += targetDuration;
    }

    // Concat all segments
    const concatListPath = path.join(tempDir, 'concat.txt');
    await fs.writeFile(
      concatListPath,
      segmentFiles.map((f) => `file '${path.basename(f)}'`).join('\n') + '\n',
      'utf-8',
    );

    const concatOutPath = path.join(tempDir, 'joined.mp4');
    await runProcess(
      FFMPEG_BIN,
      ['-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'joined.mp4'],
      tempDir,
    );

    const outputName = `selin-aff-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.mp4`;
    const finalOutPath = path.join(RENDERS_DIR, outputName);

    if (manifest.burnSubtitles && subtitleTimeline.some((e) => e.captionText || e.kineticText)) {
      const assPath = path.join(tempDir, 'subs.ass');
      await fs.writeFile(assPath, buildAssSubtitleFile(subtitleTimeline, captionStyle), 'utf-8');

      if (captionStyle === 'apple-kinetic' && fsSync.existsSync(APPLE_GLASS_PRESET)) {
        const enableGate = scene0BakedByEffectCraft ? `:enable='gte(t,${scene0EndSec.toFixed(2)})'` : '';
        // Composite real frosted Apple Liquid Glass backdrop blur + EffectCraft Glass Card + Kinetic ASS text
        await runProcess(
          FFMPEG_BIN,
          [
            '-y',
            '-i',
            'joined.mp4',
            '-i',
            APPLE_GLASS_PRESET,
            '-filter_complex',
            `[0:v]split=2[base][blursrc];[blursrc]crop=936:316:72:1252,boxblur=24:8[frosted];[base][frosted]overlay=72:1252${enableGate}[glassbg];[glassbg][1:v]overlay=0:0${enableGate},ass=subs.ass[vout]`,
            '-map',
            '[vout]',
            '-map',
            '0:a',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-c:a',
            'copy',
            '-movflags',
            '+faststart',
            finalOutPath,
          ],
          tempDir,
        );
      } else {
        await runProcess(
          FFMPEG_BIN,
          [
            '-y',
            '-i',
            'joined.mp4',
            '-vf',
            'ass=subs.ass',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-c:a',
            'copy',
            '-movflags',
            '+faststart',
            finalOutPath,
          ],
          tempDir,
        );
      }
    } else {
      await fs.copyFile(concatOutPath, finalOutPath);
    }

    const stat = await fs.stat(finalOutPath);
    return sendJson(res, 200, {
      ok: true,
      filename: outputName,
      url: `/api/renders/${outputName}`,
      sizeBytes: stat.size,
      totalDurationSec: Number(currentCursor.toFixed(2)),
    });
  } catch (err) {
    console.error('[render-error]', err);
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleExportEcproj(req, res) {
  if (!fsSync.existsSync(EFFECTCRAFT_BIN)) {
    return sendJson(res, 404, { error: `EffectCraft CLI tidak ditemukan di ${EFFECTCRAFT_BIN}` });
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'selin-ecproj-'));
  try {
    const webRequest = new Request('http://localhost/api/export-ecproj', {
      method: 'POST',
      headers: req.headers,
      body: Readable.toWeb(req),
      duplex: 'half',
    });
    const formData = await webRequest.formData();
    const manifestRaw = formData.get('manifest');
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      return sendJson(res, 400, { error: 'Manifest proyek tidak ditemukan.' });
    }
    const manifest = JSON.parse(manifestRaw);
    const scenes = Array.isArray(manifest.scenes) ? manifest.scenes : [];
    if (scenes.length === 0) {
      return sendJson(res, 400, { error: 'Minimal 1 adegan dibutuhkan.' });
    }

    const totalDur = scenes.reduce((acc, s) => acc + Math.max(2.5, Number(s.durationSec || 4)), 0);
    const ecOutName = `selin-apple-${Date.now()}.ecproj`;
    const ecOutPath = path.join(RENDERS_DIR, ecOutName);

    const runArgs = [
      '--empty',
      '--save-as',
      ecOutPath,
      'run',
      'comp.new',
      JSON.stringify({
        name: 'Selin_Apple_Glass_9x16',
        width: 1080,
        height: 1920,
        frameRate: 30,
        duration: Number(totalDur.toFixed(2)),
      }),
      'layer.newSolid',
      JSON.stringify({ name: 'BG_Apple_Dark', color: '#0A1311', width: 1080, height: 1920 }),
    ];

    // Import uploaded scene assets into persistent assets folder if provided
    const importedPaths = [];
    for (let i = 0; i < scenes.length; i++) {
      const f = formData.get(`visual_${i}`);
      if (f && typeof f === 'object' && 'arrayBuffer' in f && f.size > 0) {
        const ext = (f.name?.split('.').pop() || 'png').toLowerCase();
        const savedPath = path.join(RENDERS_DIR, `ec-asset-${Date.now()}-${i}.${ext}`);
        await fs.writeFile(savedPath, Buffer.from(await f.arrayBuffer()));
        importedPaths.push(savedPath);
      }
    }

    if (importedPaths.length > 0) {
      runArgs.push('file.import', JSON.stringify({ paths: importedPaths, addToComp: true }));
    }

    // Add Apple Liquid Glass Card + Apple Kinetic Typography per scene
    let cursor = 0;
    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const dur = Math.max(2.5, Number(sc.durationSec || 4));
      runArgs.push(
        'layer.newShape',
        JSON.stringify({
          name: `AppleGlass_Adegan_${i + 1}`,
          kind: 'rounded',
          size: [956, 336],
          fill: '#0D1715',
          fillOpacity: 52,
          stroke: '#FFFFFF',
          strokeOpacity: 40,
          strokeWidth: 2,
          position: [540, 1410],
        }),
        'layer.newText',
        JSON.stringify({
          name: `Hero_Adegan_${i + 1}`,
          text: sc.kineticText || sc.label,
          font: 'Inter',
          style: 'Bold',
          size: 66,
          fill: '#FFFFFF',
          justify: 'center',
          position: [540, 1360],
        }),
        'layer.newText',
        JSON.stringify({
          name: `Sub_Adegan_${i + 1}`,
          text: sc.voiceText || '',
          font: 'Inter',
          style: 'Medium',
          size: 36,
          leading: 48,
          fill: '#E8F2EE',
          justify: 'center',
          position: [540, 1455],
        }),
      );
      cursor += dur;
    }

    await runProcess(EFFECTCRAFT_BIN, runArgs, tempDir);
    const stat = await fs.stat(ecOutPath);
    return sendJson(res, 200, {
      ok: true,
      filename: ecOutName,
      url: `/api/renders/${ecOutName}`,
      localPath: ecOutPath,
      sizeBytes: stat.size,
      totalDurationSec: Number(cursor.toFixed(2)),
    });
  } catch (err) {
    return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

await ensureHalalSfxLibrary();

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = reqUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    let ffmpegOk = false;
    let ffmpegVersion = '';
    try {
      const { stdout } = await runProcess(FFMPEG_BIN, ['-version'], ROOT_DIR);
      ffmpegOk = true;
      ffmpegVersion = stdout.split(/\r?\n/)[0] || 'ffmpeg';
    } catch {
      ffmpegOk = false;
    }
    const effectcraftOk = fsSync.existsSync(EFFECTCRAFT_BIN);
    return sendJson(res, 200, { ok: true, ffmpegOk, ffmpegVersion, effectcraftOk, port: PORT });
  }

  if (req.method === 'GET' && pathname === '/api/sfx') {
    const scanned = await getDynamicSfxCatalog();
    return sendJson(res, 200, scanned);
  }

  if (req.method === 'GET' && pathname.startsWith('/api/sfx/')) {
    const rawId = decodeURIComponent(path.basename(pathname));
    const sfxPath = await resolveSfxFilePath(rawId);
    if (!sfxPath) return sendJson(res, 404, { error: 'SFX tidak ditemukan di whitelist halal.' });
    const ext = path.extname(sfxPath).toLowerCase();
    // Transcode .wma on-the-fly so Chrome/Edge <audio> can preview it cleanly
    if (ext === '.wma') {
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': '*' });
      const ff = spawn(FFMPEG_BIN, ['-v', 'error', '-i', sfxPath, '-f', 'wav', 'pipe:1'], { windowsHide: true });
      ff.stdout.pipe(res);
      ff.on('error', () => res.end());
      return;
    }
    const mime = ext === '.mp3' ? 'audio/mpeg' : ext === '.ogg' ? 'audio/ogg' : 'audio/wav';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    return fsSync.createReadStream(sfxPath).pipe(res);
  }

  if (req.method === 'GET' && pathname.startsWith('/api/renders/')) {
    const safeName = path.basename(pathname);
    const filePath = path.join(RENDERS_DIR, safeName);
    if (!fsSync.existsSync(filePath)) return sendJson(res, 404, { error: 'File hasil tidak ditemukan.' });
    const stat = await fs.stat(filePath);
    const mime = safeName.endsWith('.ecproj') ? 'application/octet-stream' : 'video/mp4';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Content-Disposition': `${safeName.endsWith('.ecproj') ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'Access-Control-Allow-Origin': '*',
    });
    return fsSync.createReadStream(filePath).pipe(res);
  }

  if (req.method === 'POST' && pathname === '/api/export-ecproj') {
    return handleExportEcproj(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/ai-chat') {
    return handleAiChatProxy(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/fetch-product') {
    return handleFetchProduct(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/render') {
    return handleRenderRequest(req, res);
  }

  return sendJson(res, 404, { error: 'Endpoint tidak ditemukan.' });
});

server.on('error', async (err) => {
  if (err && err.code === 'EADDRINUSE') {
    try {
      const check = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      if (check.ok) {
        console.log(`[Selin Render Server] Port ${PORT} sudah aktif — memakai instance yang sedang berjalan.`);
        setInterval(() => {}, 60000);
        return;
      }
    } catch {
      // fall through
    }
    console.error(`[Selin Render Server] Port ${PORT} sedang dipakai proses lain.`);
    process.exit(1);
  }
  console.error('[Selin Render Server] Error:', err);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Selin Render Server] Aktif di http://127.0.0.1:${PORT}`);
  console.log(`[Selin Render Server] Library SFX Halal siap di ${SFX_DIR}`);
});

