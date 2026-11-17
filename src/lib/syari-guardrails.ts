import type {
  ComplianceIssue,
  ProductBrief,
  ProductCategory,
  SceneLayout,
  StudioScene,
  VideoStylePreset,
  VisualGuardrailMode,
} from '../types/studio';

export const VISUAL_MODE_LABELS: Record<
  VisualGuardrailMode,
  { title: string; badge: string; promptRule: string; negativeRule: string }
> = {
  'product-only': {
    title: 'Produk & Ruangan Saja (Zero Living Creature)',
    badge: 'Paling Ketat',
    promptRule:
      'Product-only macro photography on clean minimalist surface, natural daylight, sharp product geometry, zero humans, zero animals.',
    negativeRule: 'person, human, face, eyes, nose, mouth, animal, character, mascot, cartoon eyes',
  },
  'hands-only': {
    title: 'POV Tangan & Produk (Hands-Only)',
    badge: 'Paling Laris di Affiliate',
    promptRule:
      'First-person POV hands holding and demonstrating the exact product clearly, clean sleeves, neutral tabletop background, no head, no upper torso, no face visible.',
    negativeRule: 'face, head, eyes, nose, mouth, portrait, selfie, full body, animal',
  },
  'faceless-minimal': {
    title: 'Karakter Faceless Minimalis (Tanpa Mata/Hidung/Mulut)',
    badge: 'Mode Karakter Syar\'i',
    promptRule:
      'Minimalist stylized 3D/2D faceless mannequin figure with separated floating head and torso, completely blank smooth head without any eyes, nose, mouth, or eyebrows, demonstrating the product cleanly.',
    negativeRule:
      'eyes, nose, mouth, lips, eyebrows, facial features, realistic human face, anime face, eyelashes, pupils',
  },
};

export const VIDEO_STYLE_LABELS: Record<
  VideoStylePreset,
  { title: string; subtitle: string; badge: string }
> = {
  'talking-head-broll': {
    title: 'Master Preset 1: Storytelling + Talking-Head & B-Roll',
    subtitle: 'Otomatis 5 babak cerita + gerak kamera B-Roll + kartu kaca Apple + SFX halal.',
    badge: 'Konversi Tertinggi',
  },
  'product-motion': {
    title: 'Master Preset 2: Katalog Apple Glass (Tanpa Wajah)',
    subtitle: 'Otomatis ubah 1–5 foto produk jadi video storytelling zoom/pan + kartu kaca Apple + SFX.',
    badge: 'Paling Praktis',
  },
  'broll-hands': {
    title: 'Master Preset 3: POV Demo Tangan & Fitur',
    subtitle: 'Fokus bedah fitur & pemakaian dekat tanpa menampilkan wajah presenter.',
    badge: 'Fokus Produk',
  },
};

export const BEGINNER_TEMPLATES: Array<{
  id: string;
  label: string;
  tag: string;
  brief: Partial<ProductBrief>;
}> = [
  {
    id: 'mic-vlog-story',
    label: 'Mic Wireless Vlog (Brica B-VLOG M4)',
    tag: 'Storytelling Audio',
    brief: {
      name: 'Brica B-VLOG M4 Dual Wireless Microphone',
      category: 'tech',
      priceText: 'Rp 698.800',
      hidePriceInVideo: true,
      keyBenefit:
        'jangkauan sinyal hingga 60m, Noise Reduction peredam bising, layar LCD status mic, rekam mandiri MicroSD, lengkap charging case',
      hookStyle: 'masalah-solusi',
      videoStyle: 'product-motion',
      visualMode: 'hands-only',
      ctaTarget: 'keranjang-kuning',
    },
  },
  {
    id: 'air-fryer-split',
    label: 'Air Fryer Low Watt (Alat Dapur)',
    tag: 'Peralatan Rumah',
    brief: {
      name: 'Mini Air Fryer Low Watt 4L',
      category: 'home',
      priceText: 'Rp 349.000',
      hidePriceInVideo: true,
      keyBenefit: 'masak tanpa minyak, daya hemat 600W, wadah anti lengket gampang dibersihkan',
      hookStyle: 'masalah-solusi',
      videoStyle: 'talking-head-broll',
      visualMode: 'hands-only',
      ctaTarget: 'keranjang-kuning',
    },
  },
  {
    id: 'vacuum-hands',
    label: 'Vacuum Cleaner Portable',
    tag: 'Rumah & Mobil',
    brief: {
      name: 'Vacuum Cleaner Mini Wireless 2-in-1',
      category: 'home',
      priceText: 'Rp 185.000',
      hidePriceInVideo: true,
      keyBenefit: 'daya hisap kuat untuk debu sofa dan sudut sempit, ringan tanpa kabel',
      hookStyle: 'review-jujur',
      videoStyle: 'broll-hands',
      visualMode: 'hands-only',
      ctaTarget: 'keranjang-kuning',
    },
  },
];

