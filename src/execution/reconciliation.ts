/**
 * Reconciliation - مطابقة الأرصدة والصفقات بين البوت ومنصة Bybit
 * يكتشف: Discrepancies, Missing trades, Balance drift, Orphaned orders
 */

import { HummingbotExecutor } from './hummingbotExecutor';
import { OrderTracker } from './orderTracker';
import { serverVault } from './secretVault';

export interface BalanceSnapshot {
  timestamp: number;
  exchangeBalance: number;
  botBalance: number;
  discrepancy: number;
  discrepancyPct: number;
  matched: boolean;
  exchangeName?: string;
  verified?: boolean;
}

export interface TradeRecord {
  tradeId: string;
  orderId: string;
  tradingPair: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  fee: number;
  timestamp: number;
  recordedByBot: boolean;
  recordedByExchange: boolean;
}

export class Reconciliation {
  private reconcileInterval: number; // seconds
  private discrepancyThreshold: number; // USD (e.g. $10.00)
  private discrepancyPctThreshold: number; // 0.01 = 1%
  private executor: HummingbotExecutor;
  private orderTracker: OrderTracker;
  private balanceHistory: BalanceSnapshot[] = [];
  private tradeRecords: Map<string, TradeRecord> = new Map();
  private botBalance: number = 0.0;
  private lastReconcileTime: number = 0;
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private alertCallback: ((level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL', title: string, message: string) => void) | null = null;

  constructor(
    config: {
      reconcileInterval?: number;
      discrepancyThreshold?: number;
      discrepancyPctThreshold?: number;
      initialBotBalance?: number;
    } = {},
    executor: HummingbotExecutor,
    orderTracker: OrderTracker
  ) {
    this.reconcileInterval = config.reconcileInterval ?? 60; // default 60s
    this.discrepancyThreshold = config.discrepancyThreshold ?? 10.0; // $10
    this.discrepancyPctThreshold = config.discrepancyPctThreshold ?? 0.01; // 1%
    this.botBalance = config.initialBotBalance ?? 0.0;
    this.executor = executor;
    this.orderTracker = orderTracker;
  }

  public setBotBalance(balance: number): void {
    this.botBalance = balance;
  }

  public setAlertCallback(
    callback: (level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL', title: string, message: string) => void
  ): void {
    this.alertCallback = callback;
  }

  public startContinuousReconciliation(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run first reconciliation immediately
    this.reconcile().catch(err => console.error('[Reconciliation] Error:', err));

    this.intervalTimer = setInterval(() => {
      this.reconcile().catch(err => console.error('[Reconciliation] Error:', err));
    }, this.reconcileInterval * 1000);

    console.log(`[Reconciliation] 🔄 Continuous reconciliation daemon started (every ${this.reconcileInterval}s)`);
  }

  public stopContinuousReconciliation(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * تنفيذ دورة المطابقة الشاملة (الأرصدة + الصفقات)
   */
  public async reconcile(): Promise<{
    balanceMatched: boolean;
    exchangeBalance: number;
    botBalance: number;
    discrepancy: number;
    discrepancyPct: number;
    tradesMatched: number;
    missingTrades: number;
    orphanedTrades: number;
    timestamp: number;
  }> {
    const balanceResult = await this.reconcileBalance();
    const tradeResult = await this.reconcileTrades();

    const result = {
      balanceMatched: balanceResult.balanceMatched,
      exchangeBalance: balanceResult.exchangeBalance,
      botBalance: balanceResult.botBalance,
      discrepancy: balanceResult.discrepancy,
      discrepancyPct: balanceResult.discrepancyPct,
      tradesMatched: tradeResult.tradesMatched,
      missingTrades: tradeResult.missingTrades,
      orphanedTrades: tradeResult.orphanedTrades,
      timestamp: Date.now() / 1000
    };

    // Save snapshot in history (limit 1000)
    const snapshot: BalanceSnapshot = {
      timestamp: result.timestamp,
      exchangeBalance: result.exchangeBalance,
      botBalance: result.botBalance,
      discrepancy: result.discrepancy,
      discrepancyPct: result.discrepancyPct,
      matched: result.balanceMatched
    };

    this.balanceHistory.push(snapshot);
    if (this.balanceHistory.length > 1000) {
      this.balanceHistory.shift();
    }

    // Trigger alerts if discrepancy or trade mismatch detected
    await this.checkAlerts(result);

    this.lastReconcileTime = Date.now() / 1000;
    return result;
  }

  private async reconcileBalance() {
    try {
      const { balance: exchangeBalance, exchangeName, verified } = await this.getExchangeBalance();
      
      // Update bot internal tracking balance if verified real balance is retrieved
      if (verified && exchangeBalance > 0) {
        this.botBalance = exchangeBalance;
      }

      const discrepancy = Math.abs(exchangeBalance - this.botBalance);
      let discrepancyPct = 0;
      if (this.botBalance > 0) {
        discrepancyPct = discrepancy / this.botBalance;
      }

      const matched = (!verified && exchangeBalance === 0 && this.botBalance === 0) ||
        (verified && discrepancy <= this.discrepancyThreshold && discrepancyPct <= this.discrepancyPctThreshold);

      return {
        balanceMatched: matched,
        exchangeBalance: parseFloat(exchangeBalance.toFixed(2)),
        botBalance: parseFloat(this.botBalance.toFixed(2)),
        discrepancy: parseFloat(discrepancy.toFixed(2)),
        discrepancyPct: parseFloat((discrepancyPct * 100).toFixed(2)),
        exchangeName,
        verified
      };
    } catch (err: any) {
      return {
        balanceMatched: false,
        exchangeBalance: 0,
        botBalance: this.botBalance,
        discrepancy: 0,
        discrepancyPct: 0,
        exchangeName: 'ERROR',
        verified: false
      };
    }
  }

  public async getExchangeBalance(): Promise<{ balance: number; exchangeName: string; verified: boolean }> {
    try {
      const activeExchange = serverVault.getSecret('ACTIVE_EXCHANGE') || 'BINANCE';

      if (activeExchange === 'BINANCE') {
        const binance = this.executor.getBinanceClient();
        if (binance.hasCredentials()) {
          const real = await binance.getRealWalletBalance();
          if (real.hasCredentials && real.accountType !== 'CONNECTION_ERROR') {
            return {
              balance: real.walletBalance,
              exchangeName: `Binance Futures (${binance.isTestnet() ? 'Testnet' : 'Live'})`,
              verified: true
            };
          }
        }
      }

      // Check Bybit V5
      const bybit = this.executor.getBybitClient();
      if (bybit.hasCredentials()) {
        const real = await bybit.getRealWalletBalance();
        if (real.hasCredentials) {
          return {
            balance: real.walletBalance,
            exchangeName: `Bybit V5 (${bybit.isTestnet() ? 'Testnet' : 'Live'})`,
            verified: true
          };
        }
      }

      // Fallback check Binance if Bybit had no credentials
      const binanceFallback = this.executor.getBinanceClient();
      if (binanceFallback.hasCredentials()) {
        const real = await binanceFallback.getRealWalletBalance();
        if (real.hasCredentials && real.accountType !== 'CONNECTION_ERROR') {
          return {
            balance: real.walletBalance,
            exchangeName: `Binance Futures (${binanceFallback.isTestnet() ? 'Testnet' : 'Live'})`,
            verified: true
          };
        }
      }

      return {
        balance: 0,
        exchangeName: 'غير مربوط بأي API',
        verified: false
      };
    } catch (err) {
      return {
        balance: 0,
        exchangeName: 'خطأ بالاتصال بالمنصة',
        verified: false
      };
    }
  }

  private async reconcileTrades() {
    let matched = 0;
    let missing = 0;
    let orphaned = 0;

    for (const [, trade] of this.tradeRecords.entries()) {
      if (trade.recordedByBot && trade.recordedByExchange) {
        matched++;
      } else if (trade.recordedByBot && !trade.recordedByExchange) {
        missing++;
      } else if (!trade.recordedByBot && trade.recordedByExchange) {
        orphaned++;
      }
    }

    return {
      tradesMatched: matched,
      missingTrades: missing,
      orphanedTrades: orphaned
    };
  }

  private async checkAlerts(result: {
    balanceMatched: boolean;
    exchangeBalance: number;
    botBalance: number;
    discrepancy: number;
    discrepancyPct: number;
    orphanedTrades: number;
    missingTrades: number;
  }) {
    if (!result.balanceMatched && result.discrepancy > this.discrepancyThreshold && this.alertCallback) {
      this.alertCallback(
        'CRITICAL',
        '🚨 اكتشاف تفاوت في الرصيد بين البوت والمنصة (Balance Discrepancy)',
        `رصيد المنصة: $${result.exchangeBalance} | رصيد البوت: $${result.botBalance} | فارق: $${result.discrepancy} (${result.discrepancyPct}%)`
      );
    }

    if (result.orphanedTrades > 0 && this.alertCallback) {
      this.alertCallback(
        'WARNING',
        '⚠️ صفقات أيتام على المنصة غير مسجلة بالبوت (Orphaned Trades)',
        `تم رصد ${result.orphanedTrades} صفقة على المنصة لم يبدأها البوت.`
      );
    }

    if (result.missingTrades > 0 && this.alertCallback) {
      this.alertCallback(
        'WARNING',
        '⚠️ صفقات مسجلة في البوت غير مؤكدة على المنصة (Missing Trades)',
        `تم رصد ${result.missingTrades} صفقة سجلها البوت ولم تظهر بعد في سجلات المنصة.`
      );
    }
  }

  public recordTrade(params: {
    tradeId: string;
    orderId: string;
    tradingPair: string;
    side: 'BUY' | 'SELL';
    amount: number;
    price: number;
    fee: number;
  }): void {
    this.tradeRecords.set(params.tradeId, {
      ...params,
      timestamp: Date.now() / 1000,
      recordedByBot: true,
      recordedByExchange: true
    });
  }

  public getBalanceHistory(lastN: number = 100): BalanceSnapshot[] {
    return this.balanceHistory.slice(-lastN);
  }

  public getStatistics() {
    const recent = this.balanceHistory.slice(-50);
    const avgDiscrepancy = recent.length > 0
      ? recent.reduce((sum, s) => sum + s.discrepancy, 0) / recent.length
      : 0;
    const maxDiscrepancy = recent.length > 0
      ? Math.max(...recent.map(s => s.discrepancy))
      : 0;

    return {
      isRunning: this.isRunning,
      reconcileIntervalSec: this.reconcileInterval,
      discrepancyThresholdUsd: this.discrepancyThreshold,
      discrepancyPctThreshold: this.discrepancyPctThreshold * 100,
      totalReconciliations: this.balanceHistory.length,
      avgDiscrepancyUsd: parseFloat(avgDiscrepancy.toFixed(3)),
      maxDiscrepancyUsd: parseFloat(maxDiscrepancy.toFixed(3)),
      lastReconcileTimestamp: this.lastReconcileTime,
      totalTradesRecorded: this.tradeRecords.size,
      lastSnapshot: this.balanceHistory[this.balanceHistory.length - 1] || null
    };
  }
}
