/**
 * Simple in-memory TTL cache for the edge function.
 * Reduces redundant API calls to external providers.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Default TTLs (in milliseconds) */
export const TTL = {
  QUOTE: 30_000,       // 30 seconds for live prices
  MOVERS: 60_000,      // 1 minute for top movers
  HISTORY: 300_000,    // 5 minutes for historical data
  NEWS: 300_000,       // 5 minutes for news
  FUNDAMENTALS: 600_000, // 10 minutes for fundamentals
  SEARCH: 600_000,     // 10 minutes for search results
};

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() < entry.expiresAt) return entry.data as T;
  store.delete(key);
  return null;
}

export function cacheSet(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/** Clean up expired entries periodically */
let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // once per minute
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (now >= entry.expiresAt) store.delete(key);
  }
}

// Run cleanup every 60 seconds
setInterval(cleanup, 60_000);