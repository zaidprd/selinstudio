export type ProductCategory = 'tech' | 'home';

export type VisualGuardrailMode = 'product-only' | 'hands-only' | 'faceless-minimal';

export type VideoStylePreset = 'product-motion' | 'talking-head-broll' | 'broll-hands';

export type SceneLayout = 'full' | 'split-top-presenter' | 'pip-presenter';

export type CaptionStyle = 'apple-kinetic' | 'classic';

export type HookStyle = 'review-jujur' | 'masalah-solusi' | 'demo-spesifikasi';

export type MotionPreset = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';

export type ByokPresetId = 'sumopod' | 'openrouter' | 'gemini' | 'groq' | 'ollama' | 'custom';

export interface ByokConfig {
  mode: 'none' | 'byok';
  preset: ByokPresetId;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProductBrief {
  name: string;
  category: ProductCategory;
  priceText: string;
  hidePriceInVideo: boolean;
  keyBenefit: string;
  targetAudience: string;
  productUrl: string;
  hookStyle: HookStyle;
  visualMode: VisualGuardrailMode;
  videoStyle: VideoStylePreset;
  ctaTarget: 'keranjang-kuning' | 'keranjang-oranye' | 'link-bio';
}

export interface StudioScene {
  id: string;
  label: string;
  durationSec: number;
  voiceText: string;
  kineticText?: string;
  visualPrompt: string;
  motion: MotionPreset;
  layout: SceneLayout;
  sfxId: string;
  visualFile?: File;
  visualPreviewUrl?: string;
  visualKind?: 'image' | 'video';
  presenterFile?: File;
  presenterPreviewUrl?: string;
  presenterKind?: 'image' | 'video';
  usePresenterAudio?: boolean;
  clipStartSec?: number;
  audioBlob?: Blob;
  audioPreviewUrl?: string;
  recordedDurationSec?: number;
}

export interface HalalSfxItem {
  id: string;
  name: string;
  category: string;
  safety?: 'safe' | 'review';
  description: string;
  halalNote: string;
}

export interface ComplianceIssue {
  id: string;
  severity: 'error' | 'warning' | 'pass';
  title: string;
  detail: string;
}

export interface RenderResult {
  filename: string;
  url: string;
  sizeBytes: number;
  totalDurationSec: number;
}
