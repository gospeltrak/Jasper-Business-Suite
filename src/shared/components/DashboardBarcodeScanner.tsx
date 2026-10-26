import { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import {
  Camera,
  CheckCircle,
  X
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from '../contexts/LanguageContext';
import { findBarcodeProduct, getBarcodeScanBox } from '../utils/barcodeScan';

type CameraErrorCode = 'permission' | 'not-found' | 'in-use' | 'generic';

// Serializes every camera start/stop across every mount of this component.
// Each open/close of the scanner is a real mount/unmount (the parent only
// renders this component while scanning), and unmount's stopCamera() is
// fire-and-forget (React does not await cleanup functions) -- so closing
// and quickly reopening the scanner could previously let a new start()
// race a still-in-flight stop() for the *same physical camera hardware*,
// which the device then genuinely refuses with "camera already in use"
// even though nothing else is really holding it. Routing every start/stop
// through this single queue, regardless of which mount issued it, makes
// that impossible.
let cameraOpQueue: Promise<unknown> = Promise.resolve();
function queueCameraOp<T>(op: () => Promise<T>): Promise<T> {
  const run = cameraOpQueue.then(op, op);
  cameraOpQueue = run.then(() => undefined, () => undefined);
  return run;
}

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
  const { lang } = useTranslation();
  const [useBeep] = useState(true);
  const [scanSuccessAnim, setScanSuccessAnim] = useState<string | null>(null);
  const [cameraErrorCode, setCameraErrorCode] = useState<CameraErrorCode | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const scanHandlersRef = useRef({ products, onScanSuccess });
  scanHandlersRef.current = { products, onScanSuccess };
  const feedbackTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Set on unmount so a start() still awaiting the queue (or the camera
  // permission prompt) releases the camera immediately once it does get a
  // stream, instead of leaving it open after the user already closed.
  const closedRef = useRef(false);

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
    if (!trimmed || closedRef.current) return;
    const foundProduct = findBarcodeProduct(scanHandlersRef.current.products, trimmed);

    // POS owns acceptance, stock feedback and its success/error sounds.
    // Do not show a green success overlay before the cart accepts the item.
    if (inline) {
      scanHandlersRef.current.onScanSuccess(trimmed, foundProduct);
      return;
    }

    setScanSuccessAnim(foundProduct ? foundProduct.name : `Barcode: ${trimmed}`);
    playBeep();

    const timer = setTimeout(() => {
      feedbackTimersRef.current.delete(timer);
      if (closedRef.current) return;
      setScanSuccessAnim(null);
      scanHandlersRef.current.onScanSuccess(trimmed, findBarcodeProduct(scanHandlersRef.current.products, trimmed));
    }, 450);
    feedbackTimersRef.current.add(timer);
  };

  // Camera Lifecycle
  useEffect(() => {
    closedRef.current = false;
    if (isOpen && scannerContainerRef.current) {
      startCamera();
    }
    return () => {
      closedRef.current = true;
      feedbackTimersRef.current.forEach(timer => clearTimeout(timer));
      feedbackTimersRef.current.clear();
      stopCamera();
    };
  }, [isOpen, inline]);

  const startCamera = () => queueCameraOp(async () => {
    if (closedRef.current) return;
    try {
      setCameraErrorCode(null);
      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      const config = {
        fps: 10,
        // Expand the actual clear decoding area in POS, including the
        // library's shaded guide; keep it inside the live camera dimensions.
        qrbox: (width: number, height: number) => getBarcodeScanBox(width, height, inline),
        aspectRatio: 1.333334
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (closedRef.current) return;
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

      // The scanner was closed while we were waiting for the camera
      // permission prompt / stream to open -- release it right away
      // instead of leaving it running behind a closed panel.
      if (closedRef.current) {
        await html5QrCode.stop().catch(() => {});
        try { html5QrCode.clear(); } catch { /* already cleared */ }
        scannerRef.current = null;
      }
    } catch (err: any) {
      if (closedRef.current) return;
      console.error('Camera init error:', err);
      // html5-qrcode wraps the real DOMException into a plain describing
      // string ("Error getting userMedia, error = NotAllowedError: ...")
      // instead of rethrowing it, so the only reliable signal left is that
      // name appearing inside the stringified error -- there is no .name
      // property to read directly here.
      const text = String(err?.message ?? err ?? '');
      if (/NotAllowedError|PermissionDeniedError|SecurityError/i.test(text)) {
        setCameraErrorCode('permission');
      } else if (/NotFoundError|DevicesNotFoundError/i.test(text)) {
        setCameraErrorCode('not-found');
      } else if (/NotReadableError|TrackStartError/i.test(text)) {
        setCameraErrorCode('in-use');
      } else {
        setCameraErrorCode('generic');
      }
    }
  });

  const stopCamera = () => queueCameraOp(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping camera:', err);
      }
    }
    scannerRef.current = null;
  });

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
  }, [isOpen, inline]);

  if (!isOpen) return null;

  const errorCopy = cameraErrorCode ? (lang === 'sw' ? {
    permission: { title: 'Ruhusa ya kamera imekataliwa', message: 'Ruhusu matumizi ya kamera kwenye mipangilio ya kivinjari chako kisha jaribu tena. Unaweza pia kutumia scanner ya USB au Bluetooth.' },
    'not-found': { title: 'Hakuna kamera iliyopatikana', message: 'Kifaa hiki hakina kamera inayoweza kutumika kuscan. Tumia scanner ya USB au Bluetooth.' },
    'in-use': { title: 'Kamera inatumika', message: 'Programu nyingine kwenye kifaa hiki inatumia kamera. Ifunge kisha jaribu tena.' },
    generic: { title: 'Hakuna connection ya kamera', message: 'Imeshindikana kuunganisha kamera. Jaribu tena, au tumia scanner ya USB au Bluetooth.' },
  }[cameraErrorCode] : {
    permission: { title: 'Camera permission denied', message: 'Allow camera access in your browser settings, then try again. You can also use a USB or Bluetooth scanner.' },
    'not-found': { title: 'No camera found', message: 'This device has no usable camera. Use a USB or Bluetooth scanner instead.' },
    'in-use': { title: 'Camera already in use', message: 'Another app on this device is using the camera. Close it and try again.' },
    generic: { title: 'No camera connection', message: 'Could not connect to the camera. Try again, or use a USB or Bluetooth scanner.' },
  }[cameraErrorCode]) : null;

  const content = (
    <>
        <div className="p-2">
          {/* The open centre rectangle is the library's actual enlarged
             shaded-overlay decoding guide (see qrbox in startCamera); it stays
             empty/clear so the live camera feed shows through while it
             works, and turns into the error panel below only on failure. */}
          <div className={`relative w-full ${inline ? 'h-64 sm:h-72 lg:h-80' : 'h-40'} bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center`}>
            <button
              onClick={onClose}
              aria-label={lang === 'sw' ? 'Funga skana' : 'Close scanner'}
              className="absolute top-2 right-2 z-30 p-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {scanSuccessAnim && (
              <div className="absolute inset-0 z-20 bg-emerald-500/90 flex flex-col items-center justify-center text-white p-4 text-center animate-fade-in">
                <CheckCircle className="w-9 h-9 text-white animate-bounce mb-1.5" />
                <p className="text-[11px] text-emerald-50 tracking-wider font-mono truncate max-w-full">
                  {scanSuccessAnim}
                </p>
              </div>
            )}

            <div
              id="reader"
              ref={scannerContainerRef}
              className="absolute inset-0 w-full h-full [&_video]:absolute [&_video]:inset-0 [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
            />

            {errorCopy && (
              <div className="absolute inset-0 z-10 bg-slate-950 flex flex-col items-center justify-center p-4 text-center text-slate-400 space-y-2">
                <Camera className="w-8 h-8 text-slate-600 stroke-[1.25]" />
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs font-bold text-slate-300">{errorCopy.title}</p>
                  <p className="text-[10px] text-slate-500 leading-normal">{errorCopy.message}</p>
                </div>
              </div>
            )}
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

