/**
 * OMEGA Bot - Hybrid Exit System
 * ==============================
 * نظام الخروج الهجين المعتمد:
 * 1. وقف خسارة كارثي صلب على المنصة (Hard Catastrophic Stop Loss)
 * 2. خروج ذكي ديناميكي وفق عودة الـ Z-Score للمتوسط (Mean Reversion)
 * 3. آلية Hysteresis لحماية الأرباح وتجنب الخروج الكاذب
 * 4. تنظيف تلقائي للأوامر المتبادلة (OCO Cleanup upon Fill)
 * 5. إدارة دقة الأسعار والكميات (Tick Size & Lot Precision)
 */

import { HummingbotExecutor, OrderStatus } from './hummingbotExecutor';
import { StateDatabase } from '../quant/stateDatabase';
import { serverVault } from './secretVault';

export interface TickConfig {
  symbol: string;
  tickSize: number;
  stepSize: number;
  pricePrecision: number;
  quantityPrecision: number;
}

export interface ExitOrders {
  symbol: string;
  side: 'BUY' | 'SELL'; // Original position side (BUY = LONG, SELL = SHORT)
  tpOrderId?: string;
  tpPrice: number;
  slOrderId?: string;
  slPrice: number;
  timeExitTimestamp: number;
  timeExitSeconds: number;
  entryPrice: number;
  entryZScore: number;
  createdAt: number;
  exitSignalStartTime: number | null;
  hysteresisSeconds: number;
  size: number;
}

export class TickSizeManager {
  private tickConfigs: Map<string, TickConfig> = new Map();

  constructor() {
    // Initialize common futures default precisions
    const defaults: Record<string, { tick: number; step: number; pPrec: number; qPrec: number }> = {
      'BTCUSDT': { tick: 0.1, step: 0.001, pPrec: 1, qPrec: 3 },
      'ETHUSDT': { tick: 0.01, step: 0.01, pPrec: 2, qPrec: 2 },
      'SOLUSDT': { tick: 0.01, step: 0.1, pPrec: 2, qPrec: 1 },
      'BNBUSDT': { tick: 0.01, step: 0.01, pPrec: 2, qPrec: 2 },
      'XRPUSDT': { tick: 0.0001, step: 1.0, pPrec: 4, qPrec: 0 },
      'ADAUSDT': { tick: 0.0001, step: 1.0, pPrec: 4, qPrec: 0 },
      'AVAXUSDT': { tick: 0.001, step: 0.1, pPrec: 3, qPrec: 1 },
      'DOGEUSDT': { tick: 0.00001, step: 10.0, pPrec: 5, qPrec: 0 },
      'NEARUSDT': { tick: 0.001, step: 0.1, pPrec: 3, qPrec: 1 },
      'SUIUSDT': { tick: 0.0001, step: 1.0, pPrec: 4, qPrec: 0 }
    };

    for (const [sym, cfg] of Object.entries(defaults)) {
      this.tickConfigs.set(sym, {
        symbol: sym,
        tickSize: cfg.tick,
        stepSize: cfg.step,
        pricePrecision: cfg.pPrec,
        quantityPrecision: cfg.qPrec
      });
    }
  }

  public registerSymbol(symbol: string, tickSize: number, stepSize: number): void {
    const pPrec = this.calculatePrecision(tickSize);
    const qPrec = this.calculatePrecision(stepSize);
    this.tickConfigs.set(symbol, {
      symbol,
      tickSize,
      stepSize,
      pricePrecision: pPrec,
      quantityPrecision: qPrec
    });
  }

  private calculatePrecision(value: number): number {
    const s = value.toString();
    if (s.includes('e-')) {
      const parts = s.split('e-');
      return parseInt(parts[1], 10);
    }
    const dec = s.split('.')[1];
    return dec ? dec.length : 0;
  }

  public roundPrice(symbol: string, price: number): number {
    const cfg = this.tickConfigs.get(symbol);
    if (!cfg) {
      return parseFloat(price.toFixed(4));
    }
    const rounded = Math.round(price / cfg.tickSize) * cfg.tickSize;
    return parseFloat(rounded.toFixed(cfg.pricePrecision));
  }

  public roundQuantity(symbol: string, quantity: number): number {
    const cfg = this.tickConfigs.get(symbol);
    if (!cfg) {
      return parseFloat(quantity.toFixed(4));
    }
    const rounded = Math.round(quantity / cfg.stepSize) * cfg.stepSize;
    return parseFloat(rounded.toFixed(cfg.quantityPrecision));
  }
}

