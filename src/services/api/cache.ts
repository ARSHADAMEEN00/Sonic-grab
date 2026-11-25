interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>();
const STORAGE_PREFIX = 'sg_api_cache_v1:';
const DEFAULT_TTL_MS = 1000 * 60 * 15; // 15 minutes

export function getCachedValue<T>(key: string): T | null {
  const now = Date.now();
  const mem = MEMORY_CACHE.get(key);
  if (mem) {
    if (mem.expiresAt > now) {
      return mem.value as T;
    }
    MEMORY_CACHE.delete(key);
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt > now) {
      MEMORY_CACHE.set(key, parsed);
      return parsed.value;
    }
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // Ignore storage quota / serialization issues
  }
  return null;
}

export function setCachedValue<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };
  MEMORY_CACHE.set(key, entry);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // Prune expired cache keys if storage is tight
    pruneExpiredCache();
  }
}

export function pruneExpiredCache(): void {
  const now = Date.now();
  for (const [k, entry] of MEMORY_CACHE.entries()) {
    if (entry.expiresAt <= now) MEMORY_CACHE.delete(k);
  }
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as CacheEntry<unknown>;
          if (parsed.expiresAt <= now) keysToDelete.push(k);
        } catch {
          keysToDelete.push(k);
        }
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export function clearApiCache(): number {
  MEMORY_CACHE.clear();
  let removed = 0;
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keysToDelete.push(k);
    }
    keysToDelete.forEach((k) => {
      localStorage.removeItem(k);
      removed += 1;
    });
  } catch {
    // ignore
  }
  return removed;
}

export function getApiCacheStats(): { entries: number; approxBytes: number } {
  let entries = 0;
  let approxBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        entries += 1;
        const val = localStorage.getItem(k) ?? '';
        approxBytes += (k.length + val.length) * 2;
      }
    }
  } catch {
    // ignore
  }
  return { entries, approxBytes };
}
