import { getCachedValue, setCachedValue } from './cache';
import { rateLimiter } from './rateLimiter';

export interface FetchJsonOptions {
  cacheKey?: string;
  cacheTtlMs?: number;
  rateLimitKey?: string;
  minIntervalMs?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const {
    cacheKey,
    cacheTtlMs,
    rateLimitKey,
    minIntervalMs = 0,
    headers,
    timeoutMs = 12_000,
    signal,
  } = options;

  if (cacheKey) {
    const cached = getCachedValue<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const execute = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      if (cacheKey) {
        setCachedValue(cacheKey, data, cacheTtlMs);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  if (rateLimitKey && minIntervalMs > 0) {
    return rateLimiter.schedule(rateLimitKey, minIntervalMs, execute);
  }
  return execute();
}
