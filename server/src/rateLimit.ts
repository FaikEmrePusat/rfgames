/** Basit socket başına kayan pencere rate limit. */
export class SocketRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string): boolean {
    const now = Date.now();
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => now - t < this.windowMs);
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }
}
