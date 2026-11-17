import { useEffect, useId, useRef, useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, X } from 'lucide-react';
import type { ByokConfig, ByokPresetId } from '../types/studio';
import { BYOK_PRESETS, testByokConnection } from '../lib/ai-client';

interface ByokModalProps {
  open: boolean;
  config: ByokConfig;
  onClose: () => void;
  onSave: (next: ByokConfig) => void;
}

export function ByokModal({ open, config, onClose, onSave }: ByokModalProps) {
  const titleId = useId();
  const baseUrlId = useId();
  const apiKeyId = useId();
  const modelId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [draft, setDraft] = useState<ByokConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setDraft(config);
    setTestResult(null);
  }, [config, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fallback click-outside light dismiss where `closedby="any"` is unsupported
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
    };

    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, []);

  const handleNativeClose = () => {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = '';
    onClose();
  };

  const handlePresetChange = (preset: ByokPresetId) => {
    const info = BYOK_PRESETS[preset];
    setDraft((prev) => ({
      ...prev,
      mode: 'byok',
      preset,
      baseUrl: info.baseUrl || prev.baseUrl,
      model: info.defaultModel || prev.model,
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const reply = await testByokConnection(draft);
      setTestResult({ ok: true, msg: reply });
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleNativeClose}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-header">
        <h2 id={titleId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <KeyRound size={18} /> Pengaturan AI (BYOK + Base URL)
        </h2>
        <button type="button" className="btn" onClick={() => dialogRef.current?.close()} aria-label="Tutup dialog">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <p className="card-desc">
            API Key &amp; Base URL hanya disimpan di perangkat lokal Anda (browser/desktop). Server studio tidak menyimpan
            saldo atau token Anda.
          </p>

          <fieldset>
            <legend>Pilih Mode Sumber AI</legend>
            <div className="radio-cards">
              <label className="radio-card">
                <input
                  type="radio"
                  name="aiMode"
                  checked={draft.mode === 'none'}
                  onChange={() => setDraft((p) => ({ ...p, mode: 'none' }))}
                />
                <div>
                  <strong>Tanpa API (Gratis 100%)</strong>
                  <div className="hint">Template skrip lokal + Copy Prompt Syar&apos;i ke Gemini/Flow/ChatGPT.</div>
                </div>
              </label>

              <label className="radio-card">
                <input
                  type="radio"
                  name="aiMode"
                  checked={draft.mode === 'byok'}
                  onChange={() => setDraft((p) => ({ ...p, mode: 'byok' }))}
                />
                <div>
                  <strong>BYOK + Base URL Sendiri</strong>
                  <div className="hint">Pakai SumoPod, OpenRouter, Gemini API, Groq, atau Ollama lokal.</div>
                </div>
              </label>
            </div>
          </fieldset>

          {draft.mode === 'byok' && (
            <>
              <div className="field">
                <label htmlFor="byok-preset">Provider Preset</label>
                <select
                  id="byok-preset"
                  name="preset"
                  value={draft.preset}
                  onChange={(e) => handlePresetChange(e.target.value as ByokPresetId)}
                >
                  {Object.entries(BYOK_PRESETS).map(([id, item]) => (
                    <option key={id} value={id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="hint">{BYOK_PRESETS[draft.preset].hint}</span>
              </div>

              <div className="field">
                <label htmlFor={baseUrlId}>
                  Base URL <span aria-hidden="true">*</span>
                </label>
                <input
                  id={baseUrlId}
                  name="baseUrl"
                  type="url"
                  required
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="https://ai.sumopod.com/v1"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft((p) => ({ ...p, baseUrl: e.target.value }))}
                />
                <span className="error-msg">Masukkan URL valid diawali http:// atau https://</span>
              </div>

              <div className="field">
                <label htmlFor={apiKeyId}>API Key (sk-...)</label>
                <input
                  id={apiKeyId}
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="sk-..."
                  value={draft.apiKey}
                  onChange={(e) => setDraft((p) => ({ ...p, apiKey: e.target.value }))}
                />
                <span className="hint">Kosongkan hanya jika memakai Ollama lokal tanpa auth.</span>
              </div>

              <div className="field">
                <label htmlFor={modelId}>
                  Nama Model <span aria-hidden="true">*</span>
                </label>
                <input
                  id={modelId}
                  name="model"
                  type="text"
                  required
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="gpt-4o-mini / gemini-2.5-flash"
                  value={draft.model}
                  onChange={(e) => setDraft((p) => ({ ...p, model: e.target.value }))}
                />
              </div>

              <div className="row-actions">
                <button type="button" className="btn" onClick={handleTest} disabled={testing || !draft.baseUrl || !draft.model}>
                  {testing ? 'Menghubungi Endpoint...' : 'Tes Koneksi AI'}
                </button>
              </div>

              {testResult && (
                <div
                  className={`status-item ${testResult.ok ? 'pass' : 'error'}`}
                  style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  role="status"
                >
                  {testResult.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.msg}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            Batal
          </button>
          <button type="submit" className="btn primary">
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </dialog>
  );
}

