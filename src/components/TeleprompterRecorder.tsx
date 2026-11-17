import { useEffect, useRef, useState } from 'react';
import { Mic, Video, Square, RotateCcw, Play, Headphones, Sparkles, SkipForward, CheckCircle2 } from 'lucide-react';
import type { StudioScene } from '../types/studio';
import { splitFreeScriptIntoSegments, type SpokenSegmentInput } from '../lib/syari-guardrails';

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface ContinuousSceneTiming {
  sceneIndex: number;
  startSec: number;
  durationSec: number;
}

interface TeleprompterRecorderProps {
  scenes: StudioScene[];
  activeIndex: number;
  onSelectScene: (index: number) => void;
  onSaveAudio: (index: number, blob: Blob, durationSec: number) => void;
  onClearAudio: (index: number) => void;
  onSavePresenterVideo: (index: number, file: File, durationSec: number) => void;
  onApplySpokenScript: (segments: SpokenSegmentInput[], recordedVideoFile?: File) => void;
  onSaveContinuousTake?: (timings: ContinuousSceneTiming[], blob: Blob, mode: 'webcam' | 'mic') => void;
}

export function TeleprompterRecorder({
  scenes,
  activeIndex,
  onSelectScene,
  onSaveAudio,
  onClearAudio,
  onSavePresenterVideo,
  onApplySpokenScript,
  onSaveContinuousTake,
}: TeleprompterRecorderProps) {
  const activeScene = scenes[activeIndex];
  const [workflowTab, setWorkflowTab] = useState<'flow' | 'guided' | 'freestyle'>('flow');
  const [recordMode, setRecordMode] = useState<'mic' | 'webcam'>('webcam');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [micError, setMicError] = useState<string | null>(null);
  const [flowCompletedNotice, setFlowCompletedNotice] = useState<string | null>(null);

  // Freestyle Talking-Head live speech-to-script state
  const [freestyleTranscript, setFreestyleTranscript] = useState('');
  const [freestyleInterim, setFreestyleInterim] = useState('');
  const [freestyleVideoFile, setFreestyleVideoFile] = useState<File | undefined>(undefined);
  const [freestyleVideoUrl, setFreestyleVideoUrl] = useState<string | null>(null);
  const [freestyleDuration, setFreestyleDuration] = useState(0);
  const [speechSupported] = useState(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const timedSegmentsRef = useRef<SpokenSegmentInput[]>([]);
  const lastSegmentEndRef = useRef<number>(0);

  // Continuous 1-take flow state (speaker controls when text advances)
  const flowCursorIndexRef = useRef<number>(0);
  const flowLastMarkSecRef = useRef<number>(0);
  const flowTimingsRef = useRef<ContinuousSceneTiming[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const stopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Advance to the next scene at the speaker's exact pace during 1-Take Flow Recording
  const handleAdvanceFlowScene = () => {
    if (!isRecording || workflowTab !== 'flow') return;
    const nowSec = (Date.now() - startedAtRef.current) / 1000;
    const curIdx = flowCursorIndexRef.current;
    const startSec = flowLastMarkSecRef.current;
    const dur = Math.max(2.2, Number((nowSec - startSec).toFixed(2)));

    flowTimingsRef.current.push({
      sceneIndex: curIdx,
      startSec: Number(startSec.toFixed(2)),
      durationSec: dur,
    });
    flowLastMarkSecRef.current = Number(nowSec.toFixed(2));

    if (curIdx + 1 < scenes.length) {
      const nextIdx = curIdx + 1;
      flowCursorIndexRef.current = nextIdx;
      onSelectScene(nextIdx);
    } else {
      // Finished the final scene!
      stopRecording();
    }
  };

  // Allow pressing SPACEBAR to advance to the next sentence during 1-Take Flow Recording
  useEffect(() => {
    if (!isRecording || workflowTab !== 'flow') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleAdvanceFlowScene();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const startRecording = async () => {
    setMicError(null);
    setFlowCompletedNotice(null);
    const currentTab = workflowTab;
    const isFreestyle = currentTab === 'freestyle';
    const isFlow = currentTab === 'flow';

    if (isFreestyle) {
      timedSegmentsRef.current = [];
      lastSegmentEndRef.current = 0;
      setFreestyleTranscript('');
      setFreestyleInterim('');
    }

    if (isFlow) {
      flowCursorIndexRef.current = 0;
      flowLastMarkSecRef.current = 0;
      flowTimingsRef.current = [];
      onSelectScene(0);
    }

    try {
      const constraints: MediaStreamConstraints =
        recordMode === 'webcam'
          ? {
              video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: 'user' },
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            }
          : {
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      chunksRef.current = [];

      if (recordMode === 'webcam' && liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        liveVideoRef.current.play().catch(() => {});
      }

      const preferredTypes =
        recordMode === 'webcam'
          ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
          : ['audio/webm;codecs=opus', 'audio/webm'];

      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      const targetIndex = activeIndex;
      const modeAtStart = recordMode;
      recorder.onstop = () => {
        const duration = Math.max(0.8, (Date.now() - startedAtRef.current) / 1000);
        const finalType = recorder.mimeType || (modeAtStart === 'webcam' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(chunksRef.current, { type: finalType });
        stream.getTracks().forEach((t) => t.stop());
        if (liveVideoRef.current) liveVideoRef.current.srcObject = null;

        if (isFlow) {
          // Record any remaining un-marked scenes up to current cursor
          const recordedSet = new Set(flowTimingsRef.current.map((t) => t.sceneIndex));
          const curIdx = flowCursorIndexRef.current;
          if (!recordedSet.has(curIdx)) {
            const startSec = flowLastMarkSecRef.current;
            const dur = Math.max(2.2, Number((duration - startSec).toFixed(2)));
            flowTimingsRef.current.push({
              sceneIndex: curIdx,
              startSec: Number(startSec.toFixed(2)),
              durationSec: dur,
            });
          }
          if (onSaveContinuousTake && flowTimingsRef.current.length > 0) {
            onSaveContinuousTake(flowTimingsRef.current, blob, modeAtStart);
            setFlowCompletedNotice(
              `Rekaman ${flowTimingsRef.current.length} adegan selesai (${duration.toFixed(1)} detik)! Durasi tiap adegan sudah otomatis menyesuaikan kecepatan bicara Anda.`,
            );
          }
          return;
        }

        if (isFreestyle) {
          const file = new File([blob], `freestyle-talking-head.webm`, { type: finalType });
          setFreestyleVideoFile(modeAtStart === 'webcam' ? file : undefined);
          setFreestyleDuration(Number(duration.toFixed(2)));
          if (freestyleVideoUrl) URL.revokeObjectURL(freestyleVideoUrl);
          setFreestyleVideoUrl(URL.createObjectURL(blob));
          return;
        }

        if (modeAtStart === 'webcam') {
          const file = new File([blob], `talking-head-scene-${targetIndex + 1}.webm`, { type: finalType });
          onSavePresenterVideo(targetIndex, file, Number(duration.toFixed(2)));
        } else {
          onSaveAudio(targetIndex, blob, Number(duration.toFixed(2)));
        }
      };

      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setIsRecording(true);
      recorder.start(150);

      if (isFreestyle && speechSupported) {
        const w = window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
        };
        const SpeechCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (SpeechCtor) {
          const rec = new SpeechCtor();
          rec.lang = 'id-ID';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            let interim = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
              const res = ev.results[i];
              const chunkText = res[0].transcript.trim();
              if (!chunkText) continue;
              if (res.isFinal) {
                const nowSec = (Date.now() - startedAtRef.current) / 1000;
                const startSec = lastSegmentEndRef.current;
                const dur = Math.max(2.2, Number((nowSec - startSec).toFixed(2)));
                lastSegmentEndRef.current = Number(nowSec.toFixed(2));
                timedSegmentsRef.current.push({ text: chunkText, startSec, durationSec: dur });
                setFreestyleTranscript((prev) => (prev ? `${prev}. ${chunkText}` : chunkText));
              } else {
                interim += ` ${chunkText}`;
              }
            }
            setFreestyleInterim(interim.trim());
          };
          rec.onerror = () => {};
          try {
            rec.start();
            recognitionRef.current = rec;
          } catch {
            // ignore start errors
          }
        }
      }

      timerRef.current = window.setInterval(() => {
        setElapsedSec(Number(((Date.now() - startedAtRef.current) / 1000).toFixed(1)));
      }, 100);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? `Akses ${recordMode === 'webcam' ? 'kamera/mikrofon' : 'mikrofon'} gagal: ${err.message}. Pastikan izin browser aktif.`
          : 'Tidak dapat membuka perangkat rekaman.',
      );
    }
  };

  const handleApplyFreestylePlan = () => {
    const cleanText = freestyleTranscript.trim();
    if (!cleanText) return;

    const segments =
      timedSegmentsRef.current.length >= 2 &&
      Math.abs(timedSegmentsRef.current.map((s) => s.text).join('. ').length - cleanText.length) < 25
        ? timedSegmentsRef.current
        : splitFreeScriptIntoSegments(cleanText, freestyleDuration);

    onApplySpokenScript(segments, freestyleVideoFile);
  };

  if (!activeScene) return null;

  const scriptFontSize =
    fontScale === 'xlarge'
      ? 'clamp(1.3rem, 1.1rem + 0.9vw, 1.65rem)'
      : fontScale === 'large'
        ? 'clamp(1.15rem, 1rem + 0.7vw, 1.42rem)'
        : '1.05rem';

  return (
    <div className="card glass-card">
      <h2>3. Teleprompter Anti-Terburu-buru (Teks Mengikuti Tempo Bicara Anda)</h2>
      <p className="card-desc">
        <strong>Anda tidak akan pernah kalah cepat dari teks!</strong> Durasi tiap adegan otomatis menyesuaikan panjang
        suara bicara Anda. Baca santai saja, lalu tekan <strong>Spasi</strong> saat selesai satu kalimat.
      </p>

      <div className="row-actions" style={{ marginBlockEnd: '0.85rem' }}>
        <button
          type="button"
          className={`btn btn-sm ${workflowTab === 'flow' ? 'primary' : ''}`}
          disabled={isRecording}
          onClick={() => setWorkflowTab('flow')}
        >
          <SkipForward size={14} /> Rekam Mengalir 1-Take (Tekan Spasi per Kalimat)
        </button>
        <button
          type="button"
          className={`btn btn-sm ${workflowTab === 'guided' ? 'primary' : ''}`}
          disabled={isRecording}
          onClick={() => setWorkflowTab('guided')}
        >
          Rekam Satu-Satu per Adegan
        </button>
        <button
          type="button"
          className={`btn btn-sm ${workflowTab === 'freestyle' ? 'primary' : ''}`}
          disabled={isRecording}
          onClick={() => setWorkflowTab('freestyle')}
        >
          <Sparkles size={14} /> Bicara Bebas Tanpa Naskah
        </button>
      </div>

      <div className="row-actions" style={{ marginBlockEnd: '0.85rem', justifyContent: 'space-between' }}>
        <div className="row-actions">
          <button
            type="button"
            className={`btn btn-sm ${recordMode === 'webcam' ? 'active-chip' : ''}`}
            disabled={isRecording}
            onClick={() => setRecordMode('webcam')}
          >
            <Video size={14} /> Kamera + Suara
          </button>
          <button
            type="button"
            className={`btn btn-sm ${recordMode === 'mic' ? 'active-chip' : ''}`}
            disabled={isRecording}
            onClick={() => setRecordMode('mic')}
          >
            <Mic size={14} /> Suara Saja (Tanpa Wajah)
          </button>
        </div>

        <div className="row-actions">
          <span className="hint">Ukuran Teks:</span>
          <button
            type="button"
            className={`btn btn-sm ${fontScale === 'normal' ? 'active-chip' : ''}`}
            onClick={() => setFontScale('normal')}
          >
            A
          </button>
          <button
            type="button"
            className={`btn btn-sm ${fontScale === 'large' ? 'active-chip' : ''}`}
            onClick={() => setFontScale('large')}
          >
            A+
          </button>
          <button
            type="button"
            className={`btn btn-sm ${fontScale === 'xlarge' ? 'active-chip' : ''}`}
            onClick={() => setFontScale('xlarge')}
          >
            A++
          </button>
        </div>
      </div>

      {flowCompletedNotice && (
        <div className="status-item pass" style={{ marginBlockEnd: '0.85rem' }} role="status">
          <CheckCircle2 size={15} style={{ verticalAlign: 'text-bottom', marginInlineEnd: '0.35rem' }} />
          {flowCompletedNotice}
        </div>
      )}

      {(workflowTab === 'flow' || workflowTab === 'guided') && (
        <>
          <div className="row-actions" style={{ marginBlockEnd: '0.85rem' }}>
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                type="button"
                className={`btn btn-sm ${idx === activeIndex ? 'primary' : ''}`}
                disabled={isRecording}
                onClick={() => onSelectScene(idx)}
              >
                Adegan {idx + 1} {scene.audioBlob || scene.usePresenterAudio ? '✓' : ''}
              </button>
            ))}
          </div>

          <div className="teleprompter-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="pill ok">
                Adegan {activeIndex + 1} dari {scenes.length} · {activeScene.kineticText || activeScene.label}
              </span>
              <span className="pill">
                <Headphones size={12} /> Tempo Bebas (Durasi video mengikuti suara Anda)
                {activeScene.recordedDurationSec ? ` · Terekam: ${activeScene.recordedDurationSec} dtk` : ''}
              </span>
            </div>

            {recordMode === 'webcam' && (
              <div style={{ marginBlockStart: '0.75rem' }}>
                <video
                  ref={liveVideoRef}
                  muted
                  playsInline
                  style={{
                    inlineSize: 'min(220px, 100%)',
                    aspectRatio: '9 / 16',
                    objectFit: 'cover',
                    borderRadius: '14px',
                    background: '#0b1110',
                    display: isRecording ? 'block' : 'none',
                    marginInline: 'auto',
                  }}
                />
              </div>
            )}

            <p className="teleprompter-script" style={{ fontSize: scriptFontSize }}>
              &ldquo;{activeScene.voiceText || '(Belum ada naskah untuk adegan ini)'}&rdquo;
            </p>

            {/* Show preview of next sentence so the speaker is never surprised */}
            {activeIndex + 1 < scenes.length && (
              <div className="hint" style={{ marginBlockEnd: '0.9rem', opacity: 0.8 }}>
                Kalimat berikutnya (Adegan {activeIndex + 2}): &ldquo;{scenes[activeIndex + 1].voiceText}&rdquo;
              </div>
            )}

            <div className="row-actions">
              {!isRecording ? (
                <button type="button" className="btn primary" onClick={startRecording}>
                  {recordMode === 'webcam' ? <Video size={17} /> : <Mic size={17} />}
                  {workflowTab === 'flow'
                    ? `Mulai Rekam Mengalir (Adegan 1 → ${scenes.length})`
                    : `Rekam Adegan ${activeIndex + 1} Saja`}
                </button>
              ) : (
                <>
                  {workflowTab === 'flow' && activeIndex < scenes.length - 1 && (
                    <button type="button" className="btn primary" onClick={handleAdvanceFlowScene}>
                      <SkipForward size={17} /> Kalimat Berikutnya (Atau Tekan Spasi) &rarr; Adegan {activeIndex + 2}
                    </button>
                  )}
                  <button type="button" className="btn danger" onClick={stopRecording}>
                    <Square size={17} /> Selesai Rekam ({elapsedSec.toFixed(1)} dtk)
                  </button>
                </>
              )}

              {activeScene.audioBlob && !isRecording && (
                <button type="button" className="btn" onClick={() => onClearAudio(activeIndex)}>
                  <RotateCcw size={15} /> Hapus Suara
                </button>
              )}

              {workflowTab === 'guided' && activeIndex < scenes.length - 1 && !isRecording && (
                <button type="button" className="btn" onClick={() => onSelectScene(activeIndex + 1)}>
                  <Play size={15} /> Lanjut Adegan {activeIndex + 2}
                </button>
              )}
            </div>

            {activeScene.audioPreviewUrl && !isRecording && (
              <div style={{ marginBlockStart: '0.85rem' }}>
                <audio controls src={activeScene.audioPreviewUrl} style={{ inlineSize: '100%' }} />
              </div>
            )}
          </div>
        </>
      )}

      {workflowTab === 'freestyle' && (
        <div className="teleprompter-box">
          <p className="hint" style={{ marginBlockStart: 0 }}>
            {speechSupported
              ? 'Bicara santai tanpa membaca teks. Ucapan Anda otomatis dicatat dan dipecah menjadi Teks Kinetik Apple Glass + B-Roll produk.'
              : 'Rekam bicara bebas lalu ketik/tempel kalimat ucapan Anda di bawah untuk dipecah menjadi Teks Kinetik Apple Glass + B-Roll.'}
          </p>

          {recordMode === 'webcam' && (
            <video
              ref={liveVideoRef}
              muted
              playsInline
              style={{
                inlineSize: 'min(220px, 100%)',
                aspectRatio: '9 / 16',
                objectFit: 'cover',
                borderRadius: '14px',
                background: '#0b1110',
                display: isRecording ? 'block' : 'none',
                marginInline: 'auto',
                marginBlockEnd: '0.75rem',
              }}
            />
          )}

          <div className="row-actions" style={{ marginBlockEnd: '0.85rem' }}>
            {!isRecording ? (
              <button type="button" className="btn primary" onClick={startRecording}>
                {recordMode === 'webcam' ? <Video size={17} /> : <Mic size={17} />}
                Mulai Rekam Bicara Bebas
              </button>
            ) : (
              <button type="button" className="btn danger" onClick={stopRecording}>
                <Square size={17} /> Selesai Bicara ({elapsedSec.toFixed(1)}s)
              </button>
            )}
          </div>

          {freestyleInterim && (
            <div className="status-item" style={{ marginBlockEnd: '0.75rem', fontStyle: 'italic' }}>
              Mendengarkan: &ldquo;{freestyleInterim}&rdquo;
            </div>
          )}

          {freestyleVideoUrl && !isRecording && (
            <div style={{ marginBlockEnd: '0.85rem' }}>
              {recordMode === 'webcam' ? (
                <video
                  controls
                  src={freestyleVideoUrl}
                  style={{ inlineSize: 'min(220px, 100%)', borderRadius: '12px', display: 'block' }}
                />
              ) : (
                <audio controls src={freestyleVideoUrl} style={{ inlineSize: '100%' }} />
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="freestyle-transcript">Skrip Ucapan Anda (Otomatis Tercatat / Bisa Diedit)</label>
            <textarea
              id="freestyle-transcript"
              value={freestyleTranscript}
              onChange={(e) => setFreestyleTranscript(e.target.value)}
              placeholder="Contoh: Ngonten di luar sekarang gak takut bising lagi berkat mic wireless Brica ini. Sinyalnya tembus enam puluh meter dan ada peredam bising aktif. Lengkap layar LCD dan kotak cas praktis. Cek harga promonya di keranjang kuning."
            />
            <span className="hint">Pisahkan kalimat dengan tanda titik (.) atau baris baru untuk menentukan pergantian adegan &amp; B-Roll.</span>
          </div>

          <button
            type="button"
            className="btn primary"
            disabled={!freestyleTranscript.trim() || isRecording}
            onClick={handleApplyFreestylePlan}
          >
            <Sparkles size={16} /> Susun Teks Kinetik Apple &amp; B-Roll Otomatis
          </button>
        </div>
      )}

      {micError && (
        <div className="status-item error" style={{ marginBlockStart: '0.75rem' }} role="alert">
          {micError}
        </div>
      )}
    </div>
  );
}
