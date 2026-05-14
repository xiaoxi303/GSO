import { DataSourceStatus } from '../types';

export type RuntimeEnv = Record<string, unknown>;

export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface CacheState {
  hit: boolean;
  stale: boolean;
  storedAt?: string;
  provider: 'kv' | 'memory' | 'none';
}

interface CacheEnvelope<T> {
  data: T;
  storedAt: number;
  expiresAt: number;
  staleUntil: number;
}

interface CachedValue<T> {
  data: T;
  state: CacheState;
}

interface CachedFetchOptions<T> {
  env: RuntimeEnv;
  namespace: 'MARKET_CACHE' | 'NEWS_CACHE';
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  fetcher: () => Promise<T>;
}

export class ProviderError extends Error {
  sourceId: string;
  code: DataSourceStatus['status'];
  status?: number;

  constructor(sourceId: string, code: DataSourceStatus['status'], message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.sourceId = sourceId;
    this.code = code;
    this.status = status;
  }
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>();
const inFlight = new Map<string, Promise<CachedValue<unknown>>>();
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();

export async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const cloudflare = await import('@opennextjs/cloudflare');
    const context = await cloudflare.getCloudflareContext({ async: true });
    return { ...process.env, ...context.env };
  } catch {
    return process.env;
  }
}

export function getEnvString(env: RuntimeEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function compactText(value: string | undefined, maxLength = 260): string {
  if (!value) return '';
  const clean = decodeBasicEntities(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}...` : clean;
}

export function stableId(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export function decodeBasicEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export async function enforceRateLimit(
  env: RuntimeEnv,
  sourceId: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (limit <= 0) return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, resetAt: Date.now() };

  const now = Date.now();
  const bucket = Math.floor(now / (windowSeconds * 1000));
  const key = `rate:${sourceId}:${bucket}`;
  const resetAt = (bucket + 1) * windowSeconds * 1000;
  const kv = getKV(env, 'MARKET_CACHE') ?? getKV(env, 'NEWS_CACHE');

  if (kv) {
    try {
      const current = Number((await kv.get(key)) ?? '0');
      if (current >= limit) return { allowed: false, remaining: 0, resetAt };
      const next = current + 1;
      await kv.put(key, String(next), { expirationTtl: windowSeconds + 10 });
      return { allowed: true, remaining: Math.max(0, limit - next), resetAt };
    } catch {
      return enforceMemoryRateLimit(key, limit, resetAt);
    }
  }

  return enforceMemoryRateLimit(key, limit, resetAt);
}

export async function cachedFetch<T>(options: CachedFetchOptions<T>): Promise<CachedValue<T>> {
  const cacheKey = `${options.namespace}:${options.key}`;
  const existing = await readCache<T>(options.env, options.namespace, cacheKey);
  const now = Date.now();

  if (existing && existing.envelope.expiresAt > now) {
    return {
      data: existing.envelope.data,
      state: {
        hit: true,
        stale: false,
        storedAt: new Date(existing.envelope.storedAt).toISOString(),
        provider: existing.provider,
      },
    };
  }

  const current = inFlight.get(cacheKey) as Promise<CachedValue<T>> | undefined;
  if (current) return current;

  const task: Promise<CachedValue<T>> = (async () => {
    try {
      const data = await options.fetcher();
      const provider: CacheState['provider'] = getKV(options.env, options.namespace) ? 'kv' : 'memory';
      const envelope: CacheEnvelope<T> = {
        data,
        storedAt: now,
        expiresAt: now + options.ttlSeconds * 1000,
        staleUntil: now + (options.ttlSeconds + options.staleSeconds) * 1000,
      };
      await writeCache(options.env, options.namespace, cacheKey, envelope, options.ttlSeconds + options.staleSeconds);
      return {
        data,
        state: {
          hit: false,
          stale: false,
          storedAt: new Date(envelope.storedAt).toISOString(),
          provider,
        },
      };
    } catch (error) {
      if (existing && existing.envelope.staleUntil > now) {
        return {
          data: existing.envelope.data,
          state: {
            hit: true,
            stale: true,
            storedAt: new Date(existing.envelope.storedAt).toISOString(),
            provider: existing.provider,
          },
        };
      }
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, task as Promise<CachedValue<unknown>>);
  return task;
}

export async function fetchJson<T>(
  sourceId: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const code: DataSourceStatus['status'] = response.status === 401 || response.status === 403
      ? 'missing_key'
      : response.status === 429
        ? 'limit_reached'
        : 'offline';
    throw new ProviderError(sourceId, code, `${sourceId} request failed with HTTP ${response.status}`, response.status);
  }

  const data = await response.json() as unknown;
  if (isRecord(data)) {
    const message = String(data.Note ?? data.Information ?? data.message ?? data.error ?? '');
    if (/limit|rate|quota|premium|call frequency/i.test(message)) {
      throw new ProviderError(sourceId, 'limit_reached', message);
    }
    if (/invalid|apikey|api key|token/i.test(message)) {
      throw new ProviderError(sourceId, 'missing_key', message);
    }
  }

  return data as T;
}

function getKV(env: RuntimeEnv, name: 'MARKET_CACHE' | 'NEWS_CACHE'): KVNamespaceLike | undefined {
  const candidate = env[name];
  if (
    isRecord(candidate)
    && typeof candidate.get === 'function'
    && typeof candidate.put === 'function'
  ) {
    return candidate as unknown as KVNamespaceLike;
  }
  return undefined;
}

async function readCache<T>(
  env: RuntimeEnv,
  namespace: 'MARKET_CACHE' | 'NEWS_CACHE',
  key: string,
): Promise<{ envelope: CacheEnvelope<T>; provider: 'kv' | 'memory' } | undefined> {
  const memory = memoryCache.get(key) as CacheEnvelope<T> | undefined;
  if (memory) return { envelope: memory, provider: 'memory' };

  const kv = getKV(env, namespace);
  if (!kv) return undefined;

  try {
    const raw = await kv.get(key);
    if (!raw) return undefined;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    memoryCache.set(key, envelope);
    return { envelope, provider: 'kv' };
  } catch {
    return undefined;
  }
}

async function writeCache<T>(
  env: RuntimeEnv,
  namespace: 'MARKET_CACHE' | 'NEWS_CACHE',
  key: string,
  envelope: CacheEnvelope<T>,
  expirationTtl: number,
): Promise<void> {
  memoryCache.set(key, envelope);
  const kv = getKV(env, namespace);
  if (!kv) return;

  try {
    await kv.put(key, JSON.stringify(envelope), { expirationTtl });
  } catch {
    // Memory cache is already populated; KV write failures should not block data display.
  }
}

function enforceMemoryRateLimit(
  key: string,
  limit: number,
  resetAt: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const current = memoryRateLimits.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt };
  if (bucket.count >= limit) return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  bucket.count += 1;
  memoryRateLimits.set(key, bucket);
  return { allowed: true, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}
