/**
 * Emergency Circuit Breaker & Kill-Switch Guard
 * Prevents catastrophic losses, monitors BTC flash crashes, and enforces daily drawdown limits.
 */

export interface CircuitBreakerConfig {
  maxDailyDrawdownPct: number; // e.g. 3.0 = -3% max loss per day
  btcFlashCrashThresholdPct: number; // e.g. 1.5% move in 60s
  maxConcurrentDrawdownUsd: number; // Max drawdown in absolute USD
}

export interface CircuitStatus {
  isTripped: boolean;
  tripReason?: string;
  trippedAt?: string;
  emergencyKillActive: boolean;
  currentDailyDrawdownPct: number;
  btcVolatilityStatus: 'STABLE' | 'ELEVATED' | 'FLASH_CRASH';
}

export class CircuitBreakerGuard {
  private static instance: CircuitBreakerGuard;
  private config: CircuitBreakerConfig = {
    maxDailyDrawdownPct: 3.0,
    btcFlashCrashThresholdPct: 1.5,
    maxConcurrentDrawdownUsd: 500
  };

  private isEmergencyKillActive: boolean = false;
  private isTripped: boolean = false;
  private tripReason: string = '';
  private trippedAt: string = '';
  private dailyStartEquity: number = 10000;
  private currentEquity: number = 10000;
  private btcPriceHistory: { price: number; time: number }[] = [];

  private constructor() {}

  public static getInstance(): CircuitBreakerGuard {
    if (!CircuitBreakerGuard.instance) {
      CircuitBreakerGuard.instance = new CircuitBreakerGuard();
    }
    return CircuitBreakerGuard.instance;
  }

  public updateEquity(currentEquity: number, dailyStartEquity?: number) {
    if (dailyStartEquity) this.dailyStartEquity = dailyStartEquity;
    this.currentEquity = currentEquity;

    const lossUsd = this.dailyStartEquity - this.currentEquity;
    const lossPct = (lossUsd / (this.dailyStartEquity || 1)) * 100;

    if (lossPct >= this.config.maxDailyDrawdownPct && !this.isTripped) {
      this.trip(`حظر سقف الخسارة اليومية: تجاوز أقصى تراجع محدد (${lossPct.toFixed(2)}% >= ${this.config.maxDailyDrawdownPct}%)`);
    }
  }

  public trackBtcPrice(btcPrice: number) {
    const now = Date.now();
    this.btcPriceHistory.push({ price: btcPrice, time: now });

    // Keep only last 60 seconds
    this.btcPriceHistory = this.btcPriceHistory.filter(p => now - p.time <= 60000);

    if (this.btcPriceHistory.length > 2) {
      const oldestPrice = this.btcPriceHistory[0].price;
      const priceChangePct = Math.abs((btcPrice - oldestPrice) / oldestPrice) * 100;

      if (priceChangePct >= this.config.btcFlashCrashThresholdPct && !this.isTripped) {
        this.trip(`حارس الانهيار السريع: تقلب مفاجئ في البيتكوين (${priceChangePct.toFixed(2)}% خلال 60 ثانية)`);
      }
    }
  }

  public toggleEmergencyKillSwitch(active?: boolean): boolean {
    if (active !== undefined) {
      this.isEmergencyKillActive = active;
    } else {
      this.isEmergencyKillActive = !this.isEmergencyKillActive;
    }

    if (this.isEmergencyKillActive) {
      this.trip('مُفتاح الطوارئ اللحظي (Emergency Kill-Switch) تم تفعيله يدوياً');
    } else if (this.isTripped && this.tripReason.includes('يدوياً')) {
      this.reset();
    }

    return this.isEmergencyKillActive;
  }

  public trip(reason: string) {
    this.isTripped = true;
    this.tripReason = reason;
    this.trippedAt = new Date().toLocaleTimeString('ar-SA');
    console.warn(`[CIRCUIT BREAKER TRIPPED]: ${reason}`);
  }

  public reset() {
    this.isTripped = false;
    this.isEmergencyKillActive = false;
    this.tripReason = '';
    this.trippedAt = '';
  }

  public getStatus(): CircuitStatus {
    const lossUsd = this.dailyStartEquity - this.currentEquity;
    const lossPct = Math.max(0, (lossUsd / (this.dailyStartEquity || 1)) * 100);

    return {
      isTripped: this.isTripped || this.isEmergencyKillActive,
      tripReason: this.tripReason,
      trippedAt: this.trippedAt,
      emergencyKillActive: this.isEmergencyKillActive,
      currentDailyDrawdownPct: parseFloat(lossPct.toFixed(2)),
      btcVolatilityStatus: this.getBtcVolStatus()
    };
  }

  private getBtcVolStatus(): 'STABLE' | 'ELEVATED' | 'FLASH_CRASH' {
    if (this.btcPriceHistory.length < 2) return 'STABLE';
    const latest = this.btcPriceHistory[this.btcPriceHistory.length - 1].price;
    const oldest = this.btcPriceHistory[0].price;
    const change = Math.abs((latest - oldest) / oldest) * 100;

    if (change >= 1.5) return 'FLASH_CRASH';
    if (change >= 0.8) return 'ELEVATED';
    return 'STABLE';
  }
}
