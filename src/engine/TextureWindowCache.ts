import * as THREE from 'three';

/**
 * Sliding-window GPU texture cache.
 * Keeps at most `maxEntries` textures resident in VRAM, protecting active-window keys
 * from eviction during concurrent multi-slot preloads (e.g. 4-up Mosaic scenes).
 */
export class TextureWindowCache {
  private readonly loader: THREE.TextureLoader;
  private readonly maxEntries: number;
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly inflight = new Map<string, Promise<THREE.Texture>>();
  private readonly failedUrls = new Set<string>();
  private activeKeepSet = new Set<string>();
  private generation = 0;
  private disposed = false;

  constructor(maxEntries = 24) {
    this.maxEntries = Math.max(8, maxEntries);
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('anonymous');
  }

  public get(url: string): THREE.Texture | null {
    const tex = this.cache.get(url);
    if (!tex) return null;
    // Refresh LRU order
    this.cache.delete(url);
    this.cache.set(url, tex);
    return tex;
  }

  public async ensure(url: string): Promise<THREE.Texture | null> {
    if (this.disposed || this.failedUrls.has(url)) return null;
    const existing = this.get(url);
    if (existing) return existing;

    const gen = this.generation;
    let promise = this.inflight.get(url);
    if (!promise) {
      promise = this.loader.loadAsync(url).then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
      });
      this.inflight.set(url, promise);
    }

    try {
      const texture = await promise;
      this.inflight.delete(url);
      if (this.disposed || gen !== this.generation) {
        texture.dispose();
        return null;
      }
      this.cache.set(url, texture);
      this.evictIfNeeded();
      return texture;
    } catch {
      this.inflight.delete(url);
      if (!this.disposed && gen === this.generation) {
        this.failedUrls.add(url);
      }
      return null;
    }
  }

  /**
   * Preloads textures needed around current playback position and evicts distant ones,
   * while guaranteeing `keepSet` URLs are never evicted mid-flight.
   * Returns how many textures were newly loaded into the cache.
   */
  public async preloadWindow(urls: string[], keepSet: Set<string>): Promise<number> {
    if (this.disposed) return 0;
    this.activeKeepSet = keepSet;
    this.evictIfNeeded();

    const unique = Array.from(new Set(urls));
    const results = await Promise.all(
      unique.map(async (u) => {
        if (this.cache.has(u)) return false;
        const tex = await this.ensure(u);
        return tex !== null;
      })
    );
    return results.filter(Boolean).length;
  }

  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxEntries) return;

    // First pass: evict oldest entries that are NOT in activeKeepSet
    for (const [key, tex] of Array.from(this.cache.entries())) {
      if (this.cache.size <= this.maxEntries) return;
      if (!this.activeKeepSet.has(key)) {
        tex.dispose();
        this.cache.delete(key);
      }
    }

    // Fallback safety cap only if activeKeepSet itself exceeds maxEntries
    while (this.cache.size > Math.max(this.maxEntries, this.activeKeepSet.size)) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const tex = this.cache.get(oldestKey);
      tex?.dispose();
      this.cache.delete(oldestKey);
    }
  }

  public size(): number {
    return this.cache.size;
  }

  public clearFailed(): void {
    this.failedUrls.clear();
  }

  public clear(): void {
    this.generation++;
    for (const tex of this.cache.values()) {
      tex.dispose();
    }
    this.cache.clear();
    this.inflight.clear();
    this.failedUrls.clear();
    this.activeKeepSet.clear();
  }

  public dispose(): void {
    this.disposed = true;
    this.clear();
  }
}
