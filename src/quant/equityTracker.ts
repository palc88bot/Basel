/**
 * Equity Curve & Performance Metrics Tracker
 */

export interface EquityPoint {
  timestamp: number;
  equity: number;
  openPositions: number;
  dailyPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface TradeRecord {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  pnl: number;
  pnlPct: number;
  reason: 'TP' | 'SL' | 'TIME' | 'MANUAL' | 'AUTO';
}

export interface PerformanceStats {
  equity: number;
  initialEquity: number;
  totalPnl: number;
  totalReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownTime: number | null;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDurationSec: number;
  dailyPnl: number;
  dailyTrades: number;
  dailyWinRate: number;
  peakEquity: number;
}

export class EquityCurveTracker {
  private initialEquity: number;
  private currentEquity: number;
  private peakEquity: number;
  private maxDrawdown: number = 0;
  private maxDrawdownTime: number | null = null;

  private equityHistory: EquityPoint[] = [];
  private tradeHistory: TradeRecord[] = [];
  private maxHistory: number;

  private dailyStartEquity: number;
  private dailyPnl: number = 0;
  private dailyTrades: number = 0;
  private dailyWins: number = 0;

  private totalPnl: number = 0;
  private returnsBuffer: number[] = [];

  constructor(initialEquity: number = 1000.0, maxHistory: number = 10000) {
    this.initialEquity = initialEquity;
    this.currentEquity = initialEquity;
    this.peakEquity = initialEquity;
    this.dailyStartEquity = initialEquity;
    this.maxHistory = maxHistory;

    this.recordPoint(0, 0);
  }

  public updateEquity(
    newEquity: number,
    openPositions: number = 0,
    unrealizedPnl: number = 0
  ) {
    const oldEquity = this.currentEquity;
    this.currentEquity = newEquity;

    if (newEquity > this.peakEquity) {
      this.peakEquity = newEquity;
    }

    if (this.peakEquity > 0) {
      const dd = (this.peakEquity - newEquity) / this.peakEquity;
      if (dd > this.maxDrawdown) {
        this.maxDrawdown = dd;
        this.maxDrawdownTime = Date.now();
      }
    }

    if (oldEquity > 0) {
      const ret = (newEquity - oldEquity) / oldEquity;
      this.returnsBuffer.push(ret);
      if (this.returnsBuffer.length > 5000) this.returnsBuffer.shift();
    }

    this.recordPoint(openPositions, unrealizedPnl);
  }

  public recordTrade(trade: TradeRecord) {
    this.tradeHistory.push(trade);
    this.totalPnl += trade.pnl;
    this.dailyPnl += trade.pnl;
    this.dailyTrades += 1;

    if (trade.pnl > 0) {
      this.dailyWins += 1;
    }

    this.updateEquity(this.currentEquity + trade.pnl);
  }

  public resetDaily() {
    this.dailyStartEquity = this.currentEquity;
    this.dailyPnl = 0;
    this.dailyTrades = 0;
    this.dailyWins = 0;
  }

  private recordPoint(openPositions: number = 0, unrealizedPnl: number = 0) {
    const sharpe = this.calculateSharpe();
    const winRate = this.calculateWinRate();

    const point: EquityPoint = {
      timestamp: Date.now(),
      equity: this.currentEquity,
      openPositions,
      dailyPnl: this.dailyPnl,
      realizedPnl: this.totalPnl,
      unrealizedPnl,
      sharpeRatio: sharpe,
      maxDrawdown: this.maxDrawdown,
      winRate
    };

    this.equityHistory.push(point);
    if (this.equityHistory.length > this.maxHistory) {
      this.equityHistory.shift();
    }
  }

  public calculateSharpe(): number {
    if (this.returnsBuffer.length < 5) return 0.0;
    const mean = this.returnsBuffer.reduce((a, b) => a + b, 0) / this.returnsBuffer.length;
    const variance = this.returnsBuffer.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.returnsBuffer.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0.0;
    return parseFloat(((mean / stdDev) * Math.sqrt(252 * 24 * 60)).toFixed(2));
  }

