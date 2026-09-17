/**
 * OMEGA Bot - TypeScript WebSocket Reconnection Manager
 * Implements Exponential Backoff + Jitter reconnection strategy, connection status monitoring,
 * and data validation with StateDatabase integration.
 */

import { StateDatabase } from './stateDatabase';

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  PAUSED = 'PAUSED',
  FAILED = 'FAILED'
}

export class ReconnectionStrategy {
  private baseDelay: number;
  private maxDelay: number;
  private multiplier: number;
  private jitterRange: number;
  private maxAttempts: number;
  public currentAttempt = 0;

  constructor(config: {
    baseDelay?: number;
    maxDelay?: number;
    multiplier?: number;
    jitterRange?: number;
    maxAttempts?: number;
  } = {}) {
    this.baseDelay = config.baseDelay ?? 1000;       // 1s
    this.maxDelay = config.maxDelay ?? 60000;       // 60s
    this.multiplier = config.multiplier ?? 2.0;
    this.jitterRange = config.jitterRange ?? 500;   // 0.5s ms
    this.maxAttempts = config.maxAttempts ?? 10;
  }

  public getNextDelay(): number {
    if (this.currentAttempt >= this.maxAttempts) {
      return -1;
    }

    let delay = this.baseDelay * Math.pow(this.multiplier, this.currentAttempt);
    delay = Math.min(delay, this.maxDelay);

    // Add jitter
    const jitter = Math.random() * this.jitterRange;
    delay += jitter;

    this.currentAttempt++;
    return delay;
  }

  public reset(): void {
    this.currentAttempt = 0;
  }

  public hasExceededMaxAttempts(): boolean {
    return this.currentAttempt >= this.maxAttempts;
  }
}

export class DataValidator {
  public static validatePrice(symbol: string, newPrice: number, lastPrice: number | null, maxChangePct = 5.0): boolean {
    if (lastPrice === null || lastPrice <= 0) return true;
    const change = Math.abs((newPrice - lastPrice) / lastPrice) * 100;
    if (change > maxChangePct) {
      console.warn(`⚠️ [DataValidator] Suspicious price spike for ${symbol}: ${lastPrice} -> ${newPrice} (${change.toFixed(2)}%)`);
      return false;
    }
    return true;
  }

  public static validateTimestamp(timestampMs: number, maxAgeMs = 300000): boolean {
    const age = Date.now() - timestampMs;
    if (age > maxAgeMs) {
      console.warn(`⚠️ [DataValidator] Stale data received: age=${Math.round(age / 1000)}s`);
      return false;
    }
    return true;
  }
}

export class UniversalWebSocketManager {
  private url: string;
  private stateDb: StateDatabase;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private strategy = new ReconnectionStrategy();
  private onMessageCallback?: (data: any) => void;
  private exchangeName: string;

  constructor(url: string, stateDb: StateDatabase, exchangeName = "Universal Exchange API", onMessageCallback?: (data: any) => void) {
    this.url = url;
    this.stateDb = stateDb;
    this.exchangeName = exchangeName;
    this.onMessageCallback = onMessageCallback;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public setStatus(status: ConnectionStatus): void {
    this.status = status;
  }

  public getExchangeName(): string {
    return this.exchangeName;
  }

  public handleIncomingMessage(symbol: string, price: number): void {
    const lastPrice = this.stateDb.getLastPrice(symbol);
    if (DataValidator.validatePrice(symbol, price, lastPrice)) {
      this.stateDb.saveLastPrice(symbol, price);
      if (this.onMessageCallback) {
        this.onMessageCallback({ symbol, price, timestamp: Date.now() });
      }
    }
  }
}
