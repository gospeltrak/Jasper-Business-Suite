import { useEffect, useState } from 'react';
import { Bluetooth, Check, CheckCircle2, Camera, ChevronDown, CircleHelp, Printer, ScanBarcode, Settings2, XCircle } from 'lucide-react';
import {
  getOrvixNativePrinterBridge, readPosDevicePreferences, savePosDevicePreferences,
  type PosDevicePreferences, type PrinterDevice, type ScannerMode,
} from '../../shared/utils/posDevices';

interface Props {
  tenantId: string;
  isSw: boolean;
}

const surface = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950';
const control = 'rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export default function DashboardScannerPrinterSettings({ tenantId, isSw }: Props) {
  const [prefs, setPrefs] = useState<PosDevicePreferences>(() => readPosDevicePreferences(tenantId));
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [scannerTest, setScannerTest] = useState('');
  const native = getOrvixNativePrinterBridge();

  useEffect(() => {
    setPrefs(readPosDevicePreferences(tenantId));
    setConnected(false);
    setDevices([]);
    setNotice('');
  }, [tenantId]);

  useEffect(() => {
    if (!native || !prefs.printer) return;
    let cancelled = false;
    native.getStatus().then(status => {
      if (!cancelled) setConnected(status.connected && status.printerId === prefs.printer?.id);
    }).catch(() => { if (!cancelled) setConnected(false); });
    return () => { cancelled = true; };
  }, [native, prefs.printer?.id]);

  const tr = (sw: string, en: string) => isSw ? sw : en;
  const update = (changes: Partial<PosDevicePreferences>) => {
    const next = { ...prefs, ...changes };
    if (savePosDevicePreferences(tenantId, next)) {
      setPrefs(next);
      setNotice(tr('Imehifadhiwa kwenye kifaa hiki.', 'Saved on this device.'));
    } else {
      setNotice(tr('Imeshindikana kuhifadhi mipangilio kwenye kifaa hiki.', 'Could not save on this device.'));
    }
  };
  const findPrinters = async () => {
    if (!native) return;
    setBusy(true);
    setNotice('');
    try {
      const list = await native.listPrinters();
      setDevices(list.filter(item => item.id && item.name));
      if (!list.length) setNotice(tr('Hakuna printer. Washa Bluetooth na pair printer kwenye mipangilio ya simu.', 'No printers found. Turn on Bluetooth and pair your printer in phone settings.'));
    } catch {
      setNotice(tr('Imeshindikana kutafuta printer. Angalia ruhusa za Nearby Devices.', 'Could not find printers. Check Nearby Devices permissions.'));
    } finally {
      setBusy(false);
    }
  };
  const connectPrinter = async (device: PrinterDevice) => {
    if (!native) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await native.connectPrinter(device.id);
      if (!result.connected) throw new Error('Not connected');
      update({ printer: device });
      setConnected(true);
      setDevices([]);
      setNotice(tr('Printer imeunganishwa.', 'Printer connected.'));
    } catch {
      setConnected(false);
      setNotice(tr('Printer haijaunganishwa. Hakikisha imewashwa na iko karibu.', 'Printer connection failed. Check power and distance.'));
    } finally {
      setBusy(false);
    }
  };
  const disconnectPrinter = async () => {
    if (!native) return;
    setBusy(true);
    try {
      await native.disconnectPrinter();
      update({ printer: null });
      setConnected(false);
      setNotice(tr('Printer imeondolewa kwenye kifaa hiki.', 'Printer removed from this device.'));
    } catch {
      setNotice(tr('Imeshindikana kuondoa printer.', 'Could not disconnect printer.'));
    } finally {
      setBusy(false);
    }
  };
  const testPrinter = async () => {
    if (!native || !prefs.printer || !connected) return;
    setBusy(true);
    try {
      const result = await native.printText({
        printerId: prefs.printer.id,
        jobId: 'orvix-test-' + Date.now(),
        text: 'ORVIX\n' + (isSw ? 'JARIBIO LA PRINTER' : 'PRINTER TEST') + '\n' + prefs.paperWidthMm + 'mm\n\n\n',
        paperWidthMm: prefs.paperWidthMm,
        copies: 1,
        autoReconnect: prefs.autoReconnect,
      });
      setNotice(result.accepted ? tr('Jaribio limetumwa kwa printer.', 'Test sent to printer.') : tr('Printer haijakubali jaribio.', 'Printer rejected the test.'));
    } catch {
      setNotice(tr('Jaribio limeshindwa. Angalia printer.', 'Test failed. Check printer.'));
    } finally {
      setBusy(false);
    }
  };
  const testCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice(tr('Kamera haipatikani kupitia kivinjari hiki.', 'Camera is unavailable in this browser.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
      setNotice(tr('Kamera iko tayari kuscan bidhaa.', 'Camera is ready to scan products.'));
    } catch {
      setNotice(tr('Ruhusu kamera kwenye App Settings au browser permissions, kisha ujaribu tena.', 'Allow camera in App Settings or browser permissions, then retry.'));
    }
  };

  const segmented = (id: string, selected: boolean, label: string, onClick: () => void) => (
    <button key={id} type="button" aria-pressed={selected} onClick={onClick}
      className={'min-h-10 flex-1 rounded-lg px-3 text-xs font-bold transition ' + (selected
        ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800')}>
      {label}
    </button>
  );
  const toggle = (label: string, hint: string, enabled: boolean, onClick: () => void) => (
    <div className="flex min-h-14 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label={label} onClick={onClick}
        className={'relative h-7 w-12 shrink-0 rounded-full transition-colors ' + (enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600')}>
        <span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ' + (enabled ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className={surface + ' p-4 sm:p-5'}>
        <div className="mb-4 flex items-start gap-3">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><ScanBarcode className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{tr('Kisoma Barcode', 'Barcode Scanner')}</h3>
            <p className="mt-1 text-[11px] text-slate-500">{tr('Chagua namna ya kusoma bidhaa.', 'Choose how products are scanned.')}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
          {segmented('auto', prefs.scannerMode === 'auto', tr('Auto', 'Auto'), () => update({ scannerMode: 'auto' }))}
          {segmented('camera', prefs.scannerMode === 'camera', tr('Kamera', 'Camera'), () => update({ scannerMode: 'camera' }))}
          {segmented('hardware', prefs.scannerMode === 'hardware', tr('USB / BT', 'USB / BT'), () => update({ scannerMode: 'hardware' }))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {prefs.scannerMode === 'hardware'
            ? tr('Pair Bluetooth scanner kwenye simu, au unganisha USB scanner. Scanner inayofanya kazi kama keyboard inatumika kwenye POS.', 'Pair a Bluetooth scanner in phone settings or connect a USB scanner. Keyboard-type scanners work in POS.')
            : prefs.scannerMode === 'camera'
              ? tr('POS itatumia kamera. Ikiwa ruhusa imezuiwa, iwashe kwenye App Settings.', 'POS will use the camera. If blocked, enable camera in App Settings.')
              : tr('Kamera na scanner ya keyboard vinaweza kutumika kwenye POS.', 'Camera and keyboard-type scanner can both work in POS.')}
        </p>
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          {toggle(tr('Sauti ya Scan', 'Scan Sound'), tr('Sauti fupi bidhaa ikisomwa.', 'Short sound when a product is scanned.'), prefs.scannerFeedback, () => update({ scannerFeedback: !prefs.scannerFeedback }))}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={button} type="button" onClick={testCamera}><Camera className="h-4 w-4" />{tr('Jaribu Kamera', 'Test Camera')}</button>
          </div>
          <label className="mt-3 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{tr('Jaribu scanner ya USB / Bluetooth', 'Test USB / Bluetooth scanner')}
            <input className={control + ' mt-2 block w-full'} value={scannerTest}
              onChange={e => setScannerTest(e.target.value)} placeholder={tr('Scan barcode hapa...', 'Scan a barcode here...')} />
          </label>
          {scannerTest && <p className="mt-2 break-all text-[11px] text-emerald-700 dark:text-emerald-300">{tr('Imesomwa: ', 'Scanned: ')}{scannerTest}</p>}
        </div>
      </div>

      <div className={surface + ' p-4 sm:p-5'}>
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><Printer className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{tr('Printer ya Risiti', 'Receipt Printer')}</h3>
            <p className="mt-1 text-[11px] text-slate-500">{tr('Printer iliyochaguliwa huhifadhiwa kwenye kifaa hiki pekee.', 'Printer selection is saved only on this device.')}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          {connected ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Bluetooth className="h-5 w-5 text-slate-400" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{prefs.printer?.name || tr('Hakuna printer iliyochaguliwa', 'No printer selected')}</p>
            <p className="mt-1 text-[10px] text-slate-500">{connected ? tr('Imeunganishwa', 'Connected') : tr('Haijaunganishwa', 'Not connected')}</p>
          </div>
          {prefs.printer && native && <button type="button" className={button} disabled={busy} onClick={disconnectPrinter}><XCircle className="h-4 w-4" />{tr('Ondoa', 'Remove')}</button>}
        </div>
        {native ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={button + ' flex-1'} type="button" disabled={busy} onClick={findPrinters}>
                <Bluetooth className="h-4 w-4" />{busy ? tr('Inatafuta...', 'Working...') : tr('Tafuta Printer Zilizopairiwa', 'Find Paired Printers')}
              </button>
              <button className={button + ' flex-1'} type="button" disabled={busy || !connected} onClick={testPrinter}>
                <Printer className="h-4 w-4" />{tr('Test Print', 'Test Print')}
              </button>
            </div>
            {native.openBluetoothSettings && <button type="button" onClick={() => void native.openBluetoothSettings?.()} className="mt-2 text-[11px] font-semibold text-emerald-700 underline underline-offset-2 dark:text-emerald-300">{tr('Pair printer kwenye Android Bluetooth Settings', 'Pair printer in Android Bluetooth Settings')}</button>}
            {devices.length > 0 && <div className="mt-3 space-y-2">
              {devices.map(device => <button key={device.id} type="button" disabled={busy}
                onClick={() => connectPrinter(device)}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-left text-xs font-semibold hover:border-emerald-300 disabled:opacity-50 dark:border-slate-700 dark:text-white">
                <Printer className="h-4 w-4 text-emerald-600" /><span className="min-w-0 flex-1 truncate">{device.name}</span><Check className="h-4 w-4" />
              </button>)}
            </div>}
          </>
        ) : (
          <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 px-3 py-3 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <CircleHelp className="h-4 w-4 shrink-0" />
            {tr('Direct Bluetooth printing inahitaji Android APK yenye printer driver. Kwenye browser unaweza kutumia Print Receipt ya kawaida.', 'Direct Bluetooth printing needs the Android APK printer driver. In a browser, use the regular Print Receipt dialog.')}
          </div>
        )}
      </div>

      <div className={surface + ' p-4 sm:p-5'}>
        <div className="mb-3 flex items-center gap-2"><Settings2 className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white">{tr('Mipangilio ya Kuchapisha', 'Printing Preferences')}</h3>
        </div>
        {toggle(tr('Automatic Printing', 'Automatic Printing'), tr('Ikizimwa, utabonyeza Print Receipt mwenyewe. Ikiwashwa, risiti hutumwa baada ya sale kuhifadhiwa.', 'Off: tap Print Receipt yourself. On: send after a confirmed sale.'), prefs.automaticPrinting, () => update({ automaticPrinting: !prefs.automaticPrinting }))}
        <div className="mt-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-bold text-slate-800 dark:text-white">{tr('Ukubwa wa Karatasi', 'Paper Size')}</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            {segmented('58', prefs.paperWidthMm === 58, '58mm', () => update({ paperWidthMm: 58 }))}
            {segmented('80', prefs.paperWidthMm === 80, '80mm', () => update({ paperWidthMm: 80 }))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label htmlFor="printer-copies" className="text-xs font-bold text-slate-800 dark:text-white">{tr('Nakala za Risiti', 'Receipt Copies')}</label>
          <select id="printer-copies" className={control} value={prefs.receiptCopies}
            onChange={e => update({ receiptCopies: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </div>
        <button type="button" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}
          className="mt-4 flex w-full items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300">
          {tr('Advanced Settings', 'Advanced Settings')}<ChevronDown className={'h-4 w-4 transition-transform ' + (advanced ? 'rotate-180' : '')} />
        </button>
        {advanced && <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
          {toggle(tr('Auto Reconnect', 'Auto Reconnect'), tr('Unganisha printer uliyochagua inapohitajika.', 'Reconnect to the selected printer when printing.'), prefs.autoReconnect, () => update({ autoReconnect: !prefs.autoReconnect }))}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {tr('Lugha ya risiti inafuata lugha ya profile. Paper cut, cash drawer na logo zinahitaji printer yenye uwezo husika.', 'Receipt language follows your profile. Paper cutting, cash drawer and logo require compatible hardware.')}
          </p>
        </div>}
      </div>
      {notice && <p role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}
    </section>
  );
}
