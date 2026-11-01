import { lazy, Suspense } from 'react';
import type { Product } from '../../types';

// The camera/QR library is not needed to browse products or complete a sale.
// Fetch it only when someone explicitly opens the scanner.
const Scanner = lazy(() => import('./DashboardBarcodeScanner'));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onScanSuccess: (scannedText: string, product: Product | null) => void;
  inline?: boolean;
}

export default function LazyDashboardBarcodeScanner(props: Props) {
  if (!props.isOpen) return null;

  return (
    <Suspense
      fallback={
        <div role="status" aria-live="polite" className="p-4 text-xs font-semibold text-slate-500">
          Preparing camera scanner…
        </div>
      }
    >
      <Scanner {...props} />
    </Suspense>
  );
}
