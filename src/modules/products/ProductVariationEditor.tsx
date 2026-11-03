import { useState, type Dispatch, type SetStateAction } from 'react';
import { Check, ChevronDown, ChevronUp, Layers3, Plus, Trash2 } from 'lucide-react';
import type { VariationDraft } from './utils/productVariations';

/**
 * Touch-first product-option editor used by Add Product and Edit Product.
 * Attribute tags describe the parent; each value is a real stock-ledger SKU.
 * It deliberately keeps stock/barcode behind an explicit disclosure so the
 * initial mobile/PWA surface remains as compact as the desktop table.
 */
const ATTRIBUTE_OPTIONS = ['Size / Volume', 'Flavor', 'Color', 'Material', 'Formula', 'Custom'] as const;

export const emptyVariationDraft = (): VariationDraft => ({
  label: '', barcode: '', costPrice: 0, sellingPrice: 0,
  shopStockQty: 0, storeStockQty: 0, sellInRetail: true,
  sellInWholesale: false, minWholesaleQty: 10,
});

interface ProductVariationEditorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  attribute: string;
  onAttributeChange: (attribute: string) => void;
  drafts: VariationDraft[];
  onDraftsChange: Dispatch<SetStateAction<VariationDraft[]>>;
  currency?: string;
  editing?: boolean;
  /** Existing SKUs may have sales history and must never be silently deleted. */
  cannotDisable?: boolean;
}

const compactInput = 'w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const fieldLabel = 'block min-w-0 space-y-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300';
const qtyValue = (raw: string) => raw === '' ? undefined : Number(raw);

