import { searchCondoBuildings, type CondoSearchResponse } from "./search.ts";

/**
 * Process-local cache for Calgary condo searches, shared by the /calgary
 * page and the suggestions endpoint. City data changes daily at most;
 * failures are never cached, so the next search retries.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; value: CondoSearchResponse | null }>();

export async function cachedCondoSearch(q: string): Promise<CondoSearchResponse | null> {
  const key = q.trim().replace(/\s+/g, " ").toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await searchCondoBuildings(q);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
  return value;
}
