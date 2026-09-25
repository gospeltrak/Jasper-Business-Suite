import { useState, useEffect, useRef, useCallback } from 'react';

// ── Search config per tab ─────────────────────────────────────────────────
export const SEARCH_CONFIG: Record<string, {
  placeholder: string;
  fields: string[];
  label: string;
}> = {
  'pos': {
    placeholder: 'Search products or scan barcode…',
    fields: ['name', 'barcode', 'sku', 'category'],
    label: 'POS',
  },
  'products': {
    placeholder: 'Search products, barcode or SKU…',
    fields: ['name', 'barcode', 'sku', 'category', 'brand', 'unit'],
    label: 'Products',
  },
  'sales-list': {
    placeholder: 'Search invoice, customer or receipt…',
    fields: ['invoiceNumber', 'receiptNumber', 'customerName', 'paymentMethod', 'status', 'cashierName'],
    label: 'Sales',
  },
  'expenses': {
    placeholder: 'Search expenses by title or category…',
    fields: ['title', 'category', 'reference', 'payee', 'paymentMethod'],
    label: 'Expenses',
  },
  'reports': {
    placeholder: 'Search this report…',
    fields: ['name', 'reference', 'category'],
    label: 'Reports',
  },
  'customers': {
    placeholder: 'Search customers or phone number…',
    fields: ['name', 'phone', 'email', 'customerCode'],
    label: 'Customers',
  },
  'suppliers': {
    placeholder: 'Search suppliers…',
    fields: ['name', 'phone', 'email', 'contact'],
    label: 'Suppliers',
  },
  'purchases': {
    placeholder: 'Search purchases…',
    fields: ['reference', 'supplier', 'product', 'status'],
    label: 'Purchases',
  },
  'deliveries': {
    placeholder: 'Search deliveries…',
    fields: ['customer', 'reference', 'status', 'rider'],
    label: 'Deliveries',
  },
  'cash-bank': {
    placeholder: 'Search transactions…',
    fields: ['description', 'reference', 'account'],
    label: 'Cash & Bank',
  },
  'overview': {
    placeholder: 'Search dashboard…',
    fields: [],
    label: 'Overview',
  },
};

export const getSearchConfig = (tab: string) =>
  SEARCH_CONFIG[tab] ?? {
    placeholder: 'Search…',
    fields: [],
    label: '',
  };

// ── Client-side filter helper ─────────────────────────────────────────────
export function clientFilter<T extends Record<string, any>>(
  items: T[],
  query: string,
  fields: string[],
): T[] {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();
  return items.filter(item =>
    fields.some(field => {
      const val = String(item[field] ?? '').toLowerCase();
      return val.includes(q);
    })
  );
}

// ── useContextualSearch hook ──────────────────────────────────────────────
export function useContextualSearch(activeTab: string, debounceMs = 300) {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTabRef = useRef(activeTab);

  // Auto-clear when tab changes
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      setRawQuery('');
      setDebouncedQuery('');
      setIsSearching(false);
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  // Debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (rawQuery.trim()) {
      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(rawQuery.trim());
        setIsSearching(false);
      }, debounceMs);
    } else {
      setDebouncedQuery('');
      setIsSearching(false);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rawQuery, debounceMs]);

  const clearSearch = useCallback(() => {
    setRawQuery('');
    setDebouncedQuery('');
    setIsSearching(false);
  }, []);

  const config = getSearchConfig(activeTab);

  return {
    rawQuery,
    setRawQuery,
    debouncedQuery,
    isSearching,
    clearSearch,
    config,
    hasQuery: rawQuery.trim().length > 0,
  };
}
