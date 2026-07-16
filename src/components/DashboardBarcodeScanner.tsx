import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { Product } from '../types';
import { X, Camera, Volume2, VolumeX, ZoomIn, ZoomOut, Flashlight } from 'lucide-react';

// Re-export Flashlight workaround — lucide doesn't have Flashlight, use Zap
import { Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanSuccess: (scannedText: string, product: Product | null) => void;
}

// ── Audio context singleton ───────────────────────────────────────────────
let _ctx: AudioContext | null = null;
const getCtx = () => {
  if (!_ctx || _ctx.state === 'closed') {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) _ctx = new AC();
  }
  if (_ctx?.state === 'suspended') _ctx.resume();
  return _ctx;
};

const playSuccessBeep = () => {
  try {
    const ctx = getCtx(); if (!ctx) return;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 950;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.12);
  } catch {}
};

const playBuzz = (double = false) => {
  try {
    const ctx = getCtx(); if (!ctx) return;
    [0, ...(double ? [0.32] : [])].forEach(at => {
      const osc = ctx!.createOscillator(); const gain = ctx!.createGain();
      osc.connect(gain); gain.connect(ctx!.destination);
      osc.type = 'square'; osc.frequency.value = 110;
      gain.gain.setValueAtTime(0, ctx!.currentTime + at);
      gain.gain.linearRampToValueAtTime(0.3, ctx!.currentTime + at + 0.02);
      gain.gain.setValueAtTime(0.3, ctx!.currentTime + at + 0.22);
      gain.gain.linearRampToValueAtTime(0, ctx!.currentTime + at + 0.28);
      osc.start(ctx!.currentTime + at); osc.stop(ctx!.currentTime + at + 0.3);
    });
  } catch {}
};

// ── Product matcher ───────────────────────────────────────────────────────
const normalize = (s: string) => (s ?? '').trim().toLowerCase().replace(/^0+/, '');

const findProduct = (code: string, products: Product[]): Product | null => {
  const n = normalize(code);
  return products.find(p =>
    (p.barcode && normalize(p.barcode) === n) ||
    (p.sku    && normalize(p.sku)    === n) ||
    (p.barcode && p.barcode.trim()   === code.trim()) ||
    (p.sku    && p.sku.trim()        === code.trim())
  ) ?? null;
};

