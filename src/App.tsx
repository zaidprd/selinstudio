import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Settings,
  Copy,
  Check,
  Film,
  Download,
  ShieldCheck,
  Cpu,
  Home,
  ExternalLink,
  ImagePlus,
  Wand2,
  UserCheck,
  ClipboardPaste,
  Plus,
  Trash2,
} from 'lucide-react';
import type {
  ByokConfig,
  CaptionStyle,
  HalalSfxItem,
  MotionPreset,
  ProductBrief,
  RenderResult,
  SceneLayout,
  StudioScene,
  VideoStylePreset,
} from './types/studio';
import {
  auditCompliance,
  BEGINNER_TEMPLATES,
  buildExternalBridgePrompt,
  createExtraScene,
  extractAppleKineticHeadline,
  generateLocalSyariStoryboard,
  getCategoryFocusHint,
  planScenesFromSpokenScript,
  VIDEO_STYLE_LABELS,
  VISUAL_MODE_LABELS,
  type SpokenSegmentInput,
} from './lib/syari-guardrails';
import { generateStoryboardWithByok } from './lib/ai-client';
import { ByokModal } from './components/ByokModal';
import { TeleprompterRecorder, type ContinuousSceneTiming } from './components/TeleprompterRecorder';
import { SfxPicker } from './components/SfxPicker';
import { CompliancePanel } from './components/CompliancePanel';
import { DropzoneUpload } from './components/DropzoneUpload';
import { PhonePreviewStage } from './components/PhonePreviewStage';

const BYOK_STORAGE_KEY = 'selin.byok.v1';

