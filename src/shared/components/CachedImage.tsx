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

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export default function CachedImage({ src, alt, className, referrerPolicy, ...props }: CachedImageProps) {
  const [cachedSrc, setCachedSrc] = useState<string>(() => {
    if (!src) return '';
    if (src.startsWith('data:')) return src;
    return memoryCache.get(src) || '';
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) {
      setCachedSrc('');
      return;
    }

    if (src.startsWith('data:')) {
      setCachedSrc(src);
      setLoaded(true);
      return;
    }

    // Check memory cache first
    const memoryHit = memoryCache.get(src);
    if (memoryHit) {
      setCachedSrc(memoryHit);
      setLoaded(true);
      return;
    }

    let isMounted = true;

    const cacheImage = async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('jasper-image-cache-v1');
          const cachedResponse = await cache.match(src);

          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const localUrl = URL.createObjectURL(blob);
            memoryCache.set(src, localUrl);
            if (isMounted) { setCachedSrc(localUrl); setLoaded(true); }
          } else {
            const response = await fetch(src, { mode: 'cors' });
            if (response.ok) {
              await cache.put(src, response.clone());
              const blob = await response.blob();
              const localUrl = URL.createObjectURL(blob);
              memoryCache.set(src, localUrl);
              if (isMounted) { setCachedSrc(localUrl); setLoaded(true); }
            } else {
              if (isMounted) { setCachedSrc(src); setLoaded(true); }
            }
          }
        } else {
          if (isMounted) { setCachedSrc(src); setLoaded(true); }
        }
      } catch {
        if (isMounted) { setCachedSrc(src); setLoaded(true); }
      }
    };

    cacheImage();
    return () => { isMounted = false; };
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
