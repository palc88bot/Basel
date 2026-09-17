/**
 * OMEGA QuantBrain - Champion/Challenger Framework
 * ==================================================
 * مقارنة استراتيجيتين معاً على بيانات حية وتاريخية
 * 
 * المميزات:
 *   1. ✅ تشغيل استراتيجيتين بالتوازي (A/B Testing)
 *   2. ✅ مقارنة الأداء والمخاطر لحظياً
 *   3. ✅ ترقية تلقائية أو اقتراح تبديل للأفضل
 *   4. ✅ سجل مقارنات مفصل
 *   5. ✅ حساب درجات الثقة والمقاييس الإحصائية
 */

import { PerformanceMetrics, BacktestTradeRecord } from './PerformanceMetrics';

export interface StrategyConfig {
  name: string;
  entryZThreshold: number;
  exitZThreshold: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxTradeDurationHours: number;
  positionSizePct: number;
}

export interface StrategyResult {
  strategyName: string;
  trades: BacktestTradeRecord[];
  metrics: any;
  equityCurve: { timestamp: number; equity: number }[];
  isChampion: boolean;
}

export interface ComparisonResult {
  timestamp: number;
  championName: string;
  challengerName: string;
  championMetrics: any;
  challengerMetrics: any;
  
  // النتائج
  sharpeDiff: number;
  winRateDiff: number;
  returnDiff: number;
  maxDrawdownDiff: number;
  
  // القرار
  winner: 'CHAMPION' | 'CHALLENGER' | 'TIE';
  confidence: number;  // 0 إلى 1
  recommendation: string;
}

export class ChampionChallenger {
  private championConfig: StrategyConfig;
  private challengerConfig: StrategyConfig;
  private metricsCalculator: PerformanceMetrics;
  private comparisonHistory: ComparisonResult[] = [];
  
  constructor(
    championConfig: StrategyConfig,
    challengerConfig: StrategyConfig
  ) {
    this.championConfig = championConfig;
    this.challengerConfig = challengerConfig;
    this.metricsCalculator = new PerformanceMetrics();
    
    console.log('✅ ChampionChallenger initialized');
    console.log(`   Champion: ${championConfig.name}`);
    console.log(`   Challenger: ${challengerConfig.name}`);
  }

  /**
   * مقارنة الاستراتيجيتين على بيانات تاريخية
   */
  async compare(
    candles: any[], 
    initialCapital: number = 1000
  ): Promise<ComparisonResult> {
    console.log('[ChampionChallenger] Starting comparison...');
    
    // تشغيل الاستراتيجية الأولى (Champion)
    const championResult = await this.runStrategy(this.championConfig, candles, initialCapital);
    
    // تشغيل الاستراتيجية الثانية (Challenger)
    const challengerResult = await this.runStrategy(this.challengerConfig, candles, initialCapital);
    
    // حساب الفروق
    const sharpeDiff = challengerResult.metrics.sharpeRatio - championResult.metrics.sharpeRatio;
    const winRateDiff = challengerResult.metrics.winRate - championResult.metrics.winRate;
    const returnDiff = challengerResult.metrics.totalReturn - championResult.metrics.totalReturn;
    const maxDrawdownDiff = championResult.metrics.maxDrawdown - challengerResult.metrics.maxDrawdown;
    
    // تحديد الفائز
    let winner: 'CHAMPION' | 'CHALLENGER' | 'TIE' = 'TIE';
    let confidence = 0;
    
    // حساب درجة التفوق
    const championScore = this.calculateScore(championResult.metrics);
    const challengerScore = this.calculateScore(challengerResult.metrics);
    
    if (Math.abs(championScore - challengerScore) < 0.1) {
      winner = 'TIE';
      confidence = 0.3;
    } else if (championScore > challengerScore) {
      winner = 'CHAMPION';
      confidence = Math.min(Math.abs(championScore - challengerScore), 1);
    } else {
      winner = 'CHALLENGER';
      confidence = Math.min(Math.abs(challengerScore - championScore), 1);
    }
    
    // توليد التوصية
    const recommendation = this.generateRecommendation(winner, confidence, championResult, challengerResult);
    
    const result: ComparisonResult = {
      timestamp: Date.now(),
      championName: this.championConfig.name,
      challengerName: this.challengerConfig.name,
      championMetrics: championResult.metrics,
      challengerMetrics: challengerResult.metrics,
      sharpeDiff,
      winRateDiff,
      returnDiff,
      maxDrawdownDiff,
      winner,
      confidence,
      recommendation
    };
    
    this.comparisonHistory.push(result);
    
    console.log(`[ChampionChallenger] Winner: ${winner} (confidence: ${(confidence * 100).toFixed(1)}%)`);
    
    return result;
  }

