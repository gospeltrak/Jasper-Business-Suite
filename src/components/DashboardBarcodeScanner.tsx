import { useState, useEffect, useRef, useCallback } from 'react';
import { Product } from '../types';
import { X, Camera, Volume2, VolumeX, Zap, CheckCircle, AlertCircle, Keyboard } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface DashboardBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanSuccess: (scannedText: string, product: Product | null) => void;
}

export default function DashboardBarcodeScanner({
  isOpen,
  onClose,
  products,
  onScanSuccess
}: DashboardBarcodeScannerProps) {
  const [useBeep, setUseBeep] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<{ code: string; product: Product | null; status: 'ok' | 'oos' | 'notfound' } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanCount, setScanCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);
  // For USB/Bluetooth scanner keyboard input
  const kbBufferRef = useRef<string>('');
  const kbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── SOUNDS ──────────────────────────────────────────────────────────────
  const playBeep = useCallback(() => {
    if (!useBeep) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 950;
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
      setTimeout(() => ctx.close(), 300);
    } catch {}
  }, [useBeep]);

  const playBuzz = useCallback((double = false) => {
    if (!useBeep) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [0, ...(double ? [0.34] : [])].forEach(t => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.value = 110;
        g.gain.setValueAtTime(0, ctx.currentTime + t);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.setValueAtTime(0.3, ctx.currentTime + t + 0.24);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.3);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.32);
      });
      setTimeout(() => ctx.close(), double ? 900 : 500);
    } catch {}
  }, [useBeep]);

  // ── MATCHING ─────────────────────────────────────────────────────────────
  const findProduct = useCallback((code: string): Product | null => {
    const norm = (s: string) => s.trim().toLowerCase().replace(/^0+/, '');
    const c = norm(code);
    return products.find(p =>
      (p.barcode && norm(p.barcode) === c) ||
      (p.sku && norm(p.sku) === c) ||
      (p.barcode && p.barcode.trim() === code.trim()) ||
      (p.sku && p.sku.trim() === code.trim()) ||
      (p.name && p.name.toLowerCase() === code.toLowerCase())
    ) || null;
  }, [products]);

  // ── PROCESS SCAN ─────────────────────────────────────────────────────────
  const processScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Debounce — same code within 1.5s = ignore (prevents double scan)
    const now = Date.now();
    if (trimmed === lastCodeRef.current && now - lastTimeRef.current < 1500) return;
    lastCodeRef.current = trimmed;
    lastTimeRef.current = now;

    const product = findProduct(trimmed);
    const isOOS = product ? (product.shopStockQty ?? 0) <= 0 : false;
    const status = !product ? 'notfound' : isOOS ? 'oos' : 'ok';

    setLastScan({ code: trimmed, product, status });
    setScanCount(n => n + 1);

    if (status === 'ok') playBeep();
    else if (status === 'oos') playBuzz(false);
    else playBuzz(true);

    // Add to cart immediately — no 450ms delay
    onScanSuccess(trimmed, product);
  }, [findProduct, onScanSuccess, playBeep, playBuzz]);

  // ── CAMERA + ZXING ───────────────────────────────────────────────────────
  const startScanner = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Continuously decode from video stream
      const decode = async () => {
        if (!videoRef.current || !readerRef.current) return;
        try {
          const result = await reader.decodeOnce(videoRef.current);
          if (result?.getText()) {
            processScan(result.getText());
          }
        } catch (e) {
          // Ignore — means no barcode found in this frame, keep looping
        }
        // Loop — keep scanning
        if (readerRef.current) {
          requestAnimationFrame(decode);
        }
      };

      // Start after video is ready
      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => { requestAnimationFrame(decode); };
      }

    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings, then reopen the scanner.'
        : err?.name === 'NotFoundError'
        ? 'No camera found on this device. Use the manual input below or a USB barcode scanner.'
        : 'Camera could not start. Use the manual input below or a USB barcode scanner.';
      setCameraError(msg);
    }
  }, [processScan]);

  const stopScanner = useCallback(() => {
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) startScanner();
    return () => stopScanner();
  }, [isOpen]);

  // ── USB / BLUETOOTH SCANNER (keyboard input) ─────────────────────────────
  // USB and Bluetooth scanners type barcode chars rapidly then send Enter
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture if no input/textarea is focused (except our manual input)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        // Scanner sent Enter — process the buffered code
        const code = kbBufferRef.current.trim();
        kbBufferRef.current = '';
        if (kbTimerRef.current) clearTimeout(kbTimerRef.current);
        if (code.length >= 2) processScan(code);
      } else if (e.key.length === 1) {
        // Regular character — add to buffer
        kbBufferRef.current += e.key;
        // Auto-process if no more chars after 80ms (scanner finished sending)
        if (kbTimerRef.current) clearTimeout(kbTimerRef.current);
        kbTimerRef.current = setTimeout(() => {
          const code = kbBufferRef.current.trim();
          kbBufferRef.current = '';
          if (code.length >= 2) processScan(code);
        }, 80);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processScan]);

  if (!isOpen) return null;

  const statusColor = !lastScan ? '' :
    lastScan.status === 'ok' ? 'bg-emerald-500' :
    lastScan.status === 'oos' ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-slate-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '92dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-[14px] font-black text-white">Barcode Scanner</h3>
              <p className="text-[10px] text-slate-400">
                {scanCount > 0 ? `${scanCount} item${scanCount > 1 ? 's' : ''} scanned` : 'Point camera at barcode'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setUseBeep(b => !b)}
              className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer border-none transition-colors">
              {useBeep ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer border-none transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera viewport */}
        <div className="relative bg-black shrink-0" style={{ height: '260px' }}>
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover" />

          {/* Scan line */}
          {!cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* Corner brackets */}
              <div className="relative w-52 h-32">
                {[['top-0 left-0','border-t-2 border-l-2 rounded-tl-lg'],
                  ['top-0 right-0','border-t-2 border-r-2 rounded-tr-lg'],
                  ['bottom-0 left-0','border-b-2 border-l-2 rounded-bl-lg'],
                  ['bottom-0 right-0','border-b-2 border-r-2 rounded-br-lg']
                ].map(([pos, cls], i) => (
                  <div key={i} className={`absolute ${pos} w-6 h-6 border-emerald-400 ${cls}`} />
                ))}
                {/* Animated scan line */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]"
                  style={{ animation: 'scan-line 1.8s ease-in-out infinite' }} />
              </div>
            </div>
          )}

          {/* Camera error */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3">
              <Camera className="w-10 h-10 text-slate-600" />
              <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>
            </div>
          )}

          {/* Last scan result flash */}
          {lastScan && (
            <div className={`absolute inset-x-0 bottom-0 px-4 py-2.5 flex items-center gap-2 ${statusColor}`}>
              {lastScan.status === 'ok'
                ? <CheckCircle className="w-4 h-4 text-white shrink-0" />
                : <AlertCircle className="w-4 h-4 text-white shrink-0" />}
              <div className="min-w-0">
                <p className="text-white text-[12px] font-bold truncate">
                  {lastScan.status === 'ok' ? `✓ ${lastScan.product?.name}` :
                   lastScan.status === 'oos' ? `Out of stock — ${lastScan.product?.name}` :
                   `Not found — ${lastScan.code}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Manual / USB input */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Keyboard className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manual / USB Scanner Input</span>
          </div>
          <form onSubmit={e => { e.preventDefault(); if (manualCode.trim()) { processScan(manualCode); setManualCode(''); } }}
            className="flex gap-2">
            <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="Type barcode or scan with USB scanner..."
              autoFocus
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono" />
            <button type="submit" disabled={!manualCode.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl border-none cursor-pointer transition-colors whitespace-nowrap">
              Add
            </button>
          </form>
          <p className="text-[10px] text-slate-400 mt-2">
            USB/Bluetooth scanners work automatically — just scan any barcode while this window is open.
          </p>
        </div>

        {/* Done button */}
        <div className="px-5 pb-5 shrink-0">
          <button onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-sm rounded-2xl border-none cursor-pointer transition-colors">
            Done — Close Scanner
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(-40px); opacity: 0.4; }
          50% { transform: translateY(40px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
