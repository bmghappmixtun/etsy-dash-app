/**
 * Token-bucket rate limiter for outbound API calls.
 *
 * Etsy: 10 req/s, but burst limits apply.
 * AfterShip: 10 req/s on free plan.
 *
 * Usage:
 *   const limiter = new TokenBucket({ capacity: 10, refillRate: 10 });
 *   await limiter.acquire();
 *   await fetch(...);
 */

interface BucketOptions {
  capacity: number;
  refillRate: number; // tokens per second
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];
  private capacity: number;
  private refillRate: number;

  constructor({ capacity, refillRate }: BucketOptions) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Wait until a token is available, then consume it.
   */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until next token is available
    const waitMs = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
    return new Promise((resolve) => {
      this.queue.push(resolve);
      setTimeout(() => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
        }
        const next = this.queue.shift();
        next?.();
      }, waitMs);
    });
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const added = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + added);
    this.lastRefill = now;
  }
}

// Global rate limiters, one per upstream
export const etsyLimiter = new TokenBucket({ capacity: 10, refillRate: 10 });
export const afterShipLimiter = new TokenBucket({
  capacity: 10,
  refillRate: 10,
});