export class HybridExitSystem {
  private stateDb: StateDatabase;
  private executor: HummingbotExecutor;
  private tickManager: TickSizeManager;
  private catastrophicSlPercent: number; // e.g. 0.03 = 3%
  private timeExitSeconds: number; // e.g. 3600 = 60 mins
  private hysteresisSeconds: number; // e.g. 3.0s
  private activeExits: Map<string, ExitOrders> = new Map();

  constructor(
    stateDb: StateDatabase,
    executor: HummingbotExecutor,
    options: {
      catastrophicSlPercent?: number;
      timeExitSeconds?: number;
      hysteresisSeconds?: number;
    } = {}
  ) {
    this.stateDb = stateDb;
    this.executor = executor;
    this.tickManager = new TickSizeManager();
    this.catastrophicSlPercent = options.catastrophicSlPercent ?? 0.03;
    this.timeExitSeconds = options.timeExitSeconds ?? 3600;
    this.hysteresisSeconds = options.hysteresisSeconds ?? 3.0;

    console.log(
      `[HybridExitSystem] 🛡️ Initialized with ${this.catastrophicSlPercent * 100}% Catastrophic SL, ` +
      `${this.timeExitSeconds}s max time-stop, ${this.hysteresisSeconds}s Hysteresis window`
    );
  }

  public getTickManager(): TickSizeManager {
    return this.tickManager;
  }

  /**
   * حساب أسعار الوقف الكارثي والهدف المبدئي:
   * - BUY (LONG): وقف الخسارة تحت سعر الدخول (entry * (1 - SL))، والهدف فوق سعر الدخول
   * - SELL (SHORT): وقف الخسارة فوق سعر الدخول (entry * (1 + SL))، والهدف تحت سعر الدخول
   */
  public calculateExitPrices(symbol: string, side: 'BUY' | 'SELL', entryPrice: number): { tpPrice: number; slPrice: number } {
    let slPrice = 0;
    let tpPrice = 0;

    if (side === 'BUY') {
      slPrice = entryPrice * (1 - this.catastrophicSlPercent);
      tpPrice = entryPrice * (1 + this.catastrophicSlPercent * 2);
    } else {
      slPrice = entryPrice * (1 + this.catastrophicSlPercent);
      tpPrice = entryPrice * (1 - this.catastrophicSlPercent * 2);
    }

    return {
      slPrice: this.tickManager.roundPrice(symbol, slPrice),
      tpPrice: this.tickManager.roundPrice(symbol, tpPrice)
    };
  }

