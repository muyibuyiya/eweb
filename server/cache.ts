export class LruCache<T> {
  private map = new Map<string, { value: T; size: number; expiresAt: number }>();
  private totalSize = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly maxEntries: number
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.totalSize -= entry.size;
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, sizeBytes = 1024): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalSize -= existing.size;
      this.map.delete(key);
    }
    if (sizeBytes > this.maxBytes) return;

    while (
      this.map.size >= this.maxEntries ||
      this.totalSize + sizeBytes > this.maxBytes
    ) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey)!;
      this.totalSize -= oldest.size;
      this.map.delete(oldestKey);
    }

    this.map.set(key, {
      value,
      size: sizeBytes,
      expiresAt: Date.now() + ttlMs,
    });
    this.totalSize += sizeBytes;
  }
}