  /**
   * تشغيل استراتيجية واحدة
   */
  private async runStrategy(
    config: StrategyConfig, 
    candles: any[], 
    initialCapital: number
  ): Promise<StrategyResult> {
    const trades: BacktestTradeRecord[] = [];
    const equityCurve: { timestamp: number; equity: number }[] = [];
    
    let currentEquity = initialCapital;
    let currentPosition: any = null;
    
    const zWindow: number[] = [];
    const Z_WINDOW_SIZE = 30;
    
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const price = candle.close;
      
      zWindow.push(price);
      if (zWindow.length > Z_WINDOW_SIZE) zWindow.shift();
      
      if (zWindow.length < Z_WINDOW_SIZE) {
        equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });
        continue;
      }
      
      const mean = zWindow.reduce((sum, p) => sum + p, 0) / zWindow.length;
      const std = Math.sqrt(
        zWindow.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / zWindow.length
      );
      
      const zScore = std > 0 ? (price - mean) / std : 0;
      
      if (!currentPosition) {
        // دخول
        if (zScore <= -config.entryZThreshold) {
          const quantity = (currentEquity * config.positionSizePct) / price;
          currentPosition = {
            side: 'LONG',
            entryPrice: price,
            entryTime: candle.timestamp,
            quantity
          };
        } else if (zScore >= config.entryZThreshold) {
          const quantity = (currentEquity * config.positionSizePct) / price;
          currentPosition = {
            side: 'SHORT',
            entryPrice: price,
            entryTime: candle.timestamp,
            quantity
          };
        }
      } else {
        // فحص الخروج
        const shouldExit = this.checkExit(config, currentPosition, price, candle.timestamp, zScore);
        
        if (shouldExit) {
          const grossPnl = this.calculatePnl(currentPosition, price);
          const fees = (currentPosition.entryPrice * currentPosition.quantity + price * currentPosition.quantity) * 0.00055;
          const netPnl = grossPnl - fees;
          
          trades.push({
            tradeId: `${config.name}-${i}`,
            timestamp: candle.timestamp,
            symbol: 'BTCUSDT',
            side: currentPosition.side,
            entryPrice: currentPosition.entryPrice,
            exitPrice: price,
            quantity: currentPosition.quantity,
            grossPnl,
            fees,
            fundingCost: 0,
            netPnl,
            netPnlPct: (netPnl / (currentPosition.entryPrice * currentPosition.quantity)) * 100,
            duration: candle.timestamp - currentPosition.entryTime
          });
          
          currentEquity += netPnl;
          currentPosition = null;
        }
      }
      
      equityCurve.push({ timestamp: candle.timestamp, equity: currentEquity });
    }
    
    // حساب المقاييس
    const metrics = this.metricsCalculator.calculate(trades, initialCapital);
    
    return {
      strategyName: config.name,
      trades,
      metrics,
      equityCurve,
      isChampion: config.name === this.championConfig.name
    };
  }

  /**
   * فحص شروط الخروج
   */
  private checkExit(
    config: StrategyConfig,
    position: any,
    currentPrice: number,
    currentTime: number,
    zScore: number
  ): boolean {
    // وقف الخسارة
    if (position.side === 'LONG') {
      if (currentPrice <= position.entryPrice * (1 - config.stopLossPct)) return true;
    } else {
      if (currentPrice >= position.entryPrice * (1 + config.stopLossPct)) return true;
    }
    
    // جني الربح
    if (position.side === 'LONG') {
      if (currentPrice >= position.entryPrice * (1 + config.takeProfitPct)) return true;
    } else {
      if (currentPrice <= position.entryPrice * (1 - config.takeProfitPct)) return true;
    }
    
    // العودة للمتوسط
    if (position.side === 'LONG' && zScore >= config.exitZThreshold) return true;
    if (position.side === 'SHORT' && zScore <= -config.exitZThreshold) return true;
    
    // انتهاء الوقت
    const hoursHeld = (currentTime - position.entryTime) / (1000 * 60 * 60);
    if (hoursHeld >= config.maxTradeDurationHours) return true;
    
    return false;
  }

  /**
   * حساب الربح/الخسارة
   */
  private calculatePnl(position: any, exitPrice: number): number {
    const priceDiff = position.side === 'LONG'
      ? exitPrice - position.entryPrice
      : position.entryPrice - exitPrice;
    
    return priceDiff * position.quantity;
  }

  /**
   * حساب درجة الاستراتيجية (0 إلى 10)
   */
  private calculateScore(metrics: any): number {
    let score = 0;
    
    // Sharpe (وزن 30%)
    score += Math.min(metrics.sharpeRatio / 3, 1) * 30;
    
    // Win Rate (وزن 20%)
    score += (metrics.winRate / 100) * 20;
    
    // Profit Factor (وزن 20%)
    score += Math.min(metrics.profitFactor / 2, 1) * 20;
    
    // Max Drawdown (وزن 20% - عكسي)
    score += Math.max(0, 1 - metrics.maxDrawdown / 0.3) * 20;
    
    // Expectancy (وزن 10%)
    score += metrics.expectancy > 0 ? 10 : 0;
    
    return score;
  }

  /**
   * توليد التوصية
   */
  private generateRecommendation(
    winner: 'CHAMPION' | 'CHALLENGER' | 'TIE',
    confidence: number,
    championResult: StrategyResult,
    challengerResult: StrategyResult
  ): string {
    if (winner === 'TIE') {
      return 'لا يوجد فرق معنوي بين الاستراتيجيتين. استمر بالمراقبة.';
    }
    
    const winnerName = winner === 'CHAMPION' ? this.championConfig.name : this.challengerConfig.name;
    const confidencePct = (confidence * 100).toFixed(1);
    
    if (confidence < 0.5) {
      return `${winnerName} يتفوق بفارق بسيط (ثقة ${confidencePct}%). يُنصح بمزيد من الاختبار قبل التبديل.`;
    }
    
    if (confidence < 0.8) {
      return `${winnerName} يتفوق بوضوح (ثقة ${confidencePct}%). يمكن النظر في التبديل بعد مزيد من التحقق.`;
    }
    
    return `${winnerName} يتفوق بشكل كبير (ثقة ${confidencePct}%). يُنصح بالتبديل الفوري.`;
  }

  // ==================== Getters ====================

  getComparisonHistory(limit: number = 10): ComparisonResult[] {
    return this.comparisonHistory.slice(-limit);
  }

  getChampionConfig(): StrategyConfig {
    return { ...this.championConfig };
  }

  getChallengerConfig(): StrategyConfig {
    return { ...this.challengerConfig };
  }
}