export const OVERCLAIM_TERMS = [
  '100% sembuh',
  '100% ampuh',
  'permanen',
  'paling murah sedunia',
  'termurah sejagat',
  'nomor 1 di dunia',
  'terbukti medis menyembuhkan',
  'anti rusak selamanya',
  'pasti kaya',
  'dijamin laku',
];

const CTA_LABELS: Record<ProductBrief['ctaTarget'], string> = {
  'keranjang-kuning': 'keranjang kuning di kiri bawah',
  'keranjang-oranye': 'keranjang oranye Shopee Video',
  'link-bio': 'link di bio profil',
};

export function getCategoryFocusHint(category: ProductCategory): string {
  return category === 'tech'
    ? 'Fokus demo fitur utama, kualitas suara/daya, dan kepraktisan pemakaian.'
    : 'Fokus masalah rumah tangga sehari-hari, hasil sebelum-sesudah, dan kemudahan pemakaian.';
}

export function buildSyariVisualPrompt(brief: ProductBrief, sceneAction: string): string {
  const mode = VISUAL_MODE_LABELS[brief.visualMode];
  const setting =
    brief.category === 'tech'
      ? 'clean modern studio tabletop, soft natural lighting'
      : 'clean bright Indonesian modern home kitchen or living room counter';
  return [
    `Vertical 9:16 commercial product visual of "${brief.name || 'produk affiliate'}".`,
    `Action: ${sceneAction}.`,
    `Environment: ${setting}.`,
    `Product fidelity lock: preserve exact original product shape, color, buttons, and proportions from reference photo.`,
    `Syari visual rule: ${mode.promptRule}`,
    `Negative constraints (avoid): ${mode.negativeRule}, watermark, distorted text.`,
  ].join(' ');
}

export function buildExternalBridgePrompt(brief: ProductBrief): string {
  const mode = VISUAL_MODE_LABELS[brief.visualMode];
  const style = VIDEO_STYLE_LABELS[brief.videoStyle];
  return [
    `Buatkan konsep & gambar/klip storytelling vertikal (9:16) untuk affiliate TikTok/Shopee produk:`,
    `- Nama Produk: ${brief.name || '(isi nama produk)'}`,
    `- Kategori: ${brief.category === 'tech' ? 'Teknologi & Gadget' : 'Peralatan Rumah Tangga'}`,
    `- Gaya Video: ${style.title}`,
    `- Keunggulan Utama: ${brief.keyBenefit || '(isi keunggulan)'}`,
    ``,
    `ATURAN WAJIB SYAR'I & KEPATUHAN:`,
    `1. Visual: ${mode.title}. ${mode.promptRule}`,
    `2. DILARANG KERAS: ${mode.negativeRule}.`,
    `3. Audio: JANGAN tambahkan musik atau lagu apa pun. Hanya narasi suara & efek suara benda.`,
    `4. Kunci Produk: Bentuk, warna, dan ukuran produk harus sama persis dengan foto asli produk.`,
  ].join('\n');
}

function getDefaultSfxByCategory(category: ProductCategory, index: number): string {
  if (index === 0) return 'ae_swoosh_lembut';
  if (index === 1) return category === 'tech' ? 'ae_pop_click' : 'box-rustle';
  if (index === 2) return 'ae_whoosh_fast';
  if (index === 3) return 'shutter-snap';
  return 'ae_pop_muncul';
}

function getDefaultLayout(style: VideoStylePreset, index: number, total: number): SceneLayout {
  if (style === 'talking-head-broll') {
    if (index === 0 || index === total - 1) return 'split-top-presenter';
    return 'pip-presenter';
  }
  return 'full';
}

