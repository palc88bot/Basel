/**
 * Rate Limiter - حماية من تجاوز حدود Bybit V5 API
 * يدعم: Weighted rate limits, Multiple endpoints, Burst protection, Adaptive safety margin
 */

export interface RateLimitConfig {
  endpoint: string;
  weight: number;
  limit: number;
  windowSeconds: number;
}

export interface RequestRecord {
  timestamp: number;
  weight: number;
  endpoint: string;
}

export class RateLimiter {
  protected rateLimits: Record<string, RateLimitConfig>;
  protected requestHistory: Record<string, RequestRecord[]>;
  protected backoffUntil: number = 0;
  protected consecutiveFailures: number = 0;

  constructor(config: { rateLimits?: Record<string, RateLimitConfig> } = {}) {
    // Bybit V5 Perpetual Rate Limits (https://bybit-exchange.github.io/docs/v5/rate-limit)
    this.rateLimits = config.rateLimits || {
      order: {
        endpoint: 'order',
        weight: 1,
        limit: 100,
        windowSeconds: 10
      },
      query: {
        endpoint: 'query',
        weight: 1,
        limit: 600,
        windowSeconds: 60
      },
      ticker: {
        endpoint: 'ticker',
        weight: 1,
        limit: 1200,
        windowSeconds: 60
      }
    };

    this.requestHistory = {
      order: [],
      query: [],
      ticker: []
    };
  }

  public async canExecute(endpoint: string = 'order', weight: number = 1): Promise<boolean> {
    const now = Date.now() / 1000;

    // Check backoff
    if (now < this.backoffUntil) {
      return false;
    }

    if (!this.rateLimits[endpoint]) {
      return true;
    }

    const limitConfig = this.rateLimits[endpoint];
    const windowStart = now - limitConfig.windowSeconds;

    // Clean old requests
    if (!this.requestHistory[endpoint]) {
      this.requestHistory[endpoint] = [];
    }
    this.requestHistory[endpoint] = this.requestHistory[endpoint].filter(
      req => req.timestamp >= windowStart
    );

    const currentWeight = this.requestHistory[endpoint].reduce((sum, req) => sum + req.weight, 0);

    if (currentWeight + weight <= limitConfig.limit) {
      this.requestHistory[endpoint].push({
        timestamp: now,
        weight,
        endpoint
      });
      return true;
    }

    return false;
  }

  public async waitIfNeeded(endpoint: string = 'order', weight: number = 1): Promise<boolean> {
    const maxWaitSeconds = 60;
    let waited = 0;

    while (waited < maxWaitSeconds) {
      if (await this.canExecute(endpoint, weight)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      waited += 0.1;
    }

    return false;
  }

  public getRemainingCapacity(endpoint: string = 'order'): [number, number] {
    if (!this.rateLimits[endpoint]) return [0, 0];

    const limitConfig = this.rateLimits[endpoint];
    const now = Date.now() / 1000;
    const windowStart = now - limitConfig.windowSeconds;

    const history = (this.requestHistory[endpoint] || []).filter(
      req => req.timestamp >= windowStart
    );
    this.requestHistory[endpoint] = history;

    const currentWeight = history.reduce((sum, req) => sum + req.weight, 0);
    return [Math.max(0, limitConfig.limit - currentWeight), limitConfig.limit];
  }

  public getWaitTime(endpoint: string = 'order', weight: number = 1): number {
    if (!this.rateLimits[endpoint]) return 0.0;

    const limitConfig = this.rateLimits[endpoint];
    const now = Date.now() / 1000;
    const windowStart = now - limitConfig.windowSeconds;

    const history = (this.requestHistory[endpoint] || []).filter(
      req => req.timestamp >= windowStart
    );
    const currentWeight = history.reduce((sum, req) => sum + req.weight, 0);

    if (currentWeight + weight <= limitConfig.limit) return 0.0;

    if (history.length > 0) {
      const oldest = history[0];
      const waitTime = (oldest.timestamp + limitConfig.windowSeconds) - now;
      return Math.max(0, waitTime);
    }

    return 0.0;
  }

  public handleRateLimitError(): void {
    this.consecutiveFailures += 1;
    const backoffSeconds = Math.min(60, Math.pow(2, this.consecutiveFailures));
    this.backoffUntil = (Date.now() / 1000) + backoffSeconds;
  }

  public resetFailures(): void {
    this.consecutiveFailures = 0;
    this.backoffUntil = 0;
  }

  public getStatus() {
    const now = Date.now() / 1000;
    const endpoints: Record<string, { currentWeight: number; maxWeight: number; remaining: number; utilization: number }> = {};

    for (const key of Object.keys(this.rateLimits)) {
      const [remaining, maxWeight] = this.getRemainingCapacity(key);
      const currentWeight = maxWeight - remaining;
      endpoints[key] = {
        currentWeight,
        maxWeight,
        remaining,
        utilization: maxWeight > 0 ? parseFloat((currentWeight / maxWeight).toFixed(3)) : 0
      };
    }

    return {
      backoffActive: now < this.backoffUntil,
      backoffUntil: this.backoffUntil,
      backoffRemainingSec: Math.max(0, Math.ceil(this.backoffUntil - now)),
      consecutiveFailures: this.consecutiveFailures,
      endpoints
    };
  }

  public updateRateLimits(newLimits: Record<string, RateLimitConfig>): void {
    for (const [endpoint, config] of Object.entries(newLimits)) {
      this.rateLimits[endpoint] = config;
      this.requestHistory[endpoint] = [];
    }
  }
}

/**
 * AdaptiveRateLimiter - حماية متكيفة مع هامش أمان 80% لمنع الحظر
 */
export class AdaptiveRateLimiter extends RateLimiter {
  private safetyMargin: number;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;

  constructor(config: { safetyMargin?: number } = {}) {
    super();
    this.safetyMargin = config.safetyMargin ?? 0.8; // Use max 80% of limit
  }

  public override async canExecute(endpoint: string = 'order', weight: number = 1): Promise<boolean> {
    const now = Date.now() / 1000;

    if (now < this.backoffUntil) {
      return false;
    }

    if (!this.rateLimits[endpoint]) {
      return true;
    }

    const limitConfig = this.rateLimits[endpoint];
    const safeLimit = Math.floor(limitConfig.limit * this.safetyMargin);

    const windowStart = now - limitConfig.windowSeconds;
    if (!this.requestHistory[endpoint]) {
      this.requestHistory[endpoint] = [];
    }
    this.requestHistory[endpoint] = this.requestHistory[endpoint].filter(
      req => req.timestamp >= windowStart
    );

    const currentWeight = this.requestHistory[endpoint].reduce((sum, req) => sum + req.weight, 0);

    if (currentWeight + weight <= safeLimit) {
      this.requestHistory[endpoint].push({
        timestamp: now,
        weight,
        endpoint
      });
      this.successfulRequests++;
      return true;
    }

    this.failedRequests++;
    return false;
  }

  public getSuccessRate(): number {
    const total = this.successfulRequests + this.failedRequests;
    if (total === 0) return 1.0;
    return parseFloat((this.successfulRequests / total).toFixed(3));
  }

  public getAdaptiveMetrics() {
    return {
      safetyMarginPct: this.safetyMargin * 100,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRatePct: this.getSuccessRate() * 100
    };
  }
}
