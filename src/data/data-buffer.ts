// src/data/data-buffer.ts
export interface MarketData {
  rsi: number;
  macdHistogram: number;
  bbPercentB: number;
  atrNormalized: number;
  volumeDelta: number;
  orderBookImbalance: number;
  momentum: number;
  priceAction: number;
  futureReturn?: number;
}

export class DataBuffer {
  private buffer: MarketData[] = [];
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  public push(data: MarketData): void {
    this.buffer.push(data);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  public getRecent(n: number = 100): MarketData[] {
    return this.buffer.slice(-n);
  }

  public getAll(): MarketData[] {
    return [...this.buffer];
  }

  public size(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer = [];
  }
}
