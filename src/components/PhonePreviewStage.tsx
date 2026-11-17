import { useEffect, useRef, useState } from 'react';
import { Play, Square, Eye, Sparkles, Cpu, Home } from 'lucide-react';
import type { CaptionStyle, ProductBrief, StudioScene } from '../types/studio';

interface PhonePreviewStageProps {
  brief: ProductBrief;
  scenes: StudioScene[];
  activeIndex: number;
  burnSubtitles: boolean;
  captionStyle: CaptionStyle;
  onChangeCaptionStyle?: (style: CaptionStyle) => void;
  onSelectScene: (index: number) => void;
}

export function PhonePreviewStage({
  brief,
  scenes,
  activeIndex,
  burnSubtitles,
  captionStyle,
  onChangeCaptionStyle,
  onSelectScene,
}: PhonePreviewStageProps) {
  const safeIdx = Math.min(activeIndex, Math.max(0, scenes.length - 1));
  const scene = scenes[safeIdx] || scenes[0];
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [playingPreview, setPlayingPreview] = useState(false);

  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopPreview = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (voiceRef.current) {
      voiceRef.current.pause();
      voiceRef.current = null;
    }
    if (sfxRef.current) {
      sfxRef.current.pause();
      sfxRef.current = null;
    }
    setPlayingPreview(false);
  };

  useEffect(() => {
    return () => stopPreview();
  }, []);

  const playFromIndex = (idx: number) => {
    const target = scenes[idx];
    if (!target) {
      stopPreview();
      return;
    }
    onSelectScene(idx);
    setPlayingPreview(true);

    if (target.sfxId && target.sfxId !== 'none') {
      const sfx = new Audio(`/api/sfx/${encodeURIComponent(target.sfxId)}`);
      sfx.volume = 0.55;
      sfxRef.current = sfx;
      sfx.play().catch(() => {});
    }

    const advanceNext = () => {
      if (idx + 1 < scenes.length) {
        playFromIndex(idx + 1);
      } else {
        setPlayingPreview(false);
      }
    };

    if (target.audioPreviewUrl) {
      const voice = new Audio(target.audioPreviewUrl);
      voiceRef.current = voice;
      voice.onended = advanceNext;
      voice.play().catch(advanceNext);
    } else {
      timerRef.current = window.setTimeout(advanceNext, Math.max(2.2, target.durationSec || 3.5) * 1000);
    }
  };

  if (!scene) return null;

  const isSplit = scene.layout === 'split-top-presenter' && scene.presenterPreviewUrl && scene.visualPreviewUrl;
  const isPip = scene.layout === 'pip-presenter' && scene.presenterPreviewUrl && scene.visualPreviewUrl;

  return (
    <div className="glass-card stage-card">
      <div className="stage-header">
        <div>
          <h2 style={{ margin: 0 }}>Layar Pratinjau 9:16</h2>
          <span className="hint">{scene.label}</span>
        </div>

        <div className="row-actions">
          {onChangeCaptionStyle && (
            <button
              type="button"
              className={`btn btn-sm ${captionStyle === 'apple-kinetic' ? 'primary' : ''}`}
              onClick={() => onChangeCaptionStyle(captionStyle === 'apple-kinetic' ? 'classic' : 'apple-kinetic')}
              title="Ganti gaya kartu kaca Apple vs Subtitle Klasik"
            >
              <Sparkles size={13} /> {captionStyle === 'apple-kinetic' ? 'Apple Glass' : 'Klasik'}
            </button>
          )}
          <button
            type="button"
            className={`btn btn-sm ${showSafeZone ? 'active-chip' : ''}`}
            onClick={() => setShowSafeZone((v) => !v)}
            title="Area aman tombol TikTok/Shopee"
          >
            <Eye size={13} /> Safe
          </button>
          <button
            type="button"
            className="btn btn-sm primary"
            onClick={playingPreview ? stopPreview : () => playFromIndex(safeIdx)}
          >
            {playingPreview ? <Square size={13} /> : <Play size={13} />}
            {playingPreview ? 'Stop' : 'Putar'}
          </button>
        </div>
      </div>

      <div className="preview-phone">
        {/* iPhone Dynamic Island + Story Progress Bars */}
        <div className="phone-top-chrome" aria-hidden="true">
          <div className="dynamic-island" />
          <div className="story-bars">
            {scenes.map((s, idx) => (
              <span
                key={s.id}
                className={`story-bar ${idx < safeIdx ? 'done' : idx === safeIdx ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* EffectCraft / After Effects Hook Chrome on Scene 1 */}
        {safeIdx === 0 && captionStyle === 'apple-kinetic' && (
          <div key={`ae-hook-${scene.id}-${scene.kineticText}`} className="ae-hook-overlay" aria-hidden="true">
            <span className="ae-hook-edge-left" />
            <span className="ae-hook-edge-right" />
            <div className="ae-hook-pill">⚡ HOOK · WAJIB TAHU</div>
          </div>
        )}

        {isSplit ? (
          <div className="phone-split">
            <div className="phone-split-top">
              {scene.presenterKind === 'video' ? (
                <video src={scene.presenterPreviewUrl} muted autoPlay loop playsInline />
              ) : (
                <img src={scene.presenterPreviewUrl} alt="Presenter" />
              )}
              <span className="stage-tag">Talking-Head</span>
            </div>
            <div className="phone-split-bottom">
              {scene.visualKind === 'video' ? (
                <video src={scene.visualPreviewUrl} muted autoPlay loop playsInline />
              ) : (
                <img src={scene.visualPreviewUrl} alt={scene.label} />
              )}
              <span className="stage-tag">B-Roll Produk</span>
            </div>
          </div>
        ) : (
          <>
            {scene.visualPreviewUrl || scene.presenterPreviewUrl ? (
              (scene.visualPreviewUrl ? scene.visualKind : scene.presenterKind) === 'video' ? (
                <video src={scene.visualPreviewUrl || scene.presenterPreviewUrl} muted autoPlay loop playsInline />
              ) : (
                <img src={scene.visualPreviewUrl || scene.presenterPreviewUrl} alt={scene.label} />
              )
            ) : (
              <div className="phone-ambient-canvas">
                <div className="ambient-orb orb-1" />
                <div className="ambient-orb orb-2" />
                <div className="ambient-orb orb-3" />
                <div className="phone-empty">
                  <div className="phone-empty-badge">
                    {brief.category === 'tech' ? <Cpu size={22} /> : <Home size={22} />}
                  </div>
                  <strong>{brief.name || 'Pratinjau Produk'}</strong>
                  <span>Tempel link Tokopedia/Shopee atau tekan Ctrl+V foto produk untuk mengisi latar.</span>
                </div>
              </div>
            )}

            {isPip && (
              <div className="phone-pip">
                {scene.presenterKind === 'video' ? (
                  <video src={scene.presenterPreviewUrl} muted autoPlay loop playsInline />
                ) : (
                  <img src={scene.presenterPreviewUrl} alt="Presenter PiP" />
                )}
              </div>
            )}
          </>
        )}

        {burnSubtitles && captionStyle === 'apple-kinetic' && (scene.kineticText || scene.voiceText) && (
          <div key={`${scene.id}-${scene.kineticText}-${scene.voiceText}`} className="apple-glass-card-stage">
            <div className="apple-glass-shine" aria-hidden="true" />
            {scene.kineticText && <div className="apple-kinetic-hero">{scene.kineticText}</div>}
            {safeIdx === 0 && <div className="ae-hook-accent-bar" aria-hidden="true" />}
            {scene.voiceText && <div className="apple-kinetic-sub">{scene.voiceText}</div>}
          </div>
        )}

        {burnSubtitles && captionStyle !== 'apple-kinetic' && scene.voiceText && (
          <div className="preview-caption">{scene.voiceText}</div>
        )}

        {showSafeZone && (
          <div className="safe-zone-overlay" aria-hidden="true">
            <div className="safe-zone-right">
              <span />
              <span />
              <span />
            </div>
            <div className="safe-zone-cta">
              {brief.ctaTarget === 'keranjang-kuning'
                ? '🛒 Cek Keranjang Kuning'
                : brief.ctaTarget === 'keranjang-oranye'
                  ? '🛒 Cek Keranjang Oranye'
                  : '🔗 Cek Link Bio'}
            </div>
          </div>
        )}
      </div>

      <div className="mini-timeline" role="tablist" aria-label="Pilih adegan untuk pratinjau">
        {scenes.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={idx === safeIdx}
            className={`mini-scene-pill ${idx === safeIdx ? 'active' : ''}`}
            onClick={() => onSelectScene(idx)}
            title={`Lihat pratinjau ${s.label}`}
          >
            <span>Adegan {idx + 1}</span>
            <span className="hint">
              {s.visualFile ? '🖼️✓' : '🖼️-'} · {s.audioBlob || s.usePresenterAudio ? '🎙️✓' : '🎙️-'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
