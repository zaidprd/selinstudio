import { useMemo, useRef, useState } from 'react';
import { Volume2, ShieldCheck, RefreshCw, Sparkles, Camera, VolumeX } from 'lucide-react';
import type { HalalSfxItem, StudioScene } from '../types/studio';

interface SfxPickerProps {
  scenes: StudioScene[];
  sfxCatalog: HalalSfxItem[];
  blockedSfxNames?: string[];
  onRefreshSfx?: () => void;
  onChangeSceneSfx: (sceneIndex: number, sfxId: string) => void;
  onApplyPresetSfx?: (preset: 'apple-clean' | 'camera-catalog' | 'mute-all') => void;
}

export function SfxPicker({
  scenes,
  sfxCatalog,
  blockedSfxNames = [],
  onRefreshSfx,
  onChangeSceneSfx,
  onApplyPresetSfx,
}: SfxPickerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('semua');
  const [strictSafeOnly, setStrictSafeOnly] = useState<boolean>(true);

  const categories = useMemo(() => {
    const set = new Set<string>(['semua']);
    for (const item of sfxCatalog) {
      if (item.id === 'none') continue;
      if (strictSafeOnly && item.safety === 'review') continue;
      set.add(item.category);
    }
    return Array.from(set);
  }, [sfxCatalog, strictSafeOnly]);

  const filteredCatalog = useMemo(() => {
    return sfxCatalog.filter((item) => {
      if (item.id === 'none') return true;
      if (strictSafeOnly && item.safety === 'review') return false;
      if (selectedCategory !== 'semua' && item.category !== selectedCategory) return false;
      return true;
    });
  }, [sfxCatalog, selectedCategory, strictSafeOnly]);

  const previewSfx = (sfxId: string) => {
    if (!sfxId || sfxId === 'none') return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/api/sfx/${encodeURIComponent(sfxId)}`);
    audioRef.current = audio;
    audio.play().catch(() => {});
  };

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>4. Efek Suara Halal (0% Musik)</h2>
        {onRefreshSfx && (
          <button type="button" className="btn btn-sm" onClick={onRefreshSfx}>
            <RefreshCw size={14} /> Scan Ulang Folder SFX
          </button>
        )}
      </div>

      <p className="card-desc">
        Pilih paket SFX otomatis sekali klik, atau atur per adegan dari {sfxCatalog.length - 1} efek foley non-musikal.
      </p>

      {onApplyPresetSfx && (
        <div className="row-actions" style={{ marginBlockEnd: '1rem' }}>
          <button type="button" className="btn primary" onClick={() => onApplyPresetSfx('apple-clean')}>
            <Sparkles size={15} /> Preset Apple Clean (Swoosh + Pop)
          </button>
          <button type="button" className="btn" onClick={() => onApplyPresetSfx('camera-catalog')}>
            <Camera size={15} /> Preset Katalog Kamera
          </button>
          <button type="button" className="btn" onClick={() => onApplyPresetSfx('mute-all')}>
            <VolumeX size={15} /> Hening Semua
          </button>
        </div>
      )}

      <div className="row-actions" style={{ marginBlockEnd: '0.85rem' }}>
        <span className="pill ok">
          <ShieldCheck size={14} /> {sfxCatalog.length - 1} SFX Terdeteksi
        </span>
        {blockedSfxNames.length > 0 && (
          <span className="pill warn" title={blockedSfxNames.join(', ')}>
            {blockedSfxNames.length} Beatbox/Musik Diblokir Otomatis
          </span>
        )}
      </div>

      <div className="status-list">
        {scenes.map((scene, idx) => {
          const selected = sfxCatalog.find((s) => s.id === scene.sfxId);
          const options =
            selected && !filteredCatalog.some((i) => i.id === selected.id)
              ? [selected, ...filteredCatalog]
              : filteredCatalog;
          return (
            <div key={scene.id} className="scene-card">
              <div className="scene-head">
                <strong>{scene.label}</strong>
                {scene.sfxId !== 'none' && (
                  <button type="button" className="btn btn-sm" onClick={() => previewSfx(scene.sfxId)}>
                    <Volume2 size={14} /> Tes Bunyi
                  </button>
                )}
              </div>

              <div className="field" style={{ marginBlockEnd: '0.25rem' }}>
                <label htmlFor={`sfx-select-${scene.id}`}>Efek Suara Transisi Adegan</label>
                <select
                  id={`sfx-select-${scene.id}`}
                  value={scene.sfxId}
                  onChange={(e) => onChangeSceneSfx(idx, e.target.value)}
                >
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.name}
                      {item.safety === 'review' ? ' (Perlu Cek)' : ''}
                    </option>
                  ))}
                </select>
                {selected && <span className="hint">{selected.halalNote}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <details className="apple-details" style={{ marginBlockStart: '0.9rem' }}>
        <summary>Filter Kategori Folder SFX ({categories.length} kategori)</summary>
        <div className="details-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBlock: '0.6rem' }}>
            <input
              id="strict-sfx-only"
              type="checkbox"
              checked={strictSafeOnly}
              onChange={(e) => setStrictSafeOnly(e.target.checked)}
            />
            <label htmlFor="strict-sfx-only" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>
              Sembunyikan folder yang berpotensi punya nada digital (Money / Risers / UI)
            </label>
          </div>
          <div className="template-strip">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`template-chip ${selectedCategory === cat ? 'active-chip' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
