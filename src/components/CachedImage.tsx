import React, { useState, useEffect } from 'react';

// Memory fallback to ensure high performance even across component re-renders
const memoryCache = new Map<string, string>();

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

    // Cache Storage worker function
    const cacheImage = async () => {
      try {
        if ('caches' in window) {
          const cache = await caches.open('jasper-image-cache-v1');
          const cachedResponse = await cache.match(src);

          if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const localUrl = URL.createObjectURL(blob);
            memoryCache.set(src, localUrl);
            if (isMounted) {
              setCachedSrc(localUrl);
              setLoaded(true);
            }
          } else {
            // Attempt standard fetch with CORS mode
            const response = await fetch(src, { mode: 'cors' });
            if (response.ok) {
              await cache.put(src, response.clone());
              const blob = await response.blob();
              const localUrl = URL.createObjectURL(blob);
              memoryCache.set(src, localUrl);
              if (isMounted) {
                setCachedSrc(localUrl);
                setLoaded(true);
              }
            } else {
              // Failed response: fallback to original URL directly
              if (isMounted) {
                setCachedSrc(src);
                setLoaded(true);
              }
            }
          }
        } else {
          // No Cache Storage support: fallback to direct URL
          if (isMounted) {
            setCachedSrc(src);
            setLoaded(true);
          }
        }
      } catch (err) {
        // Safe graceful fallback due to CORS or lack of internet
        if (isMounted) {
          setCachedSrc(src);
          setLoaded(true);
        }
      }
    };

    cacheImage();

    return () => {
      isMounted = false;
    };
  }, [src]);

  return (
    <img
      src={cachedSrc || src}
      alt={alt}
      className={`${className || ''} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      referrerPolicy={referrerPolicy || "no-referrer"}
      onLoad={() => setLoaded(true)}
      {...props}
    />
  );
}