export default function DashboardBarcodeScanner({ isOpen, onClose, products, onScanSuccess }: Props) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const readerRef    = useRef<BrowserMultiFormatReader | null>(null);
  const lastCodeRef  = useRef<string>('');
  const lastTimeRef  = useRef<number>(0);
  const scanningRef  = useRef(false);

  const [muted,      setMuted]      = useState(false);
  const [camError,   setCamError]   = useState<string | null>(null);
  const [flash,      setFlash]      = useState<{ text: string; type: 'ok' | 'oos' | 'miss' } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [torchOn,    setTorchOn]    = useState(false);
  const [cameras,    setCameras]    = useState<MediaDeviceInfo[]>([]);
  const [camIdx,     setCamIdx]     = useState(0);

  // ── Process a decoded barcode ─────────────────────────────────────────
  const handleCode = useCallback((code: string) => {
    const now = Date.now();
    // Debounce: ignore same code within 2 seconds
    if (code === lastCodeRef.current && now - lastTimeRef.current < 2000) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;

    const product = findProduct(code, products);
    const isOOS   = product ? (product.shopStockQty ?? 0) <= 0 : false;

    if (product && !isOOS) {
      if (!muted) playSuccessBeep();
      setFlash({ text: `✓ ${product.name}`, type: 'ok' });
    } else if (product && isOOS) {
      if (!muted) playBuzz(false);
      setFlash({ text: `Out of stock — ${product.name}`, type: 'oos' });
    } else {
      if (!muted) playBuzz(true);
      setFlash({ text: `Not found: ${code}`, type: 'miss' });
    }

    setTimeout(() => {
      setFlash(null);
      onScanSuccess(code, product);
    }, 600);
  }, [products, muted, onScanSuccess]);

  // ── Start camera + ZXing ─────────────────────────────────────────────
  const startScanner = useCallback(async (deviceId?: string) => {
    setCamError(null);
    try {
      // List cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter(d => d.kind === 'videoinput');
      setCameras(vids);

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      // Scan loop
      scanningRef.current = true;
      const scan = async () => {
        if (!scanningRef.current || !videoRef.current) return;
        try {
          const result = await reader.decodeOnceFromVideoElement(videoRef.current);
          if (result && scanningRef.current) {
            handleCode(result.getText());
          }
        } catch (e) {
          if (e instanceof NotFoundException) {
            // no barcode in frame — normal, keep trying
          } else {
            console.warn('scan error', e);
          }
        }
        if (scanningRef.current) requestAnimationFrame(scan);
      };
      requestAnimationFrame(scan);

    } catch (err: any) {
      console.warn('Camera error:', err);
      if (err?.name === 'NotAllowedError') {
        setCamError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (err?.name === 'NotFoundError') {
        setCamError('No camera found on this device. Use manual entry below.');
      } else {
        setCamError('Camera unavailable. Use manual entry below.');
      }
    }
  }, [handleCode]);

  // ── Stop everything ───────────────────────────────────────────────────
  const stopScanner = useCallback(() => {
    scanningRef.current = false;
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    readerRef.current = null;
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [isOpen]);

  // Restart when switching camera
  const switchCamera = () => {
    if (cameras.length < 2) return;
    const next = (camIdx + 1) % cameras.length;
    setCamIdx(next);
    stopScanner();
    setTimeout(() => startScanner(cameras[next].deviceId), 200);
  };

  // Torch
  const toggleTorch = async () => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(t => !t);
    } catch {}
  };

  if (!isOpen) return null;

  const flashBg = flash?.type === 'ok'  ? 'bg-emerald-500' :
                  flash?.type === 'oos' ? 'bg-amber-500'   : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col" style={{ maxHeight: '92dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-black text-white">Barcode Scanner</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMuted(m => !m)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer border-none transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer border-none transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>

          {/* Video */}
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" />

          {/* Scan overlay frame */}
          {!camError && !flash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-40">
                {/* Corner brackets */}
                {[
                  'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
                  'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
                  'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
                  'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-emerald-400 ${cls}`} />
                ))}
                {/* Laser line */}
                <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                  style={{ animation: 'scan-line 1.8s ease-in-out infinite' }} />
              </div>
              <p className="absolute bottom-4 text-[10px] text-white/50 font-mono">
                Point camera at barcode
              </p>
            </div>
          )}

          {/* Flash result overlay */}
          {flash && (
            <div className={`absolute inset-0 ${flashBg} flex items-center justify-center p-4 transition-all`}>
              <p className="text-white font-black text-base text-center leading-snug">{flash.text}</p>
            </div>
          )}

          {/* Camera error state */}
          {camError && (
            <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3">
              <Camera className="w-10 h-10 text-slate-600" />
              <p className="text-xs text-slate-400 leading-relaxed">{camError}</p>
              <button onClick={() => startScanner()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer border-none">
                Retry Camera
              </button>
            </div>
          )}

          {/* Camera controls */}
          {!camError && (
            <div className="absolute bottom-3 right-3 flex flex-col gap-2">
              {cameras.length > 1 && (
                <button onClick={switchCamera}
                  className="w-9 h-9 rounded-xl bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer border-none backdrop-blur-sm"
                  title="Switch camera">
                  <Camera className="w-4 h-4" />
                </button>
              )}
              <button onClick={toggleTorch}
                className={`w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer border-none backdrop-blur-sm ${torchOn ? 'bg-yellow-500/80 text-white' : 'bg-black/60 hover:bg-black/80 text-white'}`}
                title="Toggle torch">
                <Zap className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Manual entry */}
        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Manual Entry</p>
          <form onSubmit={e => { e.preventDefault(); if (manualCode.trim()) { handleCode(manualCode.trim()); setManualCode(''); } }}
            className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Type or paste barcode…"
              className="flex-1 bg-slate-800 border border-slate-700 text-white text-sm px-3 py-2.5 rounded-xl placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button type="submit" disabled={!manualCode.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs font-black rounded-xl cursor-pointer border-none transition-colors whitespace-nowrap">
              Search
            </button>
          </form>
        </div>

      </div>

      {/* Scan line animation */}
      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 20%; opacity: 1; }
          50% { top: 80%; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