export function extractAppleKineticHeadline(sentence: string): string {
  const cleaned = sentence
    .replace(/[-_—–]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'PILIHAN TEPAT';

  const stopWords = new Set([
    'yang', 'dan', 'ini', 'itu', 'buat', 'untuk', 'dengan', 'atau', 'kalau', 'jika', 'bisa', 'banget', 'sekali',
    'juga', 'karena', 'jadi', 'sama', 'ada', 'dari', 'pada', 'saya', 'aku', 'kamu', 'kita', 'lagi', 'masih',
    'sudah', 'udah', 'gak', 'nggak', 'tidak', 'di', 'ke', 'nya', 'nih', 'tuh', 'dong', 'kok', 'mah', 'kan',
    'capek', 'beres', 'alasan', 'nilai', 'plus', 'utamanya', 'mumpung', 'langsung', 'kenalin', 'sering', 'tapi',
    'sama', 'bikin', 'saat', 'pas', 'lihat', 'cek', 'detailnya', 'sekarang', 'promo', 'khusus', 'pengguna',
    'baru', 'aplikasi', 'tokopedia', 'shopee', 'mall', 'garansi', 'resmi',
  ]);

  const words = cleaned.split(' ').filter((w) => w.length > 1);
  const meaningful = words.filter((w) => !stopWords.has(w.toLowerCase()));
  const pool = meaningful.length >= 2 ? meaningful : words;

  const chosen: string[] = [];
  let charLen = 0;
  for (const w of pool) {
    if (chosen.length >= 3) break;
    if (charLen + w.length + (chosen.length > 0 ? 1 : 0) > 20 && chosen.length >= 2) break;
    chosen.push(w.toUpperCase());
    charLen += w.length + 1;
  }

  return chosen.join(' ') || 'DETAIL PRODUK';
}

function shortenProductName(rawName: string): string {
  const cleaned = rawName
    .replace(/^(?:Promo|Jual|Original|Ori|Termurah|Terlaris)\s+/i, '')
    .replace(/\b(?:Garansi Resmi|Original|100%|Resmi|Murah|Promo|Termurah|Best Seller)\b.*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 5) return cleaned || 'alat ini';
  return words.slice(0, 5).join(' ');
}

function cleanBenefitPoints(rawBenefit: string, productName: string): string[] {
  const withoutBoilerplate = rawBenefit
    .replace(/^Promo\s+.+?\s+di\s+.+?\.\s*Promo khusus pengguna baru[^!.]*[!.]?\s*/i, '')
    .replace(/Promo khusus pengguna baru di aplikasi Tokopedia!?/gi, '')
    .replace(/Barang Baru\s*&\s*Bergaransi Resmi[^,.]*/gi, '')
    .replace(/Memperkenalkan\s+[^,.]+?\s+yang berguna untuk\s+/gi, '')
    .trim();

  const rawParts = withoutBoilerplate
    .split(/[,;•\r\n]+|\.\s+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 4 && p.toLowerCase() !== productName.toLowerCase());

  return rawParts;
}

export interface SpokenSegmentInput {
  text: string;
  startSec?: number;
  durationSec?: number;
}

export function splitFreeScriptIntoSegments(rawScript: string, totalDurationSec = 0): SpokenSegmentInput[] {
  const parts = rawScript
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length === 0) return [];
  const totalWords = parts.reduce((acc, s) => acc + s.split(/\s+/).length, 0) || 1;
  const fallbackTotal = totalDurationSec > 0 ? totalDurationSec : parts.length * 4;

  let cursor = 0;
  return parts.map((text) => {
    const wCount = text.split(/\s+/).length;
    const dur = Math.max(2.8, Number(((wCount / totalWords) * fallbackTotal).toFixed(2)));
    const seg: SpokenSegmentInput = {
      text,
      startSec: totalDurationSec > 0 ? Number(cursor.toFixed(2)) : undefined,
      durationSec: dur,
    };
    cursor += dur;
    return seg;
  });
}

