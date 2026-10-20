import { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import {
  Camera,
  CheckCircle,
  X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface DashboardBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanSuccess: (scannedText: string, product: Product | null) => void;
  /** Renders as a plain in-page panel instead of a fixed full-screen modal
   * overlay -- used by the POS screen so the real cart stays visible right
   * next to/below the scanner instead of being hidden behind a dialog. */
  inline?: boolean;
}

export default function DashboardBarcodeScanner({
  isOpen,
  onClose,
  products,
  onScanSuccess,
  inline = false
}: DashboardBarcodeScannerProps) {
  const [useBeep] = useState(true);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });

  // Web Audio BEEP generator
  const playBeep = () => {
    if (!useBeep) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(950, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 100);
    } catch (e) {
      console.warn('Web Audio output failed', e);
    }
  };

  // Unified Trigger Logic (Camera, Manual, Hardware)
  const handleItemBarcodeTrigger = (codeHex: string) => {
    const trimmed = codeHex.trim();
    if (!trimmed) return;

    const foundProduct = products.find(
      p => String(p.barcode || '').trim() === trimmed || String(p.sku || '').toUpperCase() === trimmed.toUpperCase()
    ) || null;

    setScanSuccessAnim(foundProduct ? foundProduct.name : `Barcode: ${trimmed}`);
    playBeep();

    setTimeout(() => {
      setScanSuccessAnim(null);
      onScanSuccess(trimmed, foundProduct);
    }, 450);
  };

  // Camera Lifecycle
  useEffect(() => {
    if (isOpen && scannerContainerRef.current) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.333334 
      };

      await html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => {
          const now = Date.now();
          // Debounce: Same barcode must wait 1.8s to be scanned again
          if (lastScanRef.current.value !== decodedText || now - lastScanRef.current.at > 1800) {
            lastScanRef.current = { value: decodedText, at: now };
            handleItemBarcodeTrigger(decodedText);
          }
        },
        (errorMessage) => {
          // Normal scanning noise, ignore
        }
      );
    } catch (err: any) {
      console.error('Camera init error:', err);
      setCameraError('Camera scanning unavailable. Please use a hardware scanner or enter code manually.');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    scannerRef.current = null;
  };

  // Hardware Scanner Listener (HID Keyboard Emulation)
  useEffect(() => {
    if (!isOpen) return;

    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      // Hardware scanners enter text extremely fast (< 30ms per char)
      if (now - lastKeyTime > 100) {
        buffer = ''; // Reset buffer if too slow (human typing)
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          handleItemBarcodeTrigger(buffer);
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products]);

  if (!isOpen) return null;

  const content = (
    <>
        <div className="flex-grow overflow-y-auto p-3 space-y-3">
          {/* Camera scan target */}
          <div className="relative w-full h-64 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center">
            <button
              onClick={onClose}
              aria-label="Close scanner"
              className="absolute top-2 right-2 z-30 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {scanSuccessAnim && (
              <div className="absolute inset-0 z-20 bg-emerald-500/90 flex flex-col items-center justify-center text-white p-4 text-center animate-fade-in">
                <CheckCircle className="w-12 h-12 text-white animate-bounce mb-2" />
                <h4 className="text-white font-bold text-sm tracking-wide">SCANNED SUCCESSFULLY</h4>
                <p className="text-[11px] text-emerald-50 tracking-wider font-mono truncate max-w-full">
                  {scanSuccessAnim}
                </p>
              </div>
            )}

            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] z-10 animate-pulse" />

            <div id="reader" ref={scannerContainerRef} className="w-full h-full" />

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                <Camera className="w-10 h-10 text-slate-600 stroke-[1.25] animate-pulse" />
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-bold text-slate-300">Camera decoder unavailable</p>
                  <p className="text-[10px] text-slate-500 leading-normal">{cameraError}</p>
                </div>
              </div>
            )}

            <div className="absolute inset-x-12 inset-y-8 border-2 border-emerald-500/40 rounded-xl pointer-events-none flex items-center justify-center">
              <span className="text-[9px] font-mono font-bold text-emerald-400 tracking-widest bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-550/30 uppercase select-none">
                Align EAN / Code to Laser
              </span>
            </div>
          </div>
        </div>
    </>
  );

  if (inline) {
    return (
      <div className="relative bg-white border border-slate-200 rounded-3xl shadow-sm w-full overflow-hidden flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {content}
      </div>
    </div>
  );
}
