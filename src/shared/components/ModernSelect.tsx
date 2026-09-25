import { ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface ModernSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface ModernSelectProps {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  title: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  showOptionMarkers?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

export default function ModernSelect({
  value,
  options,
  onChange,
  title,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search options',
  searchable = false,
  showOptionMarkers = false,
  disabled = false,
  className = '',
  buttonClassName = '',
}: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [query, setQuery] = useState('');
  const titleId = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label} ${option.description || ''}`.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 180);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const openSelect = () => {
    if (disabled) return;
    setDraftValue(value);
    setQuery('');
    setIsOpen(true);
  };

  const confirmSelection = () => {
    onChange(draftValue);
    setIsOpen(false);
  };

  const sheet = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Close selection"
            className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-modern-select-sheet
            className="relative flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-[0_-20px_70px_rgba(15,23,42,0.24)] sm:max-w-[430px] sm:rounded-[28px] dark:border-slate-700 dark:bg-slate-900"
            initial={{ y: 56, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.8 }}
          >
            <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
              <span className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>

            <header className="px-5 pb-3 pt-2 sm:px-6 sm:pt-5">
              <div className="min-w-0">
                <h3 id={titleId} className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">
                  {title}
                </h3>
              </div>
            </header>

            {searchable ? (
              <div className="px-5 pb-3 sm:px-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            ) : null}

            <div role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 sm:px-4">
              {filteredOptions.length ? filteredOptions.map((option) => {
                const isSelected = option.value === draftValue;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={option.value}
                    onClick={() => setDraftValue(option.value)}
                    className={`group mb-1 flex min-h-[58px] w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/12 dark:text-emerald-50 dark:ring-emerald-500/25'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    {showOptionMarkers ? (
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-black transition-colors ${
                        isSelected
                          ? 'bg-white text-emerald-600 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {option.icon || option.label.slice(0, 1).toUpperCase()}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] leading-tight ${isSelected ? 'font-extrabold' : 'font-bold'}`}>{option.label}</span>
                      {option.description ? (
                        <span className={`mt-1 block text-[11px] leading-snug ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all ${
                      isSelected ? 'scale-100 bg-emerald-600 text-white' : 'scale-75 bg-slate-100 text-transparent dark:bg-slate-700'
                    }`}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  </button>
                );
              }) : (
                <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-500">No matching options</div>
              )}
            </div>

            <footer className="border-t border-slate-100 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={confirmSelection}
                disabled={!draftValue}
                className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 text-[13px] font-extrabold text-white shadow-[0_10px_28px_rgba(5,150,105,0.24)] transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800"
              >
                Done
              </button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className={`min-w-0 ${className}`} data-modern-select>
      <button
        type="button"
        onClick={openSelect}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex min-h-[42px] w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? '' : 'text-slate-400'}`}>{selected?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-600' : ''}`} strokeWidth={2.25} />
      </button>
      {typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </div>
  );
}