export function planScenesFromSpokenScript(
  segments: SpokenSegmentInput[],
  brief: ProductBrief,
  existingScenes: StudioScene[],
  sharedPresenterFile?: File,
): StudioScene[] {
  const visualPool = existingScenes
    .map((s) => ({
      file: s.visualFile,
      url: s.visualPreviewUrl,
      kind: s.visualKind,
    }))
    .filter((v) => Boolean(v.file));

  const sharedPresenterUrl = sharedPresenterFile ? URL.createObjectURL(sharedPresenterFile) : undefined;
  const sharedPresenterKind: 'image' | 'video' | undefined = sharedPresenterFile
    ? sharedPresenterFile.type.startsWith('video/')
      ? 'video'
      : 'image'
    : undefined;

  const motions: StudioScene['motion'][] = ['zoom-in', 'pan-right', 'pan-left', 'zoom-out'];

  return segments.map((seg, idx) => {
    const lower = seg.text.toLowerCase();
    const isCta = /keranjang|cek|link|bio|checkout|check out|order|stok|promo/.test(lower);
    const isDemoOrFeature = /fitur|desain|bahan|ukuran|baterai|suara|jernih|hemat|watt|cepat|praktis|lihat|pakai|detail|wireless|meter|anti|ringan|kecil|hasil/.test(
      lower,
    );

    const visualItem = visualPool.length > 0 ? visualPool[idx % visualPool.length] : undefined;
    const prevPresenter = existingScenes[idx]?.presenterFile;
    const presenterFile = sharedPresenterFile || prevPresenter;
    const presenterUrl = sharedPresenterUrl || existingScenes[idx]?.presenterPreviewUrl;
    const presenterKind = sharedPresenterKind || existingScenes[idx]?.presenterKind;

    let layout: SceneLayout = 'full';
    if (presenterFile && visualItem?.file) {
      if (idx === 0 || isCta) layout = 'split-top-presenter';
      else if (isDemoOrFeature) layout = idx % 2 === 1 ? 'full' : 'pip-presenter';
      else layout = 'pip-presenter';
    } else if (presenterFile && !visualItem?.file) {
      layout = 'full';
    }

    return {
      id: `scene-${idx + 1}-${Date.now()}`,
      label:
        idx === 0
          ? 'Adegan 1 · Hook Pembuka'
          : isCta
            ? `Adegan ${idx + 1} · Ajakan Keranjang`
            : isDemoOrFeature
              ? `Adegan ${idx + 1} · Bedah Fitur`
              : `Adegan ${idx + 1} · Cerita Produk`,
      durationSec: Math.min(12, Math.max(3, Math.round(seg.durationSec || 4))),
      voiceText: seg.text,
      kineticText: extractAppleKineticHeadline(seg.text),
      visualPrompt: buildSyariVisualPrompt(brief, `Product B-roll illustrating: ${seg.text}`),
      motion: motions[idx % motions.length],
      layout,
      sfxId: getDefaultSfxByCategory(brief.category, idx),
      visualFile: visualItem?.file,
      visualPreviewUrl: visualItem?.url,
      visualKind: visualItem?.kind,
      presenterFile,
      presenterPreviewUrl: presenterUrl,
      presenterKind,
      usePresenterAudio: Boolean(sharedPresenterFile && sharedPresenterKind === 'video'),
      clipStartSec: seg.startSec,
    };
  });
}

export function createExtraScene(brief: ProductBrief, index: number): StudioScene {
  const motions: StudioScene['motion'][] = ['zoom-in', 'pan-right', 'pan-left', 'zoom-out'];
  const shortName = shortenProductName(brief.name);
  const extraLines = [
    `Lihat detail fisik ${shortName} ini, kelihatan rapi dan solid buat dipakai harian.`,
    `Ukurannya ringkas, gampang disimpan dan langsung siap dipakai kapan saja.`,
    `Banyak yang cocok karena fungsinya nyata dan sangat membantu aktivitas harian.`,
  ];
  const line = extraLines[index % extraLines.length];
  return {
    id: `scene-${index + 1}-${Date.now()}`,
    label: `Adegan ${index + 1} · Bukti Tambahan`,
    durationSec: 4,
    voiceText: line,
    kineticText: extractAppleKineticHeadline(line),
    visualPrompt: buildSyariVisualPrompt(brief, 'Additional close-up angle highlighting product build quality'),
    motion: motions[index % motions.length],
    layout: brief.videoStyle === 'talking-head-broll' ? 'pip-presenter' : 'full',
    sfxId: getDefaultSfxByCategory(brief.category, index),
  };
}

