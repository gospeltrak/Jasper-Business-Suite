import React, { useState, useEffect } from 'react';

// Module-level memory cache — shared across all CachedImage instances
const memoryCache = new Map<string, string>();

/**
 * Evict a URL from both memory cache and browser Cache Storage.
 * Call this whenever a product image is updated so the new image shows immediately.
 */
export async function evictImageCache(url: string): Promise<void> {
  if (!url || url.startsWith('data:')) return;
  // Remove from memory cache
  const memoryBlobUrl = memoryCache.get(url);
  if (memoryBlobUrl && memoryBlobUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(memoryBlobUrl); } catch { /* ignore */ }
  }
  memoryCache.delete(url);
  // Remove from browser Cache Storage
  if ('caches' in window) {
    try {
      const cache = await caches.open('jasper-image-cache-v1');
      await cache.delete(url);
    } catch { /* ignore */ }
  }
}

// Coalesce duplicate image loads across product cards, POS cart, and Purchases.
// A single URL should never be fetched/decoded repeatedly after each UI remount.
const inFlightLoads = new Map<string, Promise<string>>();

async function loadCachedImage(src: string): Promise<string> {
  if (!src || src.startsWith('data:')) return src;
  const ready = memoryCache.get(src);
  if (ready) return ready;
  const pending = inFlightLoads.get(src);
  if (pending) return pending;

  const task = (async () => {
    try {
      if (!('caches' in window)) return src;
      const cache = await caches.open('jasper-image-cache-v1');
      const existing = await cache.match(src);
      const response = existing || await fetch(src, { mode: 'cors' });
      if (!response.ok) return src;
      if (!existing) {
        // Caching is best effort. An unavailable/quota-limited Cache API
        // must not hide an otherwise valid product image.
        await cache.put(src, response.clone()).catch(() => undefined);
      }
      const localUrl = URL.createObjectURL(await response.blob());
      memoryCache.set(src, localUrl);
      return localUrl;
    } catch {
      return src;
    }
  })();
  inFlightLoads.set(src, task);
  try { return await task; }
  finally {
    if (inFlightLoads.get(src) === task) inFlightLoads.delete(src);
  }
}

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

function CachedImage({ src, alt, className, referrerPolicy, ...props }: CachedImageProps) {
  // Restore cached images instantly on mount, without blank/opacity flashes.
  const immediate = () => src.startsWith('data:') ? src : (memoryCache.get(src) || '');
  const [cachedSrc, setCachedSrc] = useState<string>(immediate);
  const [loaded, setLoaded] = useState<boolean>(() => Boolean(immediate()));

  useEffect(() => {
    let active = true;
    if (!src) {
      setCachedSrc('');
      setLoaded(false);
      return () => { active = false; };
    }
    const hit = src.startsWith('data:') ? src : memoryCache.get(src);
    if (hit) {
      setCachedSrc(hit);
      setLoaded(true);
      return () => { active = false; };
    }
    setCachedSrc(src);
    setLoaded(false);
    void loadCachedImage(src).then((imageSrc) => {
      if (!active) return;
      setCachedSrc(imageSrc);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [src]);

  return (
    <img
      src={cachedSrc || src}
      alt={alt}
      className={`${className || ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      referrerPolicy={referrerPolicy || 'no-referrer'}
      onLoad={() => setLoaded(true)}
      {...props}
    />
  );
}

export default React.memo(CachedImage);
