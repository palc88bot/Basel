/**
 * Circuit Breakers Manager
 * Protects capital against max daily loss (5%), max drawdown (10%), and consecutive losses (3).
 */

export interface CircuitBreakersConfig {
  maxDailyLossPct?: number;       // default 0.05 (5%)
  maxDrawdownPct?: number;        // default 0.10 (10%)
  maxConsecutiveLosses?: number;  // default 3
}

export class CircuitBreakersManager {
  private maxDailyLossPct: number;
  private maxDrawdownPct: number;
  private maxConsecutiveLosses: number;

  private dailyStartEquity: number;
  private consecutiveLosses = 0;
  private isHalted = false;
  private haltReason = '';

  constructor(initialEquity: number, config: CircuitBreakersConfig = {}) {
    this.dailyStartEquity = initialEquity;
    this.maxDailyLossPct = config.maxDailyLossPct ?? 0.05;
    this.maxDrawdownPct = config.maxDrawdownPct ?? 0.10;
    this.maxConsecutiveLosses = config.maxConsecutiveLosses ?? 3;
  }

  public recordTradeResult(pnl: number): void {
    if (pnl < 0) {
      this.consecutiveLosses++;
    } else {
      this.consecutiveLosses = 0;
    }
  }

  public check(currentEquity: number, maxDrawdownRatio: number): { halted: boolean; reason: string } {
    if (this.isHalted) {
      return { halted: true, reason: this.haltReason };
    }

    // 1. Daily Loss
    if (this.dailyStartEquity > 0) {
      const dailyLoss = (this.dailyStartEquity - currentEquity) / this.dailyStartEquity;
      if (dailyLoss >= this.maxDailyLossPct) {
        this.isHalted = true;
        this.haltReason = `🚨 تجاوز الحد الأقصى للخسارة اليومية (${(dailyLoss * 100).toFixed(2)}% >= ${(this.maxDailyLossPct * 100).toFixed(0)}%)`;
        return { halted: true, reason: this.haltReason };
      }
    }

    // 2. Max Drawdown
    if (maxDrawdownRatio >= this.maxDrawdownPct) {
      this.isHalted = true;
      this.haltReason = `🚨 تجاوز الحد الأقصى للتراجع Max Drawdown (${(maxDrawdownRatio * 100).toFixed(2)}% >= ${(this.maxDrawdownPct * 100).toFixed(0)}%)`;
      return { halted: true, reason: this.haltReason };
    }

    // 3. Consecutive Losses
    if (this.consecutiveLosses >= this.maxConsecutiveLosses) {
      this.isHalted = true;
      this.haltReason = `🚨 تجاوز الحد الأقصى للخسائر المتتالية (${this.consecutiveLosses} صفقات)`;
      return { halted: true, reason: this.haltReason };
    }

    return { halted: false, reason: '' };
  }

  public resetDailyEquity(newEquity: number): void {
    this.dailyStartEquity = newEquity;
  }

  public resetHalt(): void {
    this.isHalted = false;
    this.haltReason = '';
    this.consecutiveLosses = 0;
  }

  public getStatus(): { isHalted: boolean; haltReason: string; consecutiveLosses: number } {
    return {
      isHalted: this.isHalted,
      haltReason: this.haltReason,
      consecutiveLosses: this.consecutiveLosses
    };
  }
}