/**
 * Product-Aware Storytelling Affiliate Generator
 * Produces concise 9-13 word sentences per scene so speakers never feel rushed on the teleprompter,
 * and headlines always match the exact product being reviewed (never generic "Meja Kerja").
 */
export function generateLocalSyariStoryboard(brief: ProductBrief, desiredCount = 4): StudioScene[] {
  const shortName = shortenProductName(brief.name || 'Produk Pilihan Ini');
  const fullContext = `${brief.name} ${brief.keyBenefit}`.toLowerCase();
  const points = cleanBenefitPoints(brief.keyBenefit, brief.name);
  const cta = CTA_LABELS[brief.ctaTarget];

  const isMicOrAudio = /\b(mic|microphone|mikrofon|vlog|clip[\s-]*on|wireless\s+mic|lavalier|perekam|audio)\b/i.test(
    fullContext,
  );
  const isEarphoneOrSpeaker = /\b(tws|earphone|headphone|headset|earbuds|speaker|bluetooth\s+audio)\b/i.test(
    fullContext,
  );
  const isPowerOrCharger = /\b(powerbank|power\s*bank|charger|casan|kabel|fast\s*charging|gan|baterai)\b/i.test(
    fullContext,
  );
  const isCooking = /\b(air\s*fryer|panci|wajan|kompor|blender|chopper|oven|masak|kukus|rice\s*cooker|dapur)\b/i.test(
    fullContext,
  );
  const isCleaning = /\b(vacuum|vakum|sapu|pel|sikat|pembersih|debu|sedot)\b/i.test(fullContext);

  // Build product-specific Hook, Solution, Feature 1, Feature 2, and Curiosity CTA
  let hookLine = '';
  let hookHeadline = '';
  let solutionLine = '';
  let solutionHeadline = '';
  let feat1Line = '';
  let feat1Headline = '';
  let feat2Line = '';
  let feat2Headline = '';

  if (isMicOrAudio) {
    hookLine =
      brief.hookStyle === 'review-jujur'
        ? `Jujur baru tahu rekaman suara di HP bisa sejernih ini pakai ${shortName}.`
        : brief.hookStyle === 'demo-spesifikasi'
          ? `Ini alasan banyak kreator pindah ke ${shortName} buat rekaman harian.`
          : `Ngonten di luar tapi suara rekaman masih kalah sama bising sekitar?`;
    hookHeadline = brief.hookStyle === 'masalah-solusi' ? 'SUARA MASIH BISING?' : 'SUARA JERNIH VLOG';

    solutionLine = `Kenalin ${shortName}, mikrofon wireless praktis yang bikin suara langsung fokus dan bulat.`;
    solutionHeadline = 'SUARA FOKUS & BULAT';

    const has60m = /60\s*m/i.test(fullContext);
    const hasNoise = /noise|bising|kebisingan/i.test(fullContext);
    feat1Line =
      has60m || hasNoise
        ? `Ada peredam bising aktif dan sinyal stabil sampai jarak 60 meter.`
        : points[0]
          ? `Keunggulan utamanya, ${points[0]} sehingga suara tetap bersih.`
          : `Dilengkapi peredam kebisingan otomatis dan sinyal nirkabel yang stabil.`;
    feat1Headline = has60m ? 'SINYAL 60 METER' : 'PEREDAM BISING';

    const hasLcdOrCase = /lcd|case|micro\s*sd/i.test(fullContext);
    feat2Line = hasLcdOrCase
      ? `Lengkap layar LCD, dukung MicroSD mandiri, plus kotak cas yang ringkas dibawa.`
      : points[1]
        ? `Ditambah lagi ${points[1]}, tinggal colok langsung siap rekaman.`
        : `Sudah dapat dua mic clip-on dan kotak cas, tinggal colok langsung aktif.`;
    feat2Headline = hasLcdOrCase ? 'LAYAR LCD + CASE' : 'TINGGAL COLOK AKTIF';
  } else if (isEarphoneOrSpeaker) {
    hookLine = `Cari audio jernih yang nyaman dipakai harian tanpa bikin telinga pegal?`;
    hookHeadline = 'AUDIO JERNIH NYAMAN';
    solutionLine = `Kenalin ${shortName}, detail suaranya bersih dan koneksinya cepat stabil.`;
    solutionHeadline = 'KONEKSI CEPAT STABIL';
    feat1Line = points[0] ? `Fitur andalannya ${points[0]}, enak dipakai seharian.` : `Suara vokal terdengar jelas dengan daya tahan baterai yang awet.`;
    feat1Headline = extractAppleKineticHeadline(feat1Line);
    feat2Line = points[1] ? `Ditambah ${points[1]}, desainnya ringkas masuk saku.` : `Desainnya ringkas, ringan dibawa ke mana saja tanpa makan tempat.`;
    feat2Headline = extractAppleKineticHeadline(feat2Line);
  } else if (isPowerOrCharger) {
    hookLine = `Baterai HP sering habis pas lagi butuh-butuhnya di perjalanan?`;
    hookHeadline = 'ANTI LOWBAT DI JALAN';
    solutionLine = `Sekarang lebih tenang karena ada ${shortName} yang siap sedia di tas.`;
    solutionHeadline = 'RINGKAS SIAP SEDIA';
    feat1Line = points[0] ? `Keunggulannya ${points[0]}, isi daya jauh lebih hemat waktu.` : `Pengisian dayanya cepat dan aman untuk berbagai perangkat harian.`;
    feat1Headline = extractAppleKineticHeadline(feat1Line);
    feat2Line = points[1] ? `Selain itu ${points[1]}, ukurannya pas digenggam.` : `Bentuknya tipis dan praktis dibawa bepergian tanpa kabel semrawut.`;
    feat2Headline = extractAppleKineticHeadline(feat2Line);
  } else if (isCooking) {
    hookLine = `Mau masak praktis setiap hari tanpa boros minyak dan hemat listrik?`;
    hookHeadline = 'MASAK HEMAT MINYAK';
    solutionLine = `Pakai ${shortName} ini, urusan menyiapkan makanan di dapur jadi jauh lebih cepat.`;
    solutionHeadline = 'DAPUR LEBIH PRAKTIS';
    feat1Line = points[0] ? `Keunggulan utamanya ${points[0]}, matang merata tanpa ribet.` : `Panasnya cepat merata dengan daya listrik yang tetap ramah di rumah.`;
    feat1Headline = extractAppleKineticHeadline(feat1Line);
    feat2Line = points[1] ? `Apalagi ${points[1]}, selesai dipakai gampang banget dicuci.` : `Bagian wadahnya anti lengket sehingga mudah dibersihkan setelah masak.`;
    feat2Headline = 'MUDAH DIBERSIHKAN';
  } else if (isCleaning) {
    hookLine = `Debu di sela sofa dan sudut sempit sering susah dibersihkan?`;
    hookHeadline = 'BERSIH SUDUT SEMPIT';
    solutionLine = `Pakai ${shortName}, angkat debu halus jadi ringan tanpa bikin tangan pegal.`;
    solutionHeadline = 'HISAP DEBU KUAT';
    feat1Line = points[0] ? `Nilai plusnya ${points[0]}, cepat tuntas dalam hitungan menit.` : `Daya hisapnya kuat mengangkat remah dan debu di kasur maupun mobil.`;
    feat1Headline = extractAppleKineticHeadline(feat1Line);
    feat2Line = points[1] ? `Ditambah ${points[1]}, gampang disimpan setelah dipakai.` : `Desainnya tanpa kabel yang mengganggu dan filter mudah dibersihkan.`;
    feat2Headline = 'TANPA KABEL RIBET';
  } else {
    // Dynamic product-aware fallback for ANY product
    hookLine =
      brief.hookStyle === 'review-jujur'
        ? `Jujur baru tahu kenapa ${shortName} ini banyak dicari orang.`
        : brief.hookStyle === 'demo-spesifikasi'
          ? `Tiga keunggulan utama ${shortName} yang wajib Anda tahu sebelum beli.`
          : `Cari ${shortName} yang awet dan benar-benar kepakai buat harian?`;
    hookHeadline = extractAppleKineticHeadline(shortName);

    solutionLine = points[0]
      ? `Kenalin ${shortName}, hadir dengan ${points[0]}.`
      : `Kenalin ${shortName}, dirancang praktis supaya langsung nyaman dipakai.`;
    solutionHeadline = extractAppleKineticHeadline(points[0] || shortName);

    feat1Line = points[1]
      ? `Nilai plus lainnya ada di ${points[1]} yang terasa banget manfaatnya.`
      : `Material dan pengerjaannya rapi, terasa solid saat dipakai sehari-hari.`;
    feat1Headline = extractAppleKineticHeadline(points[1] || 'MATERIAL SOLID RAPI');

    feat2Line = points[2]
      ? `Selain itu dilengkapi ${points[2]}, bikin pemakaian makin praktis.`
      : `Ukurannya pas dan mudah digunakan siapa saja tanpa pengaturan rumit.`;
    feat2Headline = extractAppleKineticHeadline(points[2] || 'PRAKTIS DIPAKAI');
  }

  const ctaClosing = brief.hidePriceInVideo
    ? `Mumpung promo dan stoknya masih ada, cek harga aslinya di ${cta}.`
    : `${brief.priceText.trim() ? `Harganya sekitar ${brief.priceText.trim()}.` : 'Harganya masih terjangkau.'} Cek langsung di ${cta}.`;
  const ctaHeadline = brief.ctaTarget === 'keranjang-oranye' ? 'CEK KERANJANG ORANYE' : 'CEK KERANJANG KUNING';

  // Build scenes matching desiredCount (4 or 5+ scenes)
  const total = Math.max(4, desiredCount);
  const coreSpecs: Array<{
    label: string;
    durationSec: number;
    voiceText: string;
    kineticText: string;
    action: string;
    motion: StudioScene['motion'];
  }> = [
    {
      label: 'Adegan 1 · Hook Masalah (0–4 dtk)',
      durationSec: 4,
      voiceText: hookLine,
      kineticText: hookHeadline,
      action: 'Establishing hero shot of the product, crisp lighting',
      motion: 'zoom-in',
    },
    {
      label: 'Adegan 2 · Solusi & Keunggulan Utama',
      durationSec: 4,
      voiceText: total >= 5 ? solutionLine : feat1Line,
      kineticText: total >= 5 ? solutionHeadline : feat1Headline,
      action: 'Close-up functional view highlighting primary feature',
      motion: 'pan-right',
    },
    {
      label: 'Adegan 3 · Bedah Fitur & Bukti',
      durationSec: 4,
      voiceText: total >= 5 ? feat1Line : feat2Line,
      kineticText: total >= 5 ? feat1Headline : feat2Headline,
      action: 'Detailed angle showing build quality, screen, or accessories',
      motion: 'pan-left',
    },
  ];

  if (total >= 5) {
    coreSpecs.push({
      label: 'Adegan 4 · Kelengkapan & Detail Praktis',
      durationSec: 4,
      voiceText: feat2Line,
      kineticText: feat2Headline,
      action: 'Complete package or secondary feature demonstration',
      motion: 'zoom-in',
    });
  }

  for (let i = coreSpecs.length; i < total - 1; i++) {
    const extraPoint = points[i] || `Detail sudut lainnya juga rapi dan nyaman dipakai harian`;
    coreSpecs.push({
      label: `Adegan ${i + 1} · Sudut B-Roll Tambahan`,
      durationSec: 4,
      voiceText: `${extraPoint}.`,
      kineticText: extractAppleKineticHeadline(extraPoint),
      action: 'Alternative angle showing accessories or usage',
      motion: i % 2 === 0 ? 'pan-right' : 'zoom-in',
    });
  }

  coreSpecs.push({
    label: `Adegan ${total} · Penasaran & CTA`,
    durationSec: 4,
    voiceText: ctaClosing,
    kineticText: ctaHeadline,
    action: 'Clean catalog hero shot with space at bottom for callout',
    motion: 'zoom-out',
  });

  return coreSpecs.map((spec, idx) => ({
    id: `scene-${idx + 1}`,
    label: spec.label,
    durationSec: spec.durationSec,
    voiceText: spec.voiceText,
    kineticText: spec.kineticText,
    visualPrompt: buildSyariVisualPrompt(brief, spec.action),
    motion: spec.motion,
    layout: getDefaultLayout(brief.videoStyle, idx, coreSpecs.length),
    sfxId: getDefaultSfxByCategory(brief.category, idx),
  }));
}