  /**
   * تسليح وتفعيل شبكة الأمان الكارثية على المنصة وتسجيلها في الذاكرة وقاعدة البيانات
   */
  public async armExitProtection(params: {
    symbol: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    entryZ: number;
    size: number;
  }): Promise<ExitOrders | null> {
    const { symbol, side, entryPrice, entryZ, size } = params;
    const { slPrice, tpPrice } = this.calculateExitPrices(symbol, side, entryPrice);
    const cleanQty = this.tickManager.roundQuantity(symbol, size);

    // Stop and TP orders must execute in the OPPOSITE direction of the open position
    const closeSide = side === 'BUY' ? 'SELL' : 'BUY';

    try {
      let slOrderId: string | undefined = undefined;
      let tpOrderId: string | undefined = undefined;

      const activeExchange = serverVault.getSecret('ACTIVE_EXCHANGE') || 'BINANCE';
      const binanceClient = this.executor.getBinanceClient();
      const bybitClient = this.executor.getBybitClient();

      if (activeExchange === 'BINANCE' && binanceClient.hasCredentials()) {
        const cleanSymbol = symbol.replace(/[-_]/g, '');
        // 1. Real STOP_MARKET protection with reduceOnly: true
        const slRes = await binanceClient.executeOrder(
          cleanSymbol,
          closeSide,
          'STOP_MARKET',
          cleanQty,
          undefined,
          {
            stopPrice: slPrice,
            workingType: 'MARK_PRICE',
            reduceOnly: true
          }
        );
        if (slRes.success && slRes.orderId) {
          slOrderId = slRes.orderId;
        }

        // 2. Real Take-Profit LIMIT order with reduceOnly: true
        const tpRes = await binanceClient.executeOrder(
          cleanSymbol,
          closeSide,
          'LIMIT',
          cleanQty,
          tpPrice,
          {
            reduceOnly: true,
            timeInForce: 'GTC'
          }
        );
        if (tpRes.success && tpRes.orderId) {
          tpOrderId = tpRes.orderId;
        }
      } else if (activeExchange === 'BYBIT' && bybitClient.hasCredentials()) {
        // 1. Real Bybit conditional STOP order with reduceOnly: true
        const slRes = await bybitClient.placeRealOrder({
          symbol,
          side: closeSide === 'BUY' ? 'Buy' : 'Sell',
          orderType: 'Market',
          qty: cleanQty.toString(),
          triggerPrice: slPrice.toString(),
          triggerDirection: closeSide === 'BUY' ? 1 : 2,
          triggerBy: 'MarkPrice',
          orderFilter: 'StopOrder',
          reduceOnly: true
        });
        if (slRes.success && slRes.orderId) {
          slOrderId = slRes.orderId;
        }

        // 2. Real Bybit Take Profit LIMIT order with reduceOnly: true
        const tpRes = await bybitClient.placeRealOrder({
          symbol,
          side: closeSide === 'BUY' ? 'Buy' : 'Sell',
          orderType: 'Limit',
          qty: cleanQty.toString(),
          price: tpPrice.toString(),
          reduceOnly: true
        });
        if (tpRes.success && tpRes.orderId) {
          tpOrderId = tpRes.orderId;
        }
      }

      // If simulated/test mode or paper execution
      if (!slOrderId) {
        slOrderId = `SIM-SL-${Date.now()}-${symbol}`;
      }
      if (!tpOrderId) {
        tpOrderId = `SIM-TP-${Date.now()}-${symbol}`;
      }

      const exitOrders: ExitOrders = {
        symbol,
        side,
        slOrderId,
        slPrice,
        tpOrderId,
        tpPrice,
        timeExitTimestamp: Date.now() + this.timeExitSeconds * 1000,
        timeExitSeconds: this.timeExitSeconds,
        entryPrice,
        entryZScore: entryZ,
        createdAt: Date.now(),
        exitSignalStartTime: null,
        hysteresisSeconds: this.hysteresisSeconds,
        size: cleanQty
      };

      this.activeExits.set(symbol, exitOrders);

      // Save position protection to SQLite StateDatabase
      this.stateDb.savePosition(
        symbol,
        side === 'BUY' ? 'LONG' : 'SHORT',
        entryPrice,
        cleanQty,
        slPrice,
        tpPrice
      );

      console.log(
        `[HybridExitSystem] 🎯 Armed exits for ${symbol} (${side}) | SL=$${slPrice} (ID: ${slOrderId}) | TP=$${tpPrice}`
      );

      return exitOrders;
    } catch (err: any) {
      console.error(`[HybridExitSystem] ❌ Failed to arm exit protection for ${symbol}:`, err.message);
      return null;
    }
  }

