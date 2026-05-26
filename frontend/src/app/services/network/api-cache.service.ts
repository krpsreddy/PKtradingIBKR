import { Injectable } from '@angular/core';
import { NetworkCacheBucket, NETWORK_CACHE_TTL } from './network-cache.config';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** In-memory TTL cache shared across dashboard widgets. */
@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;

  get<T>(key: string, bucket?: NetworkCacheBucket): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, bucket: NetworkCacheBucket): void {
    const ttl = NETWORK_CACHE_TTL[bucket];
    this.store.set(key, { value, expiresAt: Date.now() + ttl });
  }

  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.store.clear();
      return;
    }
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(keyPrefix)) this.store.delete(key);
    }
  }

  stats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }
}