export function auditCompliance(
  brief: ProductBrief,
  scenes: StudioScene[],
  aiLabelAcknowledged: boolean,
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  const combinedScript = scenes.map((s) => s.voiceText.toLowerCase()).join(' ');
  const foundOverclaims = OVERCLAIM_TERMS.filter((term) => combinedScript.includes(term));
  if (foundOverclaims.length > 0) {
    issues.push({
      id: 'overclaim',
      severity: 'error',
      title: 'Terdeteksi Kata Berisiko Overclaim',
      detail: `Hindari frasa: ${foundOverclaims.join(', ')} agar tidak melanggar kebijakan promosi Shopee/TikTok.`,
    });
  } else {
    issues.push({
      id: 'overclaim',
      severity: 'pass',
      title: 'Naskah Bebas Kata Overclaim',
      detail: 'Tidak ditemukan klaim mutlak yang umum ditolak moderasi marketplace.',
    });
  }

  const visualCount = scenes.filter((s) => Boolean(s.visualFile)).length;
  if (visualCount === 0) {
    issues.push({
      id: 'visual-fidelity',
      severity: 'warning',
      title: 'Belum Ada Foto/B-Roll Produk',
      detail: 'Tempel link produk atau seret foto/klip B-Roll produk agar bentuk & warna barang akurat.',
    });
  } else {
    issues.push({
      id: 'visual-fidelity',
      severity: 'pass',
      title: `${visualCount}/${scenes.length} Adegan Terisi Media Produk`,
      detail: 'Menggunakan aset produk Anda sendiri untuk menjaga akurasi barang.',
    });
  }

  const presenterCount = scenes.filter((s) => Boolean(s.presenterFile)).length;
  if (brief.videoStyle === 'talking-head-broll' && presenterCount === 0) {
    issues.push({
      id: 'presenter-media',
      severity: 'warning',
      title: 'Gaya Talking-Head + B-Roll Belum Ada Video/Foto Presenter',
      detail: 'Rekam webcam Talking-Head di tab Teleprompter atau unggah video/karakter presenter agar split-screen aktif.',
    });
  }

  const voiceCount = scenes.filter((s) => Boolean(s.audioBlob) || (s.usePresenterAudio && Boolean(s.presenterFile))).length;
  if (voiceCount === 0) {
    issues.push({
      id: 'human-voice',
      severity: 'warning',
      title: 'Belum Ada Rekaman Suara Asli',
      detail: 'Rekam suara/talking-head di tab Teleprompter agar lebih dipercaya & biaya TTS Rp 0.',
    });
  } else {
    issues.push({
      id: 'human-voice',
      severity: 'pass',
      title: `Suara Manusia Asli (${voiceCount}/${scenes.length} Adegan)`,
      detail: 'Rekaman mikrofon asli — bukan suara AI — dan 0% musik/alat musik.',
    });
  }

  if (brief.hidePriceInVideo && /\brp\s*\d/i.test(combinedScript)) {
    issues.push({
      id: 'hide-price',
      severity: 'warning',
      title: 'Naskah Masih Menyebut Nominal Harga',
      detail: 'Mode "Sembunyikan Harga" aktif agar penonton penasaran klik keranjang. Hapus angka Rp dari teks naskah.',
    });
  } else if (brief.hidePriceInVideo) {
    issues.push({
      id: 'hide-price',
      severity: 'pass',
      title: 'Harga Disembunyikan (Mode Penasaran)',
      detail: 'Naskah tidak menyebut nominal harga sehingga mendorong klik ke keranjang.',
    });
  }

  issues.push({
    id: 'syari-guardrail',
    severity: 'pass',
    title: `Guardrail Syar'i (${VISUAL_MODE_LABELS[brief.visualMode].badge})`,
    detail: 'Audio B-Roll eksternal otomatis di-mute; hanya suara narasi + whitelist SFX non-musikal.',
  });

  if (!aiLabelAcknowledged) {
    issues.push({
      id: 'ai-label',
      severity: 'warning',
      title: 'Konfirmasi Toggle Label AI',
      detail: 'Wajib aktifkan "Konten dihasilkan AI" di Shopee/TikTok bila memakai visual hasil AI.',
    });
  } else {
    issues.push({
      id: 'ai-label',
      severity: 'pass',
      title: 'Kepatuhan Label AI Siap',
      detail: 'Siap mengaktifkan label AI saat unggah bila ada aset generatif.',
    });
  }

  return issues;
}