  public calculateSortino(): number {
    if (this.returnsBuffer.length < 5) return 0.0;
    const mean = this.returnsBuffer.reduce((a, b) => a + b, 0) / this.returnsBuffer.length;
    const downside = this.returnsBuffer.filter(r => r < 0);
    if (downside.length === 0) return 99.9;
    const downsideVar = downside.reduce((a, b) => a + Math.pow(b, 2), 0) / downside.length;
    const downsideStd = Math.sqrt(downsideVar);
    if (downsideStd === 0) return 0.0;
    return parseFloat(((mean / downsideStd) * Math.sqrt(252 * 24 * 60)).toFixed(2));
  }

  public calculateCalmar(): number {
    if (this.maxDrawdown === 0) return 0.0;
    const totalReturn = (this.currentEquity - this.initialEquity) / this.initialEquity;
    return parseFloat((totalReturn / this.maxDrawdown).toFixed(2));
  }

  public calculateWinRate(): number {
    if (this.tradeHistory.length === 0) return 0.0;
    const wins = this.tradeHistory.filter(t => t.pnl > 0).length;
    return parseFloat((wins / this.tradeHistory.length).toFixed(4));
  }

  public calculateProfitFactor(): number {
    const grossProfit = this.tradeHistory.filter(t => t.pnl > 0).reduce((a, b) => a + b.pnl, 0);
    const grossLoss = Math.abs(this.tradeHistory.filter(t => t.pnl < 0).reduce((a, b) => a + b.pnl, 0));
    if (grossLoss === 0) return grossProfit > 0 ? 99.9 : 0.0;
    return parseFloat((grossProfit / grossLoss).toFixed(2));
  }

  public calculateConsecutiveWinsLosses(): { maxWins: number; maxLosses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currWins = 0;
    let currLosses = 0;

    for (const t of this.tradeHistory) {
      if (t.pnl > 0) {
        currWins++;
        currLosses = 0;
        if (currWins > maxWins) maxWins = currWins;
      } else {
        currLosses++;
        currWins = 0;
        if (currLosses > maxLosses) maxLosses = currLosses;
      }
    }
    return { maxWins, maxLosses };
  }

  public getStats(): PerformanceStats {
    const totalTrades = this.tradeHistory.length;
    const winningTrades = this.tradeHistory.filter(t => t.pnl > 0).length;
    const losingTrades = this.tradeHistory.filter(t => t.pnl <= 0).length;
    const { maxWins, maxLosses } = this.calculateConsecutiveWinsLosses();

    const durations = this.tradeHistory.map(t => (t.exitTime - t.entryTime) / 1000);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      equity: parseFloat(this.currentEquity.toFixed(2)),
      initialEquity: this.initialEquity,
      totalPnl: parseFloat(this.totalPnl.toFixed(2)),
      totalReturnPct: parseFloat((((this.currentEquity - this.initialEquity) / this.initialEquity) * 100).toFixed(2)),
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: parseFloat((this.calculateWinRate() * 100).toFixed(1)),
      sharpeRatio: this.calculateSharpe(),
      sortinoRatio: this.calculateSortino(),
      calmarRatio: this.calculateCalmar(),
      profitFactor: this.calculateProfitFactor(),
      expectancy: totalTrades > 0 ? parseFloat((this.totalPnl / totalTrades).toFixed(2)) : 0,
      maxDrawdown: parseFloat((this.maxDrawdown * 100).toFixed(2)),
      maxDrawdownTime: this.maxDrawdownTime,
      maxConsecutiveWins: maxWins,
      maxConsecutiveLosses: maxLosses,
      avgTradeDurationSec: Math.round(avgDuration),
      dailyPnl: parseFloat(this.dailyPnl.toFixed(2)),
      dailyTrades: this.dailyTrades,
      dailyWinRate: this.dailyTrades > 0 ? parseFloat(((this.dailyWins / this.dailyTrades) * 100).toFixed(1)) : 0,
      peakEquity: parseFloat(this.peakEquity.toFixed(2))
    };
  }

  public getEquityPoints(): EquityPoint[] {
    return this.equityHistory;
  }

  public getTradeHistory(): TradeRecord[] {
    return this.tradeHistory;
  }
}
