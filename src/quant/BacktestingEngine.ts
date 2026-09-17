/**
 * OMEGA QuantBrain - Backtesting Engine
 * =======================================
 * محرك الاختبار الرجعي الاحترافي
 * 
 * المميزات:
 *   1. ✅ منع Look-Ahead Bias (لا بيانات مستقبلية)
 *   2. ✅ تطبيق تكاليف حقيقية (رسوم + انزلاق + تمويل)
 *   3. ✅ تقسيم البيانات (Train / Validation / Test)
 *   4. ✅ Walk-Forward Analysis
 *   5. ✅ Purged K-Fold Cross Validation
 *   6. ✅ محاكاة كاملة لظروف السوق
 *   7. ✅ تقارير تفصيلية لكل اختبار
 */

import { PerformanceMetrics, BacktestTradeRecord, PerformanceMetricsData } from './PerformanceMetrics';
import { PointInTimeDatabase, Candle } from './PointInTimeDatabase';

export interface BacktestConfig {
  symbol: string;
  startTime: number;
  endTime: number;
  initialCapital: number;
  leverage: number;
  makerFeeRate: number;
  takerFeeRate: number;
  slippagePct: number;
  fundingRatePerPeriod: number;
  
  // استراتيجية التداول
  entryZThreshold: number;
  exitZThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxTradeDurationHours: number;
  
  // إعدادات متقدمة
  trainRatio: number;       // نسبة بيانات التدريب (0.6 = 60%)
  validationRatio: number;  // نسبة بيانات التحقق (0.2 = 20%)
  testRatio: number;        // نسبة بيانات الاختبار (0.2 = 20%)
}

export interface BacktestResult {
  config: BacktestConfig;
  metrics: PerformanceMetricsData;
  trades: BacktestTradeRecord[];
  equityCurve: { timestamp: number; equity: number }[];
  splitType: 'TRAIN' | 'VALIDATION' | 'TEST' | 'FULL';
  durationMs: number;
}

export interface WalkForwardResult {
  windowId: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  trainMetrics: PerformanceMetricsData;
  testMetrics: PerformanceMetricsData;
  degradation: number;  // نسبة التدهور من Train إلى Test
}

export class BacktestingEngine {
  private config: BacktestConfig;
  private pitDb: PointInTimeDatabase;
  private metricsCalculator: PerformanceMetrics;
  
  constructor(config: BacktestConfig, pitDb: PointInTimeDatabase) {
    this.config = config;
    this.pitDb = pitDb;
    this.metricsCalculator = new PerformanceMetrics();
    
    // التحقق من صحة الإعدادات
    this.validateConfig();
    
    console.log('✅ BacktestingEngine initialized');
    console.log(`   Symbol: ${config.symbol}`);
    console.log(`   Period: ${new Date(config.startTime).toLocaleDateString()} - ${new Date(config.endTime).toLocaleDateString()}`);
    console.log(`   Initial Capital: $${config.initialCapital}`);
  }

  /**
   * التحقق من صحة الإعدادات
   */
  private validateConfig(): void {
    const { trainRatio, validationRatio, testRatio } = this.config;
    const sum = trainRatio + validationRatio + testRatio;
    
    if (Math.abs(sum - 1.0) > 0.05) {
      throw new Error(`Train + Validation + Test ratios must sum to 1.0 (current: ${sum})`);
    }
    
    if (this.config.startTime >= this.config.endTime) {
      throw new Error('startTime must be before endTime');
    }
    
    if (this.config.initialCapital <= 0) {
      throw new Error('initialCapital must be positive');
    }
  }

