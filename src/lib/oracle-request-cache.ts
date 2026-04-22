/**
 * oracle-request-cache.ts
 * -----------------------
 * Lightweight per-process TTL cache + in-flight dedupe for Oracle gateway
 * requests. Used by server actions to:
 *
 *   1. Collapse concurrent identical lookups into a single upstream call
 *      (in-flight dedupe).
 *   2. Cache successful responses briefly so a burst of shop traffic does not
 *      amplify eBay quota usage for the same card identity.
 *
 * Scope: single Node.js / server runtime instance. For multi-instance
 * deployments consider lifting this to Redis — see the capacity runbook.
 */

type CacheEntry<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (cache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
      if (cache.size <= 4000) break;
    }
  }
}

/**
 * Execute `fn` once per identical `key`, returning a shared promise to all
 * concurrent callers while it is in flight. Successful values are cached for
 * `ttlMs`. A result is considered cacheable unless `shouldCache(value)` is
 * false (default: cache everything truthy).
 */
export async function dedupeAndCache<T>(
  key: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; shouldCache?: (value: T) => boolean } = {},
): Promise<T> {
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;
  const shouldCache = opts.shouldCache ?? ((v: T) => Boolean(v));

  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const value = await fn();
      if (shouldCache(value)) setCached(key, value, ttl);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function clearOracleRequestCache() {
  cache.clear();
  inflight.clear();
}