const DEFAULT_BYOK: ByokConfig = {
  mode: 'none',
  preset: 'sumopod',
  baseUrl: 'https://ai.sumopod.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};

const DEFAULT_BRIEF: ProductBrief = {
  name: 'Mini Air Fryer Low Watt 4L',
  category: 'home',
  priceText: '',
  hidePriceInVideo: true,
  keyBenefit: 'masak tanpa minyak, daya hemat 600W, wadah anti lengket gampang dibersihkan',
  targetAudience: 'keluarga muda dan anak kos di Indonesia',
  productUrl: '',
  hookStyle: 'masalah-solusi',
  visualMode: 'hands-only',
  videoStyle: 'talking-head-broll',
  ctaTarget: 'keranjang-kuning',
};

const STEPS = [
  { id: 1, label: 'Produk & Gaya' },
  { id: 2, label: 'Skrip & Media' },
  { id: 3, label: 'Teleprompter' },
  { id: 4, label: 'SFX Halal' },
  { id: 5, label: 'Render MP4' },
] as const;

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

export function App() {
  const [step, setStep] = useState<number>(1);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokConfig, setByokConfig] = useState<ByokConfig>(() => {
    try {
      const saved = localStorage.getItem(BYOK_STORAGE_KEY) || localStorage.getItem('noorcraft.byok.v1');
      return saved ? { ...DEFAULT_BYOK, ...JSON.parse(saved) } : DEFAULT_BYOK;
    } catch {
      return DEFAULT_BYOK;
    }
  });

  const [brief, setBrief] = useState<ProductBrief>(DEFAULT_BRIEF);
  const [scenes, setScenes] = useState<StudioScene[]>(() => generateLocalSyariStoryboard(DEFAULT_BRIEF));
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const [fetchingLink, setFetchingLink] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const [sfxCatalog, setSfxCatalog] = useState<HalalSfxItem[]>([
    {
      id: 'none',
      name: 'Tanpa SFX (Hening)',
      category: 'none',
      description: 'Hanya suara Anda',
      halalNote: 'Nol audio tambahan.',
    },
  ]);
  const [blockedSfxNames, setBlockedSfxNames] = useState<string[]>([]);

  const loadSfxCatalog = () => {
    fetch('/api/sfx')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setSfxCatalog(d.items);
        if (Array.isArray(d.blockedNames)) setBlockedSfxNames(d.blockedNames);
      })
      .catch(() => {});
  };

  const [serverHealth, setServerHealth] = useState<{ ok: boolean; ffmpegOk: boolean; effectcraftOk: boolean }>({
    ok: false,
    ffmpegOk: false,
    effectcraftOk: false,
  });

  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [aiLabelAcknowledged, setAiLabelAcknowledged] = useState(true);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('apple-kinetic');
  const [rendering, setRendering] = useState(false);
  const [exportingEc, setExportingEc] = useState(false);
  const [ecExportResult, setEcExportResult] = useState<{ filename: string; url: string; localPath: string } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) =>
        setServerHealth({
          ok: Boolean(d.ok),
          ffmpegOk: Boolean(d.ffmpegOk),
          effectcraftOk: Boolean(d.effectcraftOk),
        }),
      )
      .catch(() => setServerHealth({ ok: false, ffmpegOk: false, effectcraftOk: false }));

    loadSfxCatalog();
  }, []);

  const appendVisualFilesNonOverwriting = (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    let lastFilledIndex = 0;

    setScenes((prev) => {
      const next = [...prev];
      for (const file of incomingFiles) {
        const emptyIdx = next.findIndex((s) => !s.visualFile);
        const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
        const previewUrl = URL.createObjectURL(file);
        if (emptyIdx !== -1) {
          if (next[emptyIdx].visualPreviewUrl) URL.revokeObjectURL(next[emptyIdx].visualPreviewUrl!);
          next[emptyIdx] = { ...next[emptyIdx], visualFile: file, visualPreviewUrl: previewUrl, visualKind: kind };
          lastFilledIndex = emptyIdx;
        } else {
          const extra = createExtraScene(brief, next.length);
          next.push({ ...extra, visualFile: file, visualPreviewUrl: previewUrl, visualKind: kind });
          lastFilledIndex = next.length - 1;
        }
      }
      return next;
    });

    setActiveSceneIndex(lastFilledIndex);
    setPasteNotice(
      incomingFiles.length === 1
        ? `1 foto ditambahkan ke Adegan ${lastFilledIndex + 1} tanpa menimpa adegan lain!`
        : `${incomingFiles.length} file media ditambahkan (sampai Adegan ${lastFilledIndex + 1}) tanpa menimpa adegan yang sudah terisi!`,
    );
    window.setTimeout(() => setPasteNotice(null), 4500);
  };

  const applySinglePastedImage = (file: File) => {
    if (step === 2) {
      setScenes((prev) =>
        prev.map((s, idx) => {
          if (idx !== activeSceneIndex) return s;
          if (s.visualPreviewUrl) URL.revokeObjectURL(s.visualPreviewUrl);
          return {
            ...s,
            visualFile: file,
            visualPreviewUrl: URL.createObjectURL(file),
            visualKind: 'image',
          };
        }),
      );
      setPasteNotice(`Foto ditempel ke Adegan ${activeSceneIndex + 1}.`);
      window.setTimeout(() => setPasteNotice(null), 4000);
      return;
    }

    appendVisualFilesNonOverwriting([file]);
  };

  const fetchImageUrlIntoStudio = async (rawUrl: string) => {
    try {
      const res = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = await res.json();
      if (data.imageDataUrl) {
        const file = await dataUrlToFile(data.imageDataUrl, data.imageFilename || `paste-${Date.now()}.jpg`);
        applySinglePastedImage(file);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  };

  const handleClipboardButtonClick = async () => {
    setPasteNotice(null);
    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const ext = imgType.split('/')[1] || 'png';
            const file = new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imgType });
            applySinglePastedImage(file);
            return;
          }
          if (item.types.includes('text/html')) {
            const htmlBlob = await item.getType('text/html');
            const htmlText = await htmlBlob.text();
            const match = htmlText.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (match?.[1] && (await fetchImageUrlIntoStudio(match[1]))) return;
          }
          if (item.types.includes('text/plain')) {
            const textBlob = await item.getType('text/plain');
            const textVal = (await textBlob.text()).trim();
            if (
              /^https?:\/\/.+\.(?:jpe?g|png|webp|avif)/i.test(textVal) ||
              /^https?:\/\/.*(?:tokopedia-static|susercontent|shopee)/i.test(textVal)
            ) {
              if (await fetchImageUrlIntoStudio(textVal)) return;
            }
          }
        }
      }
      setPasteNotice(
        'Tidak ditemukan gambar di clipboard. Klik kanan foto produk → "Copy image", lalu klik tombol ini lagi atau tekan Ctrl+V.',
      );
    } catch {
      setPasteNotice('Cukup klik di halaman ini lalu tekan tombol Ctrl+V di keyboard Anda.');
    }
  };

  // Allow Ctrl+V image paste anywhere in the studio
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        (target as HTMLInputElement).type !== 'file';

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const ext = item.type.split('/')[1] || 'png';
            applySinglePastedImage(new File([file], `paste-produk-${Date.now()}.${ext}`, { type: item.type }));
            return;
          }
        }
      }

      if (isTextField) return;

      const htmlText = e.clipboardData?.getData('text/html') || '';
      const imgMatch = htmlText.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch?.[1]) {
        e.preventDefault();
        await fetchImageUrlIntoStudio(imgMatch[1]);
        return;
      }

      const plain = (e.clipboardData?.getData('text/plain') || '').trim();
      if (
        /^https?:\/\/.+/i.test(plain) &&
        (/\.(?:jpe?g|png|webp|avif)/i.test(plain) || /susercontent|tokopedia-static/i.test(plain))
      ) {
        e.preventDefault();
        await fetchImageUrlIntoStudio(plain);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const complianceIssues = useMemo(
    () => auditCompliance(brief, scenes, aiLabelAcknowledged),
    [brief, scenes, aiLabelAcknowledged],
  );

  const handleSaveByok = (next: ByokConfig) => {
    setByokConfig(next);
    try {
      localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const applyBeginnerTemplate = (templateId: string) => {
    const found = BEGINNER_TEMPLATES.find((t) => t.id === templateId);
    if (!found) return;
    const nextBrief: ProductBrief = { ...brief, ...found.brief };
    setBrief(nextBrief);
    const nextScenes = generateLocalSyariStoryboard(nextBrief);
    setScenes((prev) =>
      nextScenes.map((n, idx) => ({
        ...n,
        visualFile: prev[idx]?.visualFile,
        visualPreviewUrl: prev[idx]?.visualPreviewUrl,
        visualKind: prev[idx]?.visualKind,
        presenterFile: prev[idx]?.presenterFile,
        presenterPreviewUrl: prev[idx]?.presenterPreviewUrl,
        presenterKind: prev[idx]?.presenterKind,
        usePresenterAudio: prev[idx]?.usePresenterAudio,
        audioBlob: prev[idx]?.audioBlob,
        audioPreviewUrl: prev[idx]?.audioPreviewUrl,
        recordedDurationSec: prev[idx]?.recordedDurationSec,
      })),
    );
  };

  const handleFetchProductLink = async () => {
    if (!brief.productUrl.trim()) return;
    setFetchingLink(true);
    setLinkStatus(null);
    try {
      const res = await fetch('/api/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: brief.productUrl.trim() }),
      });
      const data = await res.json();
      if (!data.ok || data.blocked) {
        if (data.suggestedTitle || data.suggestedCategory) {
          const fallbackBrief: ProductBrief = {
            ...brief,
            name: data.suggestedTitle || brief.name,
            category:
              data.suggestedCategory === 'tech' || data.suggestedCategory === 'home'
                ? data.suggestedCategory
                : brief.category,
          };
          setBrief(fallbackBrief);
          const syncedFallback = generateLocalSyariStoryboard(fallbackBrief, Math.max(4, scenes.length));
          setScenes((prev) =>
            syncedFallback.map((n, idx) => ({
              ...n,
              visualFile: prev[idx]?.visualFile,
              visualPreviewUrl: prev[idx]?.visualPreviewUrl,
              visualKind: prev[idx]?.visualKind,
              presenterFile: prev[idx]?.presenterFile,
              presenterPreviewUrl: prev[idx]?.presenterPreviewUrl,
              presenterKind: prev[idx]?.presenterKind,
              usePresenterAudio: prev[idx]?.usePresenterAudio,
              audioBlob: prev[idx]?.audioBlob,
              audioPreviewUrl: prev[idx]?.audioPreviewUrl,
              recordedDurationSec: prev[idx]?.recordedDurationSec,
            })),
          );
        }
        const prefix = data.suggestedTitle ? `Nama produk terisi otomatis ("${data.suggestedTitle}"). ` : '';
        setLinkStatus({
          ok: false,
          msg:
            prefix +
            (data.message ||
              data.error ||
              'Link tidak dapat dibaca penuh. Cukup Copy Image dari toko lalu tekan Ctrl+V di bawah.'),
        });
        return;
      }

      const nextCategory =
        data.suggestedCategory === 'tech' || data.suggestedCategory === 'home'
          ? data.suggestedCategory
          : brief.category;

      const nextBrief: ProductBrief = {
        ...brief,
        name: data.title || brief.name,
        keyBenefit: data.description || brief.keyBenefit,
        priceText: data.priceText || brief.priceText,
        category: nextCategory,
      };
      setBrief(nextBrief);

      const rawImages: Array<{ dataUrl: string; filename?: string }> =
        Array.isArray(data.images) && data.images.length > 0
          ? data.images
          : data.imageDataUrl
            ? [{ dataUrl: data.imageDataUrl, filename: data.imageFilename }]
            : [];

      const downloadedFiles = await Promise.all(
        rawImages.map((img, i) => dataUrlToFile(img.dataUrl, img.filename || `produk-${i + 1}.jpg`)),
      );

      const syncedScenes = generateLocalSyariStoryboard(nextBrief, Math.max(4, downloadedFiles.length));

      setScenes((prev) =>
        syncedScenes.map((n, idx) => {
          const picked = downloadedFiles.length > 0 ? downloadedFiles[idx] : prev[idx]?.visualFile;
          const previewUrl =
            downloadedFiles.length > 0 && picked ? URL.createObjectURL(picked) : prev[idx]?.visualPreviewUrl;
          return {
            ...n,
            visualFile: picked,
            visualPreviewUrl: previewUrl,
            visualKind: picked ? (picked.type.startsWith('video/') ? 'video' : 'image') : prev[idx]?.visualKind,
            presenterFile: prev[idx]?.presenterFile,
            presenterPreviewUrl: prev[idx]?.presenterPreviewUrl,
            presenterKind: prev[idx]?.presenterKind,
            usePresenterAudio: prev[idx]?.usePresenterAudio,
            audioBlob: prev[idx]?.audioBlob,
            audioPreviewUrl: prev[idx]?.audioPreviewUrl,
            recordedDurationSec: prev[idx]?.recordedDurationSec,
          };
        }),
      );

      setLinkStatus({
        ok: true,
        msg:
          downloadedFiles.length > 0
            ? `Berhasil mengambil info produk, ${downloadedFiles.length} foto produk, dan menyinkronkan skrip pratinjau!`
            : 'Judul & deskripsi produk berhasil diambil dan disinkronkan ke pratinjau. Tambahkan foto di bawah.',
      });
    } catch (err) {
      setLinkStatus({
        ok: false,
        msg: err instanceof Error ? err.message : 'Gagal menghubungi server pembaca link.',
      });
    } finally {
      setFetchingLink(false);
    }
  };

  const handleGenerateStoryboard = async (forceLocal = false) => {
    setScriptError(null);
    const mergeMedia = (nextScenes: StudioScene[]) =>
      setScenes((prev) =>
        nextScenes.map((n, idx) => ({
          ...n,
          visualFile: prev[idx]?.visualFile,
          visualPreviewUrl: prev[idx]?.visualPreviewUrl,
          visualKind: prev[idx]?.visualKind,
          presenterFile: prev[idx]?.presenterFile,
          presenterPreviewUrl: prev[idx]?.presenterPreviewUrl,
          presenterKind: prev[idx]?.presenterKind,
          usePresenterAudio: prev[idx]?.usePresenterAudio,
          audioBlob: prev[idx]?.audioBlob,
          audioPreviewUrl: prev[idx]?.audioPreviewUrl,
          recordedDurationSec: prev[idx]?.recordedDurationSec,
        })),
      );

    if (forceLocal || byokConfig.mode === 'none') {
      mergeMedia(generateLocalSyariStoryboard(brief, Math.max(4, scenes.length)));
      setStep(2);
      return;
    }

    setGeneratingScript(true);
    try {
      const aiScenes = await generateStoryboardWithByok(byokConfig, brief);
      mergeMedia(aiScenes);
      setStep(2);
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleVisualUpload = (sceneIndex: number, file: File | undefined) => {
    if (!file) return;
    const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (idx !== sceneIndex) return s;
        if (s.visualPreviewUrl) URL.revokeObjectURL(s.visualPreviewUrl);
        return { ...s, visualFile: file, visualPreviewUrl: previewUrl, visualKind: kind };
      }),
    );
  };

  const handleBatchVisualUpload = (files: File[]) => {
    appendVisualFilesNonOverwriting(files);
  };

  const handleRemoveSceneVisual = (sceneIndex: number) => {
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (idx !== sceneIndex) return s;
        if (s.visualPreviewUrl) URL.revokeObjectURL(s.visualPreviewUrl);
        return { ...s, visualFile: undefined, visualPreviewUrl: undefined, visualKind: undefined };
      }),
    );
  };

  const handleAddScene = () => {
    setScenes((prev) => [...prev, createExtraScene(brief, prev.length)]);
  };

  const handleDeleteScene = (sceneIndex: number) => {
    if (scenes.length <= 1) return;
    setScenes((prev) => prev.filter((_, i) => i !== sceneIndex));
    setActiveSceneIndex((prev) => Math.max(0, Math.min(prev, scenes.length - 2)));
  };

  const handlePresenterUpload = (sceneIndex: number | 'all', file: File | undefined, useAudio = false) => {
    if (!file) return;
    const kind: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (sceneIndex !== 'all' && idx !== sceneIndex) return s;
        if (s.presenterPreviewUrl) URL.revokeObjectURL(s.presenterPreviewUrl);
        return {
          ...s,
          presenterFile: file,
          presenterPreviewUrl: URL.createObjectURL(file),
          presenterKind: kind,
          usePresenterAudio: useAudio && kind === 'video',
          layout: s.layout === 'full' && s.visualFile ? 'split-top-presenter' : s.layout,
        };
      }),
    );
  };

  const handleSaveAudio = (sceneIndex: number, blob: Blob, durationSec: number) => {
    const url = URL.createObjectURL(blob);
    const syncedDur = Math.max(3, Math.ceil(durationSec));
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (idx !== sceneIndex) return s;
        if (s.audioPreviewUrl) URL.revokeObjectURL(s.audioPreviewUrl);
        return {
          ...s,
          audioBlob: blob,
          audioPreviewUrl: url,
          recordedDurationSec: durationSec,
          durationSec: syncedDur,
          clipStartSec: undefined,
        };
      }),
    );
  };

  const handleSavePresenterWebcam = (sceneIndex: number, file: File, durationSec: number) => {
    const url = URL.createObjectURL(file);
    const syncedDur = Math.max(3, Math.ceil(durationSec));
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (idx !== sceneIndex) return s;
        if (s.presenterPreviewUrl) URL.revokeObjectURL(s.presenterPreviewUrl);
        return {
          ...s,
          presenterFile: file,
          presenterPreviewUrl: url,
          presenterKind: 'video',
          usePresenterAudio: true,
          recordedDurationSec: durationSec,
          durationSec: syncedDur,
          clipStartSec: undefined,
          layout: s.visualFile ? (idx === 0 || idx === prev.length - 1 ? 'split-top-presenter' : 'pip-presenter') : 'full',
        };
      }),
    );
  };

  const handleSaveContinuousTake = (
    timings: ContinuousSceneTiming[],
    blob: Blob,
    mode: 'webcam' | 'mic',
  ) => {
    const timingMap = new Map(timings.map((t) => [t.sceneIndex, t]));
    const sharedVideoFile =
      mode === 'webcam'
        ? new File([blob], `talking-head-1take-${Date.now()}.webm`, { type: blob.type || 'video/webm' })
        : undefined;

    setScenes((prev) =>
      prev.map((s, idx) => {
        const hit = timingMap.get(idx);
        if (!hit) return s;
        const syncedDur = Math.max(3, Math.ceil(hit.durationSec));
        if (mode === 'webcam' && sharedVideoFile) {
          return {
            ...s,
            presenterFile: sharedVideoFile,
            presenterPreviewUrl: URL.createObjectURL(blob),
            presenterKind: 'video',
            usePresenterAudio: true,
            clipStartSec: hit.startSec,
            recordedDurationSec: hit.durationSec,
            durationSec: syncedDur,
            layout: s.visualFile ? (idx === 0 || idx === prev.length - 1 ? 'split-top-presenter' : 'pip-presenter') : 'full',
          };
        }
        return {
          ...s,
          audioBlob: blob,
          audioPreviewUrl: URL.createObjectURL(blob),
          clipStartSec: hit.startSec,
          recordedDurationSec: hit.durationSec,
          durationSec: syncedDur,
        };
      }),
    );
  };

  const handleClearAudio = (sceneIndex: number) => {
    setScenes((prev) =>
      prev.map((s, idx) => {
        if (idx !== sceneIndex) return s;
        if (s.audioPreviewUrl) URL.revokeObjectURL(s.audioPreviewUrl);
        return { ...s, audioBlob: undefined, audioPreviewUrl: undefined, recordedDurationSec: undefined };
      }),
    );
  };

  const handleApplySpokenScript = (segments: SpokenSegmentInput[], recordedVideoFile?: File) => {
    const planned = planScenesFromSpokenScript(segments, brief, scenes, recordedVideoFile);
    setScenes(planned);
    setActiveSceneIndex(0);
    setCaptionStyle('apple-kinetic');
    setStep(2);
    setPasteNotice(
      `Berhasil menyusun ${planned.length} adegan Kinetik Apple-Style & B-Roll otomatis dari ucapan Talking-Head Anda!`,
    );
    window.setTimeout(() => setPasteNotice(null), 5000);
  };

  const handleApplyPresetSfx = (preset: 'apple-clean' | 'camera-catalog' | 'mute-all') => {
    if (preset === 'mute-all') {
      setScenes((prev) => prev.map((s) => ({ ...s, sfxId: 'none' })));
      return;
    }
    if (preset === 'camera-catalog') {
      setScenes((prev) =>
        prev.map((s, idx) => ({
          ...s,
          sfxId: idx % 2 === 0 ? 'shutter-snap' : 'soft-whoosh',
        })),
      );
      return;
    }
    // apple-clean
    const cycle = ['soft-whoosh', 'mech-click', 'desk-tap', 'air-pop'];
    setScenes((prev) =>
      prev.map((s, idx) => ({
        ...s,
        sfxId: cycle[idx % cycle.length],
      })),
    );
  };

  const handleExportEcproj = async () => {
    setExportingEc(true);
    setRenderError(null);
    setEcExportResult(null);
    try {
      const formData = new FormData();
      formData.append(
        'manifest',
        JSON.stringify({
          productName: brief.name,
          scenes: scenes.map((s) => ({
            id: s.id,
            label: s.label,
            durationSec: s.durationSec,
            voiceText: s.voiceText,
            kineticText: s.kineticText || '',
          })),
        }),
      );
      scenes.forEach((s, idx) => {
        if (s.visualFile) formData.append(`visual_${idx}`, s.visualFile, s.visualFile.name);
      });
      const res = await fetch('/api/export-ecproj', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal ekspor ke EffectCraft.');
      setEcExportResult({ filename: data.filename, url: data.url, localPath: data.localPath });
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setExportingEc(false);
    }
  };

  const handleRenderMp4 = async () => {
    setRendering(true);
    setRenderError(null);
    setRenderResult(null);

    try {
      const formData = new FormData();
      formData.append(
        'manifest',
        JSON.stringify({
          productName: brief.name,
          burnSubtitles,
          captionStyle,
          scenes: scenes.map((s) => ({
            id: s.id,
            label: s.label,
            durationSec: s.durationSec,
            voiceText: s.voiceText,
            kineticText: s.kineticText || '',
            motion: s.motion,
            layout: s.layout,
            usePresenterAudio: Boolean(s.usePresenterAudio),
            clipStartSec: s.clipStartSec,
            sfxId: s.sfxId,
          })),
        }),
      );

      scenes.forEach((s, idx) => {
        if (s.visualFile) formData.append(`visual_${idx}`, s.visualFile, s.visualFile.name);
        if (s.presenterFile) formData.append(`presenter_${idx}`, s.presenterFile, s.presenterFile.name);
        if (s.audioBlob) formData.append(`audio_${idx}`, s.audioBlob, `voice_${idx}.webm`);
      });

      const res = await fetch('/api/render', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal merender MP4.');
      setRenderResult(data as RenderResult);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  };

  const uploadedVisualCount = scenes.filter((s) => Boolean(s.visualFile)).length;
  const uploadedPresenterCount = scenes.filter((s) => Boolean(s.presenterFile)).length;

  return (
    <div className="studio-shell">
      <header className="topbar">
        <div className="brand-title">
          <div className="brand-logo" aria-hidden="true">
            SL
          </div>
          <div>
            <h1>Selin Studio — Affiliate Video Syar&apos;i</h1>
            <p className="brand-sub">
              Apple Liquid Glass · Talking-Head + B-Roll · 0% Musik (SFX-Only) · Render FFmpeg Lokal
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className={`pill ${serverHealth.ffmpegOk ? 'ok' : 'warn'}`}>
            <Film size={13} /> {serverHealth.ffmpegOk ? 'FFmpeg Siap' : 'Server Offline'}
          </span>

          {serverHealth.effectcraftOk && (
            <span className="pill ok">
              <Sparkles size={13} /> EffectCraft Glass
            </span>
          )}

          <button type="button" className="btn btn-sm" onClick={() => setByokOpen(true)}>
            <Settings size={14} />
            {byokConfig.mode === 'byok' ? `AI: ${byokConfig.preset.toUpperCase()}` : 'AI: Gratis (Lokal)'}
          </button>
        </div>
      </header>

      <div className="template-strip" aria-label="Template cepat pemula">
        <span className="pill">
          <Wand2 size={13} /> Mulai Cepat:
        </span>
        {BEGINNER_TEMPLATES.map((tpl) => (
          <button key={tpl.id} type="button" className="template-chip" onClick={() => applyBeginnerTemplate(tpl.id)}>
            <span>{tpl.label}</span>
            <span className="hint">({tpl.tag})</span>
          </button>
        ))}
      </div>

      <nav className="step-nav" aria-label="Tahapan Produksi Video">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="step-btn"
            aria-current={step === item.id ? 'step' : undefined}
            onClick={() => setStep(item.id)}
          >
            <span className="step-num">{item.id}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="studio-layout">
        <main className="studio-main-col">
          {step === 1 && (
            <section className="card glass-card">
              <h2>1. Masukkan Produk &amp; Pilih Gaya Video</h2>
              <p className="card-desc">
                Tempel link toko <strong>atau</strong> langsung tekan <strong>Ctrl+V / seret foto produk</strong> di
                bawah. Tidak perlu pindah-pindah menu.
              </p>

              {/* Unified Step 1: Link + Upload/Paste in one place */}
              <div className="field">
                <label htmlFor="product-url">1A. Tempel Link Produk (Tokopedia / Shopee / URL Gambar)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    id="product-url"
                    type="url"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={brief.productUrl}
                    onChange={(e) => setBrief((p) => ({ ...p, productUrl: e.target.value }))}
                    placeholder="https://www.tokopedia.com/... atau https://shopee.co.id/..."
                    style={{ flex: '1 1 230px' }}
                  />
                  <button
                    type="button"
                    className="btn primary"
                    disabled={fetchingLink || !brief.productUrl.trim()}
                    onClick={handleFetchProductLink}
                  >
                    {fetchingLink ? 'Mengambil...' : 'Ambil Info & Foto'}
                  </button>
                </div>
              </div>

              {pasteNotice && (
                <div className="status-item pass" style={{ marginBlockEnd: '0.8rem' }} role="status">
                  {pasteNotice}
                </div>
              )}

              {linkStatus && (
                <div
                  className={`status-item ${linkStatus.ok ? 'pass' : 'warning'}`}
                  style={{ marginBlockEnd: '0.8rem' }}
                  role="status"
                >
                  <div>{linkStatus.msg}</div>
                </div>
              )}

              <div className="field">
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', marginBlockEnd: '0.25rem' }}>
                  <label>1B. Foto Produk / Video B-Roll (Bisa Banyak Gambar)</label>
                  <button type="button" className="btn btn-sm primary" onClick={handleClipboardButtonClick}>
                    <ClipboardPaste size={13} /> Tempel Gambar Clipboard (Ctrl+V)
                  </button>
                </div>
                <DropzoneUpload
                  title="Seret Foto Produk / Video B-Roll ke Sini (Atau Tekan Ctrl+V)"
                  hint="Setiap foto otomatis mengisi Adegan 1, 2, 3, 4, 5 dst. tanpa menimpa foto sebelumnya."
                  badgeText={uploadedVisualCount > 0 ? `${uploadedVisualCount}/${scenes.length} Adegan Terisi` : undefined}
                  onFiles={handleBatchVisualUpload}
                />
              </div>

              {uploadedVisualCount > 0 && (
                <div className="media-gallery-strip" aria-label="Daftar foto/klip terkumpul">
                  {scenes.map(
                    (sc, idx) =>
                      sc.visualPreviewUrl && (
                        <div key={sc.id} className="media-chip">
                          {sc.visualKind === 'video' ? (
                            <video src={sc.visualPreviewUrl} muted />
                          ) : (
                            <img src={sc.visualPreviewUrl} alt={`Adegan ${idx + 1}`} />
                          )}
                          <button
                            type="button"
                            className="media-chip-del"
                            aria-label={`Hapus media Adegan ${idx + 1}`}
                            onClick={() => handleRemoveSceneVisual(idx)}
                          >
                            ×
                          </button>
                          <div className="media-chip-label">Adegan {idx + 1}</div>
                        </div>
                      ),
                  )}
                </div>
              )}

              <div className="field">
                <label htmlFor="product-name">
                  Nama Produk <span aria-hidden="true">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  required
                  value={brief.name}
                  onChange={(e) => setBrief((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Contoh: Brica B-VLOG M4 Wireless Microphone"
                />
              </div>

              <div className="field">
                <label htmlFor="product-benefit">Keunggulan Utama / Masalah yang Diselesaikan</label>
                <textarea
                  id="product-benefit"
                  value={brief.keyBenefit}
                  onChange={(e) => setBrief((p) => ({ ...p, keyBenefit: e.target.value }))}
                  placeholder="Contoh: peredam bising jernih, jarak 60m, baterai awet seharian"
                />
              </div>

              <fieldset>
                <legend>Gaya Format Video</legend>
                <div className="radio-cards">
                  {(Object.keys(VIDEO_STYLE_LABELS) as VideoStylePreset[]).map((styleKey) => (
                    <label key={styleKey} className="radio-card">
                      <input
                        type="radio"
                        name="videoStyle"
                        checked={brief.videoStyle === styleKey}
                        onChange={() => setBrief((p) => ({ ...p, videoStyle: styleKey }))}
                      />
                      <div>
                        <strong>{VIDEO_STYLE_LABELS[styleKey].title}</strong>
                        <div className="hint">{VIDEO_STYLE_LABELS[styleKey].subtitle}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>

              {brief.videoStyle === 'talking-head-broll' && (
                <div className="field">
                  <DropzoneUpload
                    title="Opsional: Upload Video / Foto Presenter Talking-Head"
                    hint="Anda juga bisa langsung rekam kamera & suara di Langkah 3 (Teleprompter)."
                    multiple={false}
                    badgeText={uploadedPresenterCount > 0 ? 'Presenter Siap' : undefined}
                    onFiles={(files) => handlePresenterUpload('all', files[0], true)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBlockEnd: '0.85rem' }}>
                <input
                  id="hide-price-toggle"
                  type="checkbox"
                  checked={brief.hidePriceInVideo}
                  onChange={(e) => setBrief((p) => ({ ...p, hidePriceInVideo: e.target.checked }))}
                />
                <label htmlFor="hide-price-toggle" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  Sembunyikan harga di video (agar penonton penasaran klik keranjang)
                </label>
              </div>

              {/* Progressive disclosure for secondary/advanced options */}
              <details className="apple-details" style={{ marginBlockEnd: '0.95rem' }}>
                <summary>Pengaturan Lanjutan &amp; Adab Visual AI (Opsional)</summary>
                <div style={{ marginBlockStart: '0.85rem' }}>
                  <fieldset>
                    <legend>Kategori Niche Produk</legend>
                    <div className="radio-cards">
                      <label className="radio-card">
                        <input
                          type="radio"
                          name="category"
                          checked={brief.category === 'tech'}
                          onChange={() => setBrief((p) => ({ ...p, category: 'tech' }))}
                        />
                        <div>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Cpu size={15} /> Teknologi &amp; Gadget
                          </strong>
                          <div className="hint">TWS, mic, powerbank, lampu meja, aksesoris.</div>
                        </div>
                      </label>

                      <label className="radio-card">
                        <input
                          type="radio"
                          name="category"
                          checked={brief.category === 'home'}
                          onChange={() => setBrief((p) => ({ ...p, category: 'home' }))}
                        />
                        <div>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Home size={15} /> Peralatan Rumah Tangga
                          </strong>
                          <div className="hint">Air fryer, vacuum, rak dapur, alat kebersihan.</div>
                        </div>
                      </label>
                    </div>
                    <span className="hint">{getCategoryFocusHint(brief.category)}</span>
                  </fieldset>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem' }}>
                    {!brief.hidePriceInVideo && (
                      <div className="field">
                        <label htmlFor="product-price">Harga / Promo (Opsional)</label>
                        <input
                          id="product-price"
                          type="text"
                          value={brief.priceText}
                          onChange={(e) => setBrief((p) => ({ ...p, priceText: e.target.value }))}
                          placeholder="Rp 349.000"
                        />
                      </div>
                    )}

                    <div className="field">
                      <label htmlFor="hook-style">Gaya Hook 3 Detik</label>
                      <select
                        id="hook-style"
                        value={brief.hookStyle}
                        onChange={(e) => setBrief((p) => ({ ...p, hookStyle: e.target.value as ProductBrief['hookStyle'] }))}
                      >
                        <option value="masalah-solusi">Masalah &amp; Solusi</option>
                        <option value="review-jujur">Review Jujur Pemakaian</option>
                        <option value="demo-spesifikasi">Demo Spesifikasi Cepat</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="cta-target">Arah CTA</label>
                      <select
                        id="cta-target"
                        value={brief.ctaTarget}
                        onChange={(e) => setBrief((p) => ({ ...p, ctaTarget: e.target.value as ProductBrief['ctaTarget'] }))}
                      >
                        <option value="keranjang-kuning">Keranjang Kuning (TikTok)</option>
                        <option value="keranjang-oranye">Keranjang Oranye (Shopee)</option>
                        <option value="link-bio">Link di Bio</option>
                      </select>
                    </div>
                  </div>

                  <fieldset style={{ marginBlockEnd: 0 }}>
                    <legend>Guardrail Visual Syar&apos;i (Untuk Generate AI &amp; Prompt)</legend>
                    <div className="radio-cards">
                      {(Object.keys(VISUAL_MODE_LABELS) as Array<keyof typeof VISUAL_MODE_LABELS>).map((modeKey) => (
                        <label key={modeKey} className="radio-card">
                          <input
                            type="radio"
                            name="visualMode"
                            checked={brief.visualMode === modeKey}
                            onChange={() => setBrief((p) => ({ ...p, visualMode: modeKey }))}
                          />
                          <div>
                            <strong>{VISUAL_MODE_LABELS[modeKey].title}</strong>
                            <div className="hint">{VISUAL_MODE_LABELS[modeKey].badge}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </details>

              {scriptError && (
                <div className="status-item error" style={{ marginBlockEnd: '0.85rem' }} role="alert">
                  {scriptError}
                </div>
              )}

              <div className="row-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={generatingScript}
                  onClick={() => handleGenerateStoryboard(false)}
                >
                  <Sparkles size={17} />
                  {generatingScript
                    ? 'Meracik Skrip via BYOK...'
                    : byokConfig.mode === 'byok'
                      ? `Generate Skrip via ${byokConfig.preset.toUpperCase()}`
                      : 'Buat Skrip & Lanjut ke Storyboard'}
                </button>

                {byokConfig.mode === 'byok' && (
                  <button type="button" className="btn" onClick={() => handleGenerateStoryboard(true)}>
                    Pakai Template Lokal
                  </button>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="card glass-card">
              <h2>2. Storyboard, Headline Apple Glass &amp; Media</h2>
              <p className="card-desc">
                Edit kalimat tiap adegan — <strong>Headline Apple Glass</strong> di atas kartu kaca akan ikut
                menyesuaikan otomatis.
              </p>

              {pasteNotice && (
                <div className="status-item pass" style={{ marginBlockEnd: '0.8rem' }} role="status">
                  {pasteNotice}
                </div>
              )}

              <div className="row-actions" style={{ marginBlockEnd: '0.8rem' }}>
                <button type="button" className="btn btn-sm primary" onClick={handleClipboardButtonClick}>
                  <ClipboardPaste size={14} /> Tempel Foto ke Adegan {activeSceneIndex + 1} (Ctrl+V)
                </button>
                <button type="button" className="btn btn-sm" onClick={handleAddScene}>
                  <Plus size={14} /> Tambah Adegan ({scenes.length + 1})
                </button>
              </div>

              <details className="apple-details" style={{ marginBlockEnd: '0.9rem' }}>
                <summary>Prompt Bridge AI Eksternal (Gemini / Flow / ChatGPT)</summary>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginBlockStart: '0.65rem',
                  }}
                >
                  <span className="hint">Salin prompt Syar&apos;i lengkap untuk membuat gambar/B-Roll di AI favorit Anda:</span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-sm primary"
                      onClick={() => copyText('bridge', buildExternalBridgePrompt(brief))}
                    >
                      {copiedId === 'bridge' ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === 'bridge' ? 'Tersalin!' : 'Copy Master Prompt'}
                    </button>
                    <a className="btn btn-sm" href="https://gemini.google.com/" target="_blank" rel="noreferrer">
                      Gemini <ExternalLink size={13} />
                    </a>
                    <a className="btn btn-sm" href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer">
                      Flow <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </details>

              {scenes.map((scene, idx) => {
                const showPresenterBox = brief.videoStyle === 'talking-head-broll' || scene.layout !== 'full';
                return (
                  <div
                    key={scene.id}
                    className="scene-card"
                    onClick={() => setActiveSceneIndex(idx)}
                    style={idx === activeSceneIndex ? { borderColor: 'var(--brand)' } : undefined}
                  >
                    <div className="scene-head">
                      <strong>{scene.label}</strong>
                      <div className="row-actions">
                        <span className="pill">{scene.durationSec} dtk</span>
                        <button type="button" className="btn btn-sm" onClick={() => copyText(scene.id, scene.visualPrompt)}>
                          {copiedId === scene.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === scene.id ? 'Disalin' : 'Prompt Visual'}
                        </button>
                        {scenes.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-sm danger"
                            aria-label={`Hapus ${scene.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScene(idx);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="scene-grid">
                      <div className="media-pair">
                        <div>
                          <div className="thumb-9-16">
                            {scene.visualPreviewUrl ? (
                              scene.visualKind === 'video' ? (
                                <video src={scene.visualPreviewUrl} muted loop playsInline />
                              ) : (
                                <img src={scene.visualPreviewUrl} alt={scene.label} />
                              )
                            ) : (
                              <span>Foto / B-Roll Produk</span>
                            )}
                          </div>
                          <label className="btn btn-sm" style={{ inlineSize: '100%', marginBlockStart: '0.35rem' }}>
                            <ImagePlus size={13} /> Produk / B-Roll
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="visually-hidden"
                              onChange={(e) => handleVisualUpload(idx, e.target.files?.[0])}
                            />
                          </label>
                        </div>

                        {showPresenterBox && (
                          <div>
                            <div className="thumb-9-16">
                              {scene.presenterPreviewUrl ? (
                                scene.presenterKind === 'video' ? (
                                  <video src={scene.presenterPreviewUrl} muted loop playsInline />
                                ) : (
                                  <img src={scene.presenterPreviewUrl} alt="Presenter" />
                                )
                              ) : (
                                <span>Presenter (Opsional)</span>
                              )}
                            </div>
                            <label className="btn btn-sm" style={{ inlineSize: '100%', marginBlockStart: '0.35rem' }}>
                              <UserCheck size={13} /> Presenter
                              <input
                                type="file"
                                accept="image/*,video/*"
                                className="visually-hidden"
                                onChange={(e) => handlePresenterUpload(idx, e.target.files?.[0], true)}
                              />
                            </label>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="field">
                          <label htmlFor={`voice-text-${scene.id}`}>Naskah Suara &amp; Subtitle</label>
                          <textarea
                            id={`voice-text-${scene.id}`}
                            value={scene.voiceText}
                            onChange={(e) => {
                              const nextVoice = e.target.value;
                              setScenes((prev) =>
                                prev.map((s, i) =>
                                  i === idx
                                    ? {
                                        ...s,
                                        voiceText: nextVoice,
                                        kineticText: extractAppleKineticHeadline(nextVoice),
                                      }
                                    : s,
                                ),
                              );
                            }}
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`kinetic-text-${scene.id}`}>Headline Kinetik Apple Glass (2–3 Kata Besar)</label>
                          <input
                            id={`kinetic-text-${scene.id}`}
                            type="text"
                            value={scene.kineticText || ''}
                            placeholder="Contoh: SUARA JERNIH"
                            onChange={(e) =>
                              setScenes((prev) =>
                                prev.map((s, i) => (i === idx ? { ...s, kineticText: e.target.value } : s)),
                              )
                            }
                          />
                        </div>

                        <div className="row-actions" style={{ marginBlockEnd: '0.45rem' }}>
                          <span className="pill ok">
                            Preset Otomatis: Gerak {scene.motion} · SFX Aktif · {scene.durationSec} dtk
                          </span>
                        </div>

                        <details className="apple-details">
                          <summary>Ubah gerak kamera / tata letak manual (opsional)</summary>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                              gap: '0.55rem',
                              marginBlockStart: '0.65rem',
                            }}
                          >
                            <div className="field" style={{ marginBlockEnd: 0 }}>
                              <label htmlFor={`layout-${scene.id}`}>Tata Letak</label>
                              <select
                                id={`layout-${scene.id}`}
                                value={scene.layout}
                                onChange={(e) =>
                                  setScenes((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, layout: e.target.value as SceneLayout } : s,
                                    ),
                                  )
                                }
                              >
                                <option value="full">Full Frame</option>
                                <option value="split-top-presenter">Split (Atas + Bawah)</option>
                                <option value="pip-presenter">B-Roll + PiP</option>
                              </select>
                            </div>

                            <div className="field" style={{ marginBlockEnd: 0 }}>
                              <label htmlFor={`motion-${scene.id}`}>Gerak Kamera</label>
                              <select
                                id={`motion-${scene.id}`}
                                value={scene.motion}
                                onChange={(e) =>
                                  setScenes((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, motion: e.target.value as MotionPreset } : s,
                                    ),
                                  )
                                }
                              >
                                <option value="zoom-in">Zoom In Halus</option>
                                <option value="zoom-out">Zoom Out Halus</option>
                                <option value="pan-right">Geser Kanan</option>
                                <option value="pan-left">Geser Kiri</option>
                              </select>
                            </div>

                            <div className="field" style={{ marginBlockEnd: 0 }}>
                              <label htmlFor={`dur-${scene.id}`}>Durasi (dtk)</label>
                              <input
                                id={`dur-${scene.id}`}
                                type="number"
                                min={2}
                                max={20}
                                value={scene.durationSec}
                                onChange={(e) =>
                                  setScenes((prev) =>
                                    prev.map((s, i) =>
                                      i === idx ? { ...s, durationSec: Number(e.target.value) || 4 } : s,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="row-actions" style={{ marginBlockStart: '1rem' }}>
                <button type="button" className="btn primary" onClick={() => setStep(3)}>
                  Lanjut ke Teleprompter &amp; Rekam Suara
                </button>
                <button type="button" className="btn" onClick={() => setStep(5)}>
                  <Film size={15} /> Langsung Render MP4 (SFX &amp; Animasi Sudah Otomatis)
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <>
              <TeleprompterRecorder
                scenes={scenes}
                activeIndex={activeSceneIndex}
                onSelectScene={setActiveSceneIndex}
                onSaveAudio={handleSaveAudio}
                onClearAudio={handleClearAudio}
                onSavePresenterVideo={handleSavePresenterWebcam}
                onApplySpokenScript={handleApplySpokenScript}
                onSaveContinuousTake={handleSaveContinuousTake}
              />
              <div className="row-actions" style={{ marginBlockStart: '0.85rem' }}>
                <button type="button" className="btn primary" onClick={() => setStep(5)}>
                  <Film size={16} /> Langsung ke Render MP4 (SFX Sudah Otomatis dari Preset)
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <SfxPicker
              scenes={scenes}
              sfxCatalog={sfxCatalog}
              blockedSfxNames={blockedSfxNames}
              onRefreshSfx={loadSfxCatalog}
              onApplyPresetSfx={handleApplyPresetSfx}
              onChangeSceneSfx={(sceneIdx, sfxId) =>
                setScenes((prev) => prev.map((s, i) => (i === sceneIdx ? { ...s, sfxId } : s)))
              }
            />
          )}

          {step === 5 && (
            <section className="card glass-card">
              <h2>5. Render Video MP4 (1080×1920) via FFmpeg Lokal</h2>
              <p className="card-desc">
                Menggabungkan foto/B-Roll, layar split Talking-Head, normalisasi suara, SFX halal, dan kartu kaca Apple
                Liquid Glass di komputer Anda — modal server = <strong>Rp 0</strong>.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBlockEnd: '0.85rem' }}>
                <input
                  id="burn-subs"
                  type="checkbox"
                  checked={burnSubtitles}
                  onChange={(e) => setBurnSubtitles(e.target.checked)}
                />
                <label htmlFor="burn-subs">Tempel Auto-Caption dari naskah &amp; durasi rekaman (biaya ASR = Rp 0)</label>
              </div>

              {burnSubtitles && (
                <fieldset>
                  <legend>Gaya Tipografi Teks</legend>
                  <div className="radio-cards">
                    <label className="radio-card">
                      <input
                        type="radio"
                        name="captionStyle"
                        checked={captionStyle === 'apple-kinetic'}
                        onChange={() => setCaptionStyle('apple-kinetic')}
                      />
                      <div>
                        <strong>Apple Liquid Glass + Kinetic (Preset EffectCraft)</strong>
                        <div className="hint">Kartu kaca buram EffectCraft + headline kinetik + subtitle.</div>
                      </div>
                    </label>
                    <label className="radio-card">
                      <input
                        type="radio"
                        name="captionStyle"
                        checked={captionStyle === 'classic'}
                        onChange={() => setCaptionStyle('classic')}
                      />
                      <div>
                        <strong>Subtitle Klasik</strong>
                        <div className="hint">Teks putih standar dengan outline gelap di bawah.</div>
                      </div>
                    </label>
                  </div>
                </fieldset>
              )}

              <div className="row-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={rendering || !serverHealth.ffmpegOk}
                  onClick={handleRenderMp4}
                >
                  <Film size={17} /> {rendering ? 'Sedang Merender MP4...' : 'Render Video MP4 Sekarang'}
                </button>

                {serverHealth.effectcraftOk && (
                  <button
                    type="button"
                    className="btn"
                    disabled={exportingEc}
                    onClick={handleExportEcproj}
                  >
                    <Sparkles size={16} />
                    {exportingEc ? 'Membuat .ecproj...' : 'Ekspor Project EffectCraft (.ecproj)'}
                  </button>
                )}
              </div>

              {ecExportResult && (
                <div className="status-item pass" style={{ marginBlockStart: '0.85rem' }}>
                  <div>
                    Project EffectCraft siap dibuka di EffectCraft: <strong>{ecExportResult.localPath}</strong>
                  </div>
                  <div className="row-actions" style={{ marginBlockStart: '0.5rem' }}>
                    <a className="btn btn-sm primary" href={ecExportResult.url} download={ecExportResult.filename}>
                      <Download size={14} /> Unduh {ecExportResult.filename}
                    </a>
                  </div>
                </div>
              )}

              {!serverHealth.ffmpegOk && (
                <div className="status-item warning" style={{ marginBlockStart: '0.85rem' }}>
                  Server render lokal (`npm run dev`) belum aktif atau FFmpeg tidak terdeteksi.
                </div>
              )}

              {renderError && (
                <div className="status-item error" style={{ marginBlockStart: '0.85rem' }} role="alert">
                  {renderError}
                </div>
              )}

              {renderResult && (
                <div className="card" style={{ marginBlockStart: '1rem', background: 'var(--bg-page)' }}>
                  <div className="pill ok" style={{ marginBlockEnd: '0.75rem' }}>
                    <ShieldCheck size={14} /> Render Selesai · {renderResult.totalDurationSec} detik ·{' '}
                    {(renderResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </div>

                  <video
                    controls
                    src={renderResult.url}
                    style={{ inlineSize: 'min(320px, 100%)', display: 'block', margin: '0 auto 1rem', borderRadius: '14px' }}
                  />

                  <div className="row-actions" style={{ justifyContent: 'center' }}>
                    <a className="btn primary" href={renderResult.url} download={renderResult.filename}>
                      <Download size={16} /> Unduh Video MP4 Siap Upload
                    </a>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>

        <aside className="studio-stage-col">
          <PhonePreviewStage
            brief={brief}
            scenes={scenes}
            activeIndex={activeSceneIndex}
            burnSubtitles={burnSubtitles}
            captionStyle={captionStyle}
            onSelectScene={setActiveSceneIndex}
            onChangeCaptionStyle={setCaptionStyle}
          />

          <CompliancePanel
            issues={complianceIssues}
            aiLabelAcknowledged={aiLabelAcknowledged}
            onToggleAiLabel={setAiLabelAcknowledged}
          />
        </aside>
      </div>

      <ByokModal
        open={byokOpen}
        config={byokConfig}
        onClose={() => setByokOpen(false)}
        onSave={handleSaveByok}
      />
    </div>
  );
}