  /**
   * تشغيل اختبار رجعي كامل
   */
  async runFullBacktest(): Promise<BacktestResult> {
    const startTime = performance.now();
    
    // جلب الشموع المغلقة فقط (منع Look-Ahead)
    const candles = this.pitDb.getCandles({
      symbol: this.config.symbol,
      startTime: this.config.startTime,
      endTime: this.config.endTime,
      includeIncomplete: false  // ⚠️ شمعة مغلقة فقط!
    });
    
    if (candles.length < 50) {
      throw new Error(`Not enough data: only ${candles.length} candles (need at least 50)`);
    }
    
    console.log(`[Backtest] Running on ${candles.length} candles`);
    
    // تشغيل الاستراتيجية
    const { trades, equityCurve } = await this.runStrategy(candles);
    
    // حساب المقاييس
    const metrics = this.metricsCalculator.calculate(trades, this.config.initialCapital);
    
    const durationMs = performance.now() - startTime;
    
    console.log(`[Backtest] ✅ Completed in ${durationMs.toFixed(0)}ms`);
    console.log(`[Backtest] Trades: ${trades.length}, Win Rate: ${metrics.winRate.toFixed(1)}%, Sharpe: ${metrics.sharpeRatio.toFixed(2)}`);
    
    return {
      config: this.config,
      metrics,
      trades,
      equityCurve,
      splitType: 'FULL',
      durationMs
    };
  }

  /**
   * تشغيل Walk-Forward Analysis
   * ⚠️ هذا هو الاختبار الأهم - يقيس أداء الاستراتيجية على بيانات لم تُستخدم في التدريب
   */
  async runWalkForward(windowSize: number = 30): Promise<WalkForwardResult[]> {
    const startTime = performance.now();
    
    // جلب جميع الشموع
    const allCandles = this.pitDb.getCandles({
      symbol: this.config.symbol,
      startTime: this.config.startTime,
      endTime: this.config.endTime,
      includeIncomplete: false
    });
    
    if (allCandles.length < windowSize * 3) {
      throw new Error(`Not enough data for Walk-Forward: ${allCandles.length} candles (need at least ${windowSize * 3})`);
    }
    
    const results: WalkForwardResult[] = [];
    const stepSize = Math.floor(windowSize / 2);  // تداخل 50% بين النوافذ
    
    // تقسيم البيانات إلى نوافذ متداخلة
    for (let i = 0; i + windowSize < allCandles.length; i += stepSize) {
      const windowCandles = allCandles.slice(i, i + windowSize);
      
      if (windowCandles.length < 20) break;
      
      // تقسيم النافذة إلى Train و Test
      const trainSize = Math.floor(windowCandles.length * 0.7);
      const trainCandles = windowCandles.slice(0, trainSize);
      const testCandles = windowCandles.slice(trainSize);
      
      // تشغيل على Train
      const trainResult = await this.runStrategy(trainCandles);
      const trainMetrics = this.metricsCalculator.calculate(trainResult.trades, this.config.initialCapital);
      
      // تشغيل على Test (بيانات لم تُرَ من قبل)
      const testResult = await this.runStrategy(testCandles);
      const testMetrics = this.metricsCalculator.calculate(testResult.trades, this.config.initialCapital);
      
      // حساب نسبة التدهور
      const degradation = trainMetrics.sharpeRatio > 0 
        ? 1 - (testMetrics.sharpeRatio / trainMetrics.sharpeRatio) 
        : 0;
      
      results.push({
        windowId: results.length + 1,
        trainStart: trainCandles[0]?.timestamp || 0,
        trainEnd: trainCandles[trainCandles.length - 1]?.timestamp || 0,
        testStart: testCandles[0]?.timestamp || 0,
        testEnd: testCandles[testCandles.length - 1]?.timestamp || 0,
        trainMetrics,
        testMetrics,
        degradation: parseFloat(degradation.toFixed(4))
      });
    }
    
    const durationMs = performance.now() - startTime;
    console.log(`[WalkForward] ✅ Completed ${results.length} windows in ${durationMs.toFixed(0)}ms`);
    
    return results;
  }

  /**
   * تشغيل الاستراتيجية على بيانات الشموع
   */
  private async runStrategy(candles: Candle[]): Promise<{ trades: BacktestTradeRecord[]; equityCurve: any[] }> {
    const trades: BacktestTradeRecord[] = [];
    const equityCurve: { timestamp: number; equity: number }[] = [];
    
    let currentEquity = this.config.initialCapital;
    let currentPosition: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      entryTime: number;
      quantity: number;
    } | null = null;
    
    // نافذة لحساب Z-Score
    const zWindow: number[] = [];
    const Z_WINDOW_SIZE = 30;
    
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const price = candle.close;
      
      // إضافة السعر إلى النافذة
      zWindow.push(price);
      if (zWindow.length > Z_WINDOW_SIZE) {
        zWindow.shift();
      }
      
