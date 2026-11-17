import type { ByokConfig, ByokPresetId, ProductBrief, StudioScene } from '../types/studio';
import { buildSyariVisualPrompt, VISUAL_MODE_LABELS } from './syari-guardrails';

export const BYOK_PRESETS: Record<
  ByokPresetId,
  { label: string; baseUrl: string; defaultModel: string; hint: string }
> = {
  sumopod: {
    label: 'SumoPod AI Gateway',
    baseUrl: 'https://ai.sumopod.com/v1',
    defaultModel: 'gpt-4o-mini',
    hint: 'Salin Base URL (https://ai.sumopod.com) & API Key sk-... dari dashboard SumoPod Anda.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash',
    hint: 'Mendukung puluhan model teks murah/gratis lewat 1 API key OpenRouter.',
  },
  gemini: {
    label: 'Google Gemini (OpenAI Compatible)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    hint: 'Gunakan API Key gratis/berbayar dari Google AI Studio.',
  },
  groq: {
    label: 'Groq Cloud',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    hint: 'Respon sangat cepat dan memiliki kuota gratis harian.',
  },
  ollama: {
    label: 'Ollama Lokal (100% Offline)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'llama3.1',
    hint: 'Jalankan LLM di komputer Anda sendiri tanpa internet dan tanpa biaya.',
  },
  custom: {
    label: 'Custom Base URL (OpenAI SDK)',
    baseUrl: '',
    defaultModel: '',
    hint: 'Masukkan endpoint apa pun yang kompatibel dengan format /chat/completions OpenAI.',
  },
};

export async function testByokConnection(config: ByokConfig): Promise<string> {
  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Jawab singkat satu kalimat saja.' },
        { role: 'user', content: 'Balas dengan: Koneksi AI siap digunakan.' },
      ],
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Gagal terhubung ke Base URL.');
  }
  const reply = payload?.data?.choices?.[0]?.message?.content;
  return typeof reply === 'string' && reply.trim() ? reply.trim() : `Terhubung ke ${payload.endpoint}`;
}

export async function generateStoryboardWithByok(
  config: ByokConfig,
  brief: ProductBrief,
): Promise<StudioScene[]> {
  const mode = VISUAL_MODE_LABELS[brief.visualMode];
  const systemPrompt = [
    `Anda adalah ahli copywriting & sutradara video pendek TikTok/Shopee Affiliate Indonesia yang ketat menjaga adab syar'i.`,
    `Niche produk: ${brief.category === 'tech' ? 'Teknologi & Gadget' : 'Peralatan Rumah Tangga'}.`,
    `ATURAN KETAT:`,
    `1. Audio: DILARANG menyarankan musik, lagu, atau alat musik. Hanya narasi suara manusia dan SFX non-musikal dari daftar ID: none, ae_swoosh_lembut, ae_whoosh_fast, ae_pop_click, ae_pop_muncul, ae_impact_slam, ae_langkah_sepatu, soft-whoosh, mech-click, desk-tap, box-rustle, shutter-snap, air-pop.`,
    `2. Visual: Wajib mematuhi mode "${mode.title}". ${mode.promptRule}. Dilarang: ${mode.negativeRule}.`,
    `3. Kepatuhan: Bahasa Indonesia santai, jujur, tidak overclaim ("100% ampuh", "permanen", "nomor 1 sedunia" DILARANG).`,
    brief.hidePriceInVideo
      ? `4. STRATEGI KONVERSI: JANGAN menyebut nominal harga atau angka Rp di dalam voiceText. Arahkan penonton untuk cek harga & promo langsung di keranjang agar penasaran.`
      : `4. Boleh menyebut kisaran harga secara wajar.`,
    `5. Kembalikan HANYA JSON valid berupa array 4 objek tanpa markdown fence, dengan key: label, durationSec (number 3-6), voiceText (Bahasa Indonesia ringkas 1-2 kalimat untuk dibaca 4 detik), visualAction (bahasa Inggris deskripsi adegan produk), motion ("zoom-in"|"zoom-out"|"pan-left"|"pan-right"), sfxId.`,
  ].join('\n');

  const userPrompt = [
    `Produk: ${brief.name}`,
    `Keunggulan utama: ${brief.keyBenefit}`,
    `Target pembeli: ${brief.targetAudience || 'Pengguna harian di Indonesia'}`,
    brief.hidePriceInVideo ? `Harga: (Sembunyikan di video agar penasaran)` : `Harga/Promo: ${brief.priceText || 'Harga terjangkau'}`,
    `Gaya Hook: ${brief.hookStyle}`,
    `CTA arahkan ke: ${brief.ctaTarget}`,
  ].join('\n');

  const res = await fetch('/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.65,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload.error || 'Gagal memanggil API AI.');
  }

  const rawText = payload?.data?.choices?.[0]?.message?.content;
  if (typeof rawText !== 'string') {
    throw new Error('Respons AI tidak berisi teks.');
  }

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  const jsonStart = cleaned.indexOf('[');
  const jsonEnd = cleaned.lastIndexOf(']');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('Format JSON storyboard dari model tidak terbaca. Coba ulangi.');
  }

  const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as Array<{
    label?: string;
    durationSec?: number;
    voiceText?: string;
    visualAction?: string;
    motion?: StudioScene['motion'];
    sfxId?: string;
  }>;

  const allowedMotions = new Set(['zoom-in', 'zoom-out', 'pan-left', 'pan-right']);
  const allowedSfx = new Set([
    'none',
    'ae_swoosh_lembut',
    'ae_whoosh_fast',
    'ae_pop_click',
    'ae_pop_muncul',
    'ae_impact_slam',
    'ae_langkah_sepatu',
    'soft-whoosh',
    'mech-click',
    'desk-tap',
    'box-rustle',
    'shutter-snap',
    'air-pop',
  ]);

  return parsed.slice(0, 5).map((item, idx) => ({
    id: `scene-${idx + 1}`,
    label: item.label || `Adegan ${idx + 1}`,
    durationSec: Math.min(8, Math.max(3, Number(item.durationSec || 4))),
    voiceText: String(item.voiceText || '').trim(),
    visualPrompt: buildSyariVisualPrompt(brief, String(item.visualAction || 'Clean product showcase')),
    motion: item.motion && allowedMotions.has(item.motion) ? item.motion : 'zoom-in',
    layout:
      brief.videoStyle === 'talking-head-broll'
        ? idx === 0 || idx === 3
          ? 'split-top-presenter'
          : 'pip-presenter'
        : 'full',
    sfxId: item.sfxId && allowedSfx.has(item.sfxId) ? item.sfxId : 'soft-whoosh',
  }));
}