  /**
   * فحص الخروج المبكر الذكي بالـ Z-Score مع فلتر الثبات (Hysteresis):
   * - BUY (LONG): نربح عندما يرتفع Z إلى 0.0 أو يتجاوزه (currentZ >= targetZ)
   * - SELL (SHORT): نربح عندما يهبط Z إلى 0.0 أو يتجاوزه (currentZ <= -targetZ)
   */
  public shouldExitEarly(
    symbol: string,
    currentZ: number,
    targetZ: number = 0.0
  ): { shouldExit: boolean; reason: string; elapsedHysteresis?: number } {
    const exitInfo = this.activeExits.get(symbol);
    if (!exitInfo) {
      return { shouldExit: false, reason: 'No active exit protection found' };
    }

    const now = Date.now();
    let signalTriggered = false;
    let reason = '';

    // 1. Z-Score Mean Reversion Check (Mathematically Correct Logic)
    if (exitInfo.side === 'BUY') {
      // Long position: Entered at negative Z, target is reaching/exceeding targetZ (e.g. 0.0)
      if (currentZ >= targetZ) {
        signalTriggered = true;
        reason = `Mean Reverted: Long Z reached ${currentZ.toFixed(2)} >= target (${targetZ.toFixed(2)})`;
      }
    } else {
      // Short position: Entered at positive Z, target is reaching/falling below -targetZ (e.g. 0.0)
      if (currentZ <= -targetZ) {
        signalTriggered = true;
        reason = `Mean Reverted: Short Z reached ${currentZ.toFixed(2)} <= target (${(-targetZ).toFixed(2)})`;
      }
    }

    // 2. Maximum Time-Stop Check
    if (exitInfo.timeExitTimestamp && now >= exitInfo.timeExitTimestamp) {
      signalTriggered = true;
      reason = `Time-Stop Reached: ${exitInfo.timeExitSeconds}s elapsed`;
    }

    // 3. Apply Hysteresis Filter (3-Second Stability Window)
    if (signalTriggered) {
      if (exitInfo.exitSignalStartTime === null) {
        exitInfo.exitSignalStartTime = now;
        return {
          shouldExit: false,
          reason: `Hysteresis window initiated for ${symbol}: ${reason}`,
          elapsedHysteresis: 0
        };
      }

      const elapsedSeconds = (now - exitInfo.exitSignalStartTime) / 1000;
      if (elapsedSeconds >= exitInfo.hysteresisSeconds) {
        return {
          shouldExit: true,
          reason: `✅ Hysteresis confirmed (${elapsedSeconds.toFixed(1)}s): ${reason}`,
          elapsedHysteresis: elapsedSeconds
        };
      } else {
        return {
          shouldExit: false,
          reason: `Waiting for hysteresis confirmation (${elapsedSeconds.toFixed(1)}/${exitInfo.hysteresisSeconds}s): ${reason}`,
          elapsedHysteresis: elapsedSeconds
        };
      }
    } else {
      // Reset timer if market fluctuation bounced out of the exit band
      if (exitInfo.exitSignalStartTime !== null) {
        exitInfo.exitSignalStartTime = null;
      }
      return { shouldExit: false, reason: 'Conditions within normal holding range' };
    }
  }

  /**
   * إلغاء الأمر المقابل في المنصة فور تنفيذ أحدهما (OCO Cleanup)
   */
  public async handleOrderFill(symbol: string, filledOrderId: string): Promise<void> {
    const exitInfo = this.activeExits.get(symbol);
    if (!exitInfo) return;

    console.log(`[HybridExitSystem] 🔔 Order fill reported for ${symbol} (ID: ${filledOrderId})`);

    // If Take-Profit filled -> cancel protective Stop-Loss
    if (filledOrderId === exitInfo.tpOrderId && exitInfo.slOrderId) {
      console.log(`[HybridExitSystem] 💰 Take-Profit executed! Canceling SL order ${exitInfo.slOrderId}...`);
      await this.executor.cancelOrder(exitInfo.slOrderId, symbol);
    }
    // If Stop-Loss filled -> cancel pending Take-Profit
    else if (filledOrderId === exitInfo.slOrderId && exitInfo.tpOrderId) {
      console.log(`[HybridExitSystem] 🛡️ Stop-Loss executed! Canceling pending TP order ${exitInfo.tpOrderId}...`);
      await this.executor.cancelOrder(exitInfo.tpOrderId, symbol);
    }

    this.activeExits.delete(symbol);
    this.stateDb.removePosition(symbol);
  }

  /**
   * إلغاء جميع أوامر الحماية المعلقة على المنصة عند إغلاق الصفقة مبكراً بالـ Z-Score
   */
  public async cancelExitOrders(symbol: string): Promise<void> {
    const exitInfo = this.activeExits.get(symbol);
    if (!exitInfo) return;

    if (exitInfo.slOrderId && !exitInfo.slOrderId.startsWith('SIM-')) {
      await this.executor.cancelOrder(exitInfo.slOrderId, symbol);
    }
    if (exitInfo.tpOrderId && !exitInfo.tpOrderId.startsWith('SIM-')) {
      await this.executor.cancelOrder(exitInfo.tpOrderId, symbol);
    }

    this.activeExits.delete(symbol);
    this.stateDb.removePosition(symbol);
    console.log(`[HybridExitSystem] 🧹 Cleaned up and canceled all exit orders for ${symbol}`);
  }

  public getActiveExits(): Record<string, ExitOrders> {
    const obj: Record<string, ExitOrders> = {};
    for (const [sym, ext] of this.activeExits.entries()) {
      obj[sym] = ext;
    }
    return obj;
  }

  public getExitStatus(symbol: string): ExitOrders | null {
    return this.activeExits.get(symbol) || null;
  }
}
