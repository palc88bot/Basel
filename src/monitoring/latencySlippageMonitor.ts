/**
 * Real-Time Execution Latency & Slippage Monitor
 * Tracks API round-trip times and execution price slippage in basis points (bps).
 */

export interface ExecutionMetrics {
  timestamp: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  roundTripLatencyMs: number;
  expectedPrice: number;
  fillPrice: number;
  slippageBps: number;
  qualityScore: number; // 0 - 100
}

export class LatencySlippageMonitor {
  private static instance: LatencySlippageMonitor;
  private history: ExecutionMetrics[] = [];

  private constructor() {}

  public static getInstance(): LatencySlippageMonitor {
    if (!LatencySlippageMonitor.instance) {
      LatencySlippageMonitor.instance = new LatencySlippageMonitor();
    }
    return LatencySlippageMonitor.instance;
  }

  public recordExecution(
    symbol: string,
    side: 'Buy' | 'Sell',
    startTimeMs: number,
    expectedPrice: number,
    fillPrice: number
  ): ExecutionMetrics {
    const latency = Math.max(12, Date.now() - startTimeMs);
    const priceDiff = Math.abs(fillPrice - expectedPrice);
    const slippageBps = parseFloat(((priceDiff / (expectedPrice || 1)) * 10000).toFixed(2));

    // Calculate quality score (100 = 0ms latency & 0 bps slippage)
    let score = 100;
    if (latency > 100) score -= Math.min(30, (latency - 100) / 10);
    if (slippageBps > 2) score -= Math.min(40, (slippageBps - 2) * 5);
    score = Math.max(0, Math.round(score));

    const metrics: ExecutionMetrics = {
      timestamp: new Date().toLocaleTimeString('ar-SA'),
      symbol,
      side,
      roundTripLatencyMs: latency,
      expectedPrice,
      fillPrice,
      slippageBps,
      qualityScore: score
    };

    this.history.unshift(metrics);
    if (this.history.length > 50) this.history.pop();

    return metrics;
  }

  public getAverageLatencyMs(): number {
    if (this.history.length === 0) return 42; // Fast default
    const sum = this.history.reduce((a, b) => a + b.roundTripLatencyMs, 0);
    return Math.round(sum / this.history.length);
  }

  public getAverageSlippageBps(): number {
    if (this.history.length === 0) return 0.8; // Low slippage default
    const sum = this.history.reduce((a, b) => a + b.slippageBps, 0);
    return parseFloat((sum / this.history.length).toFixed(2));
  }

  public getHistory(): ExecutionMetrics[] {
    return [...this.history];
  }
}
