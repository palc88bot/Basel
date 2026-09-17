import fs from 'fs';

export interface ActivePosition {
  symbol: string;
  side: string;
  entryPrice: number;
  size: number;
  timestamp: string;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnl?: number;
}

export interface OpenOrder {
  orderId: string;
  symbol: string;
  orderType: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: string;
  status: string;
}

export interface CircuitBreakerState {
  dailyLoss: number;
  consecutiveLosses: number;
  maxDrawdown: number;
  lastResetDate: string | null;
  timestamp: string;
}

export interface StoredTrade {
  tradeId: string;
  symbol: string;
  side: string;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  pnl: number;
  pnlPct: number;
  reason: string;
}

export interface BotStateSchema {
  isAutoEngineActive: boolean;
  activePositions: Record<string, ActivePosition>;
  openOrders: Record<string, OpenOrder>;
  tradeHistory: StoredTrade[];
  zScores: Record<string, number>;
  circuitBreakers: CircuitBreakerState;
  lastPrices: Record<string, number>;
  lastUpdated: string;
}

export class StateDatabase {
  private filePath: string;
  private backupPath: string;
  private state: BotStateSchema;

  constructor(dbPath: string = './omega_state.json') {
    this.filePath = dbPath;
    this.backupPath = `${dbPath}.backup`;
    this.state = this.loadState();
  }

  private loadState(): BotStateSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('❌ Error loading state database, attempting restore...', e);
      if (fs.existsSync(this.backupPath)) {
        try {
          const rawBackup = fs.readFileSync(this.backupPath, 'utf8');
          return JSON.parse(rawBackup);
        } catch (err) {
          console.error('❌ Restore from backup failed', err);
        }
      }
    }

    return {
      isAutoEngineActive: true,
      activePositions: {},
      openOrders: {},
      tradeHistory: [],
      zScores: {},
      circuitBreakers: {
        dailyLoss: 0.0,
        consecutiveLosses: 0,
        maxDrawdown: 0.0,
        lastResetDate: null,
        timestamp: new Date().toISOString()
      },
      lastPrices: {},
      lastUpdated: new Date().toISOString()
    };
  }

  public setAutoEngineActive(active: boolean): void {
    this.state.isAutoEngineActive = active;
    this.saveState();
  }

  public getAutoEngineActive(): boolean {
    return this.state.isAutoEngineActive !== undefined ? this.state.isAutoEngineActive : true;
  }

  public recordCompletedTrade(trade: StoredTrade): void {
    if (!this.state.tradeHistory) this.state.tradeHistory = [];
    this.state.tradeHistory.unshift(trade);
    if (this.state.tradeHistory.length > 200) {
      this.state.tradeHistory = this.state.tradeHistory.slice(0, 200);
    }
    this.saveState();
  }

  public getTradeHistory(limit: number = 50): StoredTrade[] {
    if (!this.state.tradeHistory) this.state.tradeHistory = [];
    return this.state.tradeHistory.slice(0, limit);
  }

  private saveState(): void {
    try {
      this.state.lastUpdated = new Date().toISOString();
      const jsonStr = JSON.stringify(this.state, null, 2);
      const tempPath = `${this.filePath}.tmp`;
      
      fs.writeFileSync(tempPath, jsonStr, 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('❌ Failed to save state database:', e);
    }
  }

  public savePosition(symbol: string, side: string, entryPrice: number, size: number, stopLoss?: number, takeProfit?: number): void {
    this.state.activePositions[symbol] = {
      symbol,
      side,
      entryPrice,
      size,
      timestamp: new Date().toISOString(),
      stopLoss,
      takeProfit,
      unrealizedPnl: 0.0
    };
    this.saveState();
  }

  public getPosition(symbol: string): ActivePosition | null {
    return this.state.activePositions[symbol] || null;
  }

  public getAllPositions(): ActivePosition[] {
    return Object.values(this.state.activePositions);
  }

  public removePosition(symbol: string): void {
    delete this.state.activePositions[symbol];
    this.saveState();
  }

  public clearAllPositions(): void {
    this.state.activePositions = {};
    this.saveState();
  }

  public saveOrder(orderId: string, symbol: string, orderType: string, side: string, price: number, quantity: number): void {
    this.state.openOrders[orderId] = {
      orderId,
      symbol,
      orderType,
      side,
      price,
      quantity,
      timestamp: new Date().toISOString(),
      status: 'NEW'
    };
    this.saveState();
  }

  public getOrder(orderId: string): OpenOrder | null {
    return this.state.openOrders[orderId] || null;
  }

  public getAllOrders(): OpenOrder[] {
    return Object.values(this.state.openOrders);
  }

  public removeOrder(orderId: string): void {
    delete this.state.openOrders[orderId];
    this.saveState();
  }

  public saveZScore(symbol: string, zScore: number): void {
    this.state.zScores[symbol] = zScore;
    this.saveState();
  }

  public getZScore(symbol: string): number | null {
    return this.state.zScores[symbol] !== undefined ? this.state.zScores[symbol] : null;
  }

  public getAllZScores(): Record<string, number> {
    return { ...this.state.zScores };
  }

  public saveCircuitBreakerState(dailyLoss: number, consecutiveLosses: number, maxDrawdown: number, lastResetDate: string | null): void {
    this.state.circuitBreakers = {
      dailyLoss,
      consecutiveLosses,
      maxDrawdown,
      lastResetDate,
      timestamp: new Date().toISOString()
    };
    this.saveState();
  }

  public getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.state.circuitBreakers };
  }

  public saveLastPrice(symbol: string, price: number): void {
    this.state.lastPrices[symbol] = price;
    this.saveState();
  }

  public getLastPrice(symbol: string): number | null {
    return this.state.lastPrices[symbol] !== undefined ? this.state.lastPrices[symbol] : null;
  }

  public createBackup(): boolean {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.copyFileSync(this.filePath, this.backupPath);
        return true;
      }
      return false;
    } catch (e) {
      console.error('❌ Backup failed:', e);
      return false;
    }
  }

  public restoreFromBackup(): boolean {
    try {
      if (fs.existsSync(this.backupPath)) {
        const raw = fs.readFileSync(this.backupPath, 'utf8');
        this.state = JSON.parse(raw);
        this.saveState();
        return true;
      } else if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.state = JSON.parse(raw);
        return true;
      }
      return false;
    } catch (e) {
      console.error('❌ Restore failed:', e);
      return false;
    }
  }

  public getStatistics(): Record<string, any> {
    let sizeMb = 0;
    try {
      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        sizeMb = parseFloat((stats.size / (1024 * 1024)).toFixed(4));
      }
    } catch {}

    return {
      activePositionsCount: Object.keys(this.state.activePositions).length,
      openOrdersCount: Object.keys(this.state.openOrders).length,
      zScoresCount: Object.keys(this.state.zScores).length,
      lastPricesCount: Object.keys(this.state.lastPrices).length,
      dbSizeMb: sizeMb,
      lastUpdated: this.state.lastUpdated
    };
  }
}