export default function ProductVariationEditor({
  enabled, onEnabledChange, attribute, onAttributeChange, drafts, onDraftsChange,
  currency = 'TZS', editing = false, cannotDisable = false,
}: ProductVariationEditorProps) {
  const [newValue, setNewValue] = useState('');
  const [expandedRows, setExpandedRows] = useState<number[]>([]);

  const change = (index: number, patch: Partial<VariationDraft>) =>
    onDraftsChange(current => current.map((draft, i) => i === index ? { ...draft, ...patch } : draft));

  const addValue = () => {
    const value = newValue.trim();
    if (!value || drafts.some(item => item.label.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onDraftsChange(current => {
      const emptyIndex = current.findIndex(row => !row.label.trim());
      return emptyIndex >= 0
        ? current.map((row, i) => i === emptyIndex ? { ...row, label: value } : row)
        : [...current, { ...emptyVariationDraft(), label: value }];
    });
    setNewValue('');
  };

  const toggleDetails = (index: number) =>
    setExpandedRows(current => current.includes(index) ? current.filter(i => i !== index) : [...current, index]);

  const customAttribute = !ATTRIBUTE_OPTIONS.slice(0, -1).includes(attribute as typeof ATTRIBUTE_OPTIONS[number]);

  return (
    <section data-testid="product-variations-editor"
      className="min-w-0 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex min-w-0 items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-3 py-2.5 sm:px-4 dark:from-emerald-950/30 dark:via-slate-800 dark:to-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Layers3 size={16} /></span>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">Product Variations</h4>
        </div>
        <label className={`inline-flex min-h-10 shrink-0 items-center gap-2 ${cannotDisable && enabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <span data-testid="variation-toggle-status" className={`text-[11px] font-extrabold ${enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
            {enabled ? 'ON' : 'OFF'}
          </span>
          <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-within:ring-2 focus-within:ring-emerald-400 focus-within:ring-offset-2 ${enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <input
              type="checkbox"
              role="switch"
              aria-label="Product Variations"
              aria-checked={enabled}
              checked={enabled}
              disabled={cannotDisable && enabled}
              onChange={event => onEnabledChange(event.target.checked)}
              className="absolute inset-0 z-10 h-full w-full cursor-inherit opacity-0"
            />
            <span aria-hidden="true" className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </span>
        </label>
      </div>

      {enabled && <div className="space-y-4 px-3 py-4 sm:px-4">
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-800 dark:text-white">Variation Attributes (Tags)</p>
          <div role="group" aria-label="Variation Attributes" className="flex flex-wrap gap-2">
            {ATTRIBUTE_OPTIONS.map(option => {
              const active = option === attribute || (option === 'Custom' && customAttribute);
              return <button key={option} type="button" aria-pressed={active}
                onClick={() => onAttributeChange(option === 'Custom' ? (customAttribute ? attribute : 'Custom') : option)}
                className={`min-h-9 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors active:scale-[0.98] ${active
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                {active && <Check size={12} className="mr-1 inline-block" />}{option === 'Custom' ? '+ Custom' : option}
              </button>;
            })}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={fieldLabel}>Variation Name
              <input type="text" aria-label="Variation Name" className={compactInput}
                value={attribute} onChange={event => onAttributeChange(event.target.value)}
                placeholder="e.g. Size / Volume" maxLength={48} />
            </label>
            <div className="min-w-0 space-y-1">
              <label className={fieldLabel} htmlFor="orvix-add-variation-value">Variation Values</label>
              <div className="flex min-w-0 gap-2">
                <input id="orvix-add-variation-value" className={compactInput} value={newValue}
                  onChange={event => setNewValue(event.target.value)} placeholder="e.g. 350ml, Vanilla, Blue"
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addValue(); } }} />
                <button type="button" onClick={addValue} disabled={!newValue.trim()}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-emerald-200 px-3 text-[11px] font-bold text-emerald-700 disabled:opacity-40">
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>
          {drafts.some(item => item.label.trim()) && <div aria-label="Selected variation values" className="flex flex-wrap gap-1.5">
            {drafts.filter(item => item.label.trim()).map((item, index) =>
              <span key={item.id || index} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">{item.label}</span>)}
          </div>}
        </div>

        <div className="border-t border-slate-100 pt-3 dark:border-slate-700">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-extrabold text-slate-800 dark:text-white">Variations ({drafts.length})</h5>
              <p className="text-[10px] text-slate-500">Each variation has its own buying, retail and wholesale rules ({currency}).</p>
            </div>
            <button type="button" onClick={() => onDraftsChange(current => [...current, emptyVariationDraft()])}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 text-[11px] font-bold text-emerald-700">
              <Plus size={15} /> Add Variation
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map((draft, index) => {
              const retail = draft.sellInRetail !== false;
              const wholesale = draft.sellInWholesale === true;
              const detailsOpen = expandedRows.includes(index);
              return <div key={draft.id || index} data-testid="variation-create-row"
                className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/20">
                  <span className="text-[11px] font-extrabold text-slate-800 dark:text-white">
                    {draft.label.trim() || `Variation ${index + 1}`}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label className="inline-flex min-h-9 items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      <input aria-label={`Sell Retail ${index + 1}`} type="checkbox" checked={retail}
                        onChange={event => change(index, { sellInRetail: event.target.checked })}
                        className="h-4 w-4 accent-emerald-600" /> Retail
                    </label>
                    <label className="inline-flex min-h-9 items-center gap-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      <input aria-label={`Sell Wholesale ${index + 1}`} type="checkbox" checked={wholesale}
                        onChange={event => change(index, { sellInWholesale: event.target.checked })}
                        className="h-4 w-4 accent-emerald-600" /> Wholesale
                    </label>
                    {!draft.id && drafts.length > 2 && <button type="button" aria-label={`Remove variation ${index + 1}`}
                      onClick={() => onDraftsChange(current => current.filter((_, i) => i !== index))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50">
                      <Trash2 size={15}/>
                    </button>}
                  </div>
                </div>
                <div data-testid="variation-prices-grid" className="orvix-variation-prices-grid min-w-0 p-3">
                  <label className={fieldLabel}>Variation
                    <input aria-label={`Variation ${index + 1} value`} value={draft.label}
                      onChange={event => change(index, { label: event.target.value })}
                      className={compactInput} placeholder={attribute === 'Flavor' ? 'Vanilla' : '350ml'} />
                  </label>
                  <label className={fieldLabel}>Buying Price
                    <input aria-label={`Variation ${index + 1} buying price`} type="number" min="0" step="0.01"
                      value={draft.costPrice} onChange={event => change(index, { costPrice: Number(event.target.value) })}
                      className={compactInput} />
                  </label>
                  <label className={fieldLabel}>Retail Price
                    <input aria-label={`Variation ${index + 1} retail price`} type="number" min="0" step="0.01"
                      disabled={!retail} value={retail ? draft.sellingPrice : 0}
                      onChange={event => change(index, { sellingPrice: Number(event.target.value) })}
                      className={compactInput + (!retail ? ' opacity-50' : '')} />
                  </label>
                  <label className={fieldLabel}>Wholesale Price
                    <input aria-label={`Variation ${index + 1} wholesale price`} type="number" min="0" step="0.01"
                      disabled={!wholesale} value={wholesale ? draft.wholesalePrice ?? 0 : 0}
                      onChange={event => change(index, { wholesalePrice: Number(event.target.value) })}
                      className={compactInput + (!wholesale ? ' opacity-50' : '')} />
                  </label>
                  <label className={fieldLabel}>Min Wholesale Qty
                    <input aria-label={`Variation ${index + 1} min wholesale quantity`} type="number" min="1" step="1"
                      disabled={!wholesale} value={wholesale ? draft.minWholesaleQty ?? 10 : 0}
                      onChange={event => change(index, { minWholesaleQty: Number(event.target.value) })}
                      className={compactInput + (!wholesale ? ' opacity-50' : '')} />
                  </label>
                  <label className={fieldLabel}>Max Wholesale Qty
                    <input aria-label={`Variation ${index + 1} max wholesale quantity`} type="number" min="1" step="1"
                      disabled={!wholesale} value={wholesale ? draft.maxWholesaleQty ?? '' : ''}
                      onChange={event => change(index, { maxWholesaleQty: qtyValue(event.target.value) })}
                      placeholder="No limit" className={compactInput + (!wholesale ? ' opacity-50' : '')} />
                  </label>
                </div>
                <div className="border-t border-slate-100 px-3 py-1.5 dark:border-slate-700">
                  <button type="button" aria-expanded={detailsOpen} onClick={() => toggleDetails(index)}
                    className="inline-flex min-h-10 items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {detailsOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    {detailsOpen ? 'Hide' : 'Edit'} Stock & Barcode
                  </button>
                  {detailsOpen && <div data-testid="variation-stock-grid" className="orvix-variation-stock-grid min-w-0 pb-3">
                    <label className={fieldLabel}>Shop Stock
                      <input type="number" aria-label={`Variation ${index + 1} shop stock`} min="0" step="0.001"
                        value={draft.shopStockQty} onChange={event => change(index, { shopStockQty: Number(event.target.value) })}
                        className={compactInput}/>
                    </label>
                    <label className={fieldLabel}>Store Stock
                      <input type="number" aria-label={`Variation ${index + 1} store stock`} min="0" step="0.001"
                        value={draft.storeStockQty} onChange={event => change(index, { storeStockQty: Number(event.target.value) })}
                        className={compactInput}/>
                    </label>
                    <label className={fieldLabel + ' orvix-variation-barcode-field'}>Barcode / SKU
                      <input type="text" aria-label={`Variation ${index + 1} barcode`} value={draft.barcode}
                        onChange={event => change(index, { barcode: event.target.value })} placeholder="Generate automatically"
                        className={compactInput}/>
                    </label>
                  </div>}
                </div>
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-slate-500">
            Wholesale limits apply separately to each SKU. Maximum is optional. Stock and barcodes are unique to each variation. {editing && 'Existing SKUs stay attached to their sales history.'}
          </p>
        </div>
      </div>}
    </section>
  );
}