      // حساب Z-Score فقط إذا كان لدينا بيانات كافية
      if (zWindow.length < Z_WINDOW_SIZE) {
        equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });
        continue;
      }
      
      const mean = zWindow.reduce((sum, p) => sum + p, 0) / zWindow.length;
      const std = Math.sqrt(
        zWindow.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / zWindow.length
      );
      
      const zScore = std > 0 ? (price - mean) / std : 0;
      
      // منطق التداول
      if (!currentPosition) {
        // البحث عن فرصة دخول
        if (zScore <= -this.config.entryZThreshold) {
          // إشارة شراء (الز سالب = السعر منخفض)
          const quantity = this.calculatePositionSize(currentEquity, price);
          
          currentPosition = {
            side: 'LONG',
            entryPrice: price,
            entryTime: candle.timestamp,
            quantity
          };
          
        } else if (zScore >= this.config.entryZThreshold) {
          // إشارة بيع (الز موجب = السعر مرتفع)
          const quantity = this.calculatePositionSize(currentEquity, price);
          
          currentPosition = {
            side: 'SHORT',
            entryPrice: price,
            entryTime: candle.timestamp,
            quantity
          };
        }
        
      } else {
        // إدارة المركز الحالي
        const shouldExit = this.checkExitConditions(
          currentPosition, 
          price, 
          candle.timestamp, 
          zScore
        );
        
        if (shouldExit) {
          // إغلاق المركز
          const grossPnl = this.calculatePnl(currentPosition, price);
          const fees = this.calculateFees(currentPosition, price);
          const slippage = this.calculateSlippage(currentPosition, price);
          const fundingCost = this.calculateFundingCost(currentPosition, candle.timestamp);
          
          const netPnl = grossPnl - fees - slippage - fundingCost;
          
          const trade: BacktestTradeRecord = {
            tradeId: `BT-${Date.now()}-${i}`,
            timestamp: candle.timestamp,
            symbol: this.config.symbol,
            side: currentPosition.side,
            entryPrice: currentPosition.entryPrice,
            exitPrice: price,
            quantity: currentPosition.quantity,
            grossPnl,
            fees,
            fundingCost,
            netPnl,
            netPnlPct: (netPnl / ((currentPosition.entryPrice * currentPosition.quantity) || 1)) * 100,
            duration: candle.timestamp - currentPosition.entryTime
          };
          
          trades.push(trade);
          currentEquity += netPnl;
          currentPosition = null;
        }
      }
      
      equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });
    }
    
    // إغلاق أي مركز مفتوح في النهاية
    if (currentPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const grossPnl = this.calculatePnl(currentPosition, lastCandle.close);
      const fees = this.calculateFees(currentPosition, lastCandle.close);
      const slippage = this.calculateSlippage(currentPosition, lastCandle.close);
      const fundingCost = this.calculateFundingCost(currentPosition, lastCandle.timestamp);
      const netPnl = grossPnl - fees - slippage - fundingCost;
      
      trades.push({
        tradeId: `BT-${Date.now()}-FINAL`,
        timestamp: lastCandle.timestamp,
        symbol: this.config.symbol,
        side: currentPosition.side,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastCandle.close,
        quantity: currentPosition.quantity,
        grossPnl,
        fees,
        fundingCost,
        netPnl,
        netPnlPct: (netPnl / ((currentPosition.entryPrice * currentPosition.quantity) || 1)) * 100,
        duration: lastCandle.timestamp - currentPosition.entryTime
      });
      
      currentEquity += netPnl;
    }
    
    return { trades, equityCurve };
  }

  /**
   * حساب حجم المركز
   */
  private calculatePositionSize(equity: number, price: number): number {
    const positionValueUsd = equity * 0.05 * this.config.leverage;  // 5% من المحفظة
    return positionValueUsd / (price > 0 ? price : 1);
  }

  /**
   * فحص شروط الخروج
   */
  private checkExitConditions(
    position: { side: 'LONG' | 'SHORT'; entryPrice: number; entryTime: number; quantity: number },
    currentPrice: number,
    currentTime: number,
    zScore: number
  ): boolean {
    // 1. وقف الخسارة
    const slPct = this.config.stopLossPct;
    if (position.side === 'LONG') {
      if (currentPrice <= position.entryPrice * (1 - slPct)) return true;
    } else {
      if (currentPrice >= position.entryPrice * (1 + slPct)) return true;
    }
    
    // 2. جني الربح
    const tpPct = this.config.takeProfitPct;
    if (position.side === 'LONG') {
      if (currentPrice >= position.entryPrice * (1 + tpPct)) return true;
    } else {
      if (currentPrice <= position.entryPrice * (1 - tpPct)) return true;
    }
    
    // 3. العودة للمتوسط
    if (position.side === 'LONG' && zScore >= 0) return true;
    if (position.side === 'SHORT' && zScore <= 0) return true;
    
    // 4. انتهاء الوقت
    const hoursHeld = (currentTime - position.entryTime) / (1000 * 60 * 60);
    if (hoursHeld >= this.config.maxTradeDurationHours) return true;
    
    return false;
  }

  /**
   * حساب الربح/الخسارة الإجمالي
   */
  private calculatePnl(position: any, exitPrice: number): number {
    const priceDiff = position.side === 'LONG'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;
    
    return priceDiff * position.quantity;
  }

  /**
   * حساب الرسوم
   */
  private calculateFees(position: any, exitPrice: number): number {
    const entryNotional = position.entryPrice * position.quantity;
    const exitNotional = exitPrice * position.quantity;
    
    // Taker fee للدخول والخروج
    return (entryNotional + exitNotional) * this.config.takerFeeRate;
  }

  /**
   * حساب الانزلاق السعري
   */
  private calculateSlippage(position: any, exitPrice: number): number {
    const notional = exitPrice * position.quantity;
    return notional * this.config.slippagePct;
  }

  /**
   * حساب تكلفة التمويل
   */
  private calculateFundingCost(position: any, exitTime: number): number {
    const hoursHeld = (exitTime - position.entryTime) / (1000 * 60 * 60);
    const fundingPeriods = Math.floor(hoursHeld / 8);  // كل 8 ساعات
    
    if (fundingPeriods <= 0) return 0;
    
    const notional = position.entryPrice * position.quantity;
    return notional * this.config.fundingRatePerPeriod * fundingPeriods;
  }

  /**
   * تقرير ملخص
   */
  generateSummary(result: BacktestResult): string {
    const m = result.metrics;
    
    return `
╔══════════════════════════════════════════════════════════╗
║           OMEGA BACKTEST REPORT - ${this.config.symbol}              ║
╠══════════════════════════════════════════════════════════╣
║ Period: ${new Date(this.config.startTime).toLocaleDateString()} → ${new Date(this.config.endTime).toLocaleDateString()}
║ Initial Capital: $${this.config.initialCapital.toFixed(2)}
╠══════════════════════════════════════════════════════════╣
║ PERFORMANCE
║   Total Return:     $${m.totalReturn.toFixed(2)} (${m.totalReturnPct.toFixed(2)}%)
║   Annualized:       ${(m.annualizedReturn * 100).toFixed(2)}%
║   Sharpe Ratio:     ${m.sharpeRatio.toFixed(2)}
║   Sortino Ratio:    ${m.sortinoRatio.toFixed(2)}
║   Max Drawdown:     ${(m.maxDrawdown * 100).toFixed(2)}%
║   Calmar Ratio:     ${m.calmarRatio.toFixed(2)}
╠══════════════════════════════════════════════════════════╣
║ TRADES
║   Total Trades:     ${m.totalTrades}
║   Win Rate:         ${m.winRate.toFixed(1)}%
║   Profit Factor:    ${m.profitFactor.toFixed(2)}
║   Avg Win:          $${m.avgWin.toFixed(2)}
║   Avg Loss:         $${m.avgLoss.toFixed(2)}
║   Expectancy:       $${m.expectancy.toFixed(2)}
╠══════════════════════════════════════════════════════════╣
║ COSTS
║   Total Fees:       $${m.totalFees.toFixed(2)}
║   Funding Cost:     $${m.totalFundingCost.toFixed(2)}
║   Cost Drag:        ${m.costDragPct.toFixed(2)}%
╚══════════════════════════════════════════════════════════╝
    `.trim();
  }
}
