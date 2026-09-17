/**
 * OMEGA QuantBrain - Performance Metrics Calculator
 * ===================================================
 * حساب مقاييس الأداء بدقة مؤسسية
 * 
 * المقاييس المحسوبة:
 *   1. ✅ Sharpe Ratio (معدل العائد/المخاطرة)
 *   2. ✅ Sortino Ratio (يركز على المخاطرة السالبة فقط)
 *   3. ✅ Maximum Drawdown (أكبر خسارة من القمة)
 *   4. ✅ Profit Factor (نسبة الأرباح إلى الخسائر)
 *   5. ✅ Win Rate / Loss Rate
 *   6. ✅ Expectancy (القيمة المتوقعة لكل صفقة)
 *   7. ✅ Calmar Ratio (العائد / Max DD)
 *   8. ✅ Value at Risk (VaR)
 */

export interface BacktestTradeRecord {
  tradeId: string;
  timestamp: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  fees: number;
  fundingCost: number;
  netPnl: number;
  netPnlPct: number;
  duration: number;  // milliseconds
}

export interface PerformanceMetricsData {
  // العوائد
  totalReturn: number;
  totalReturnPct: number;
  annualizedReturn: number;
  annualizedReturnPct: number;
  
  // المخاطرة
  volatility: number;
  volatilityPct: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  var95: number;
  var99: number;
  
  // الصفقات
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  
  // الكفاءة
  profitFactor: number;
  expectancy: number;
  calmarRatio: number;
  avgTradeDuration: number;  // hours
  avgTradesPerDay: number;
  
  // التكاليف
  totalFees: number;
  totalFundingCost: number;
  costDragPct: number;  // نسبة التكاليف من إجمالي العائد
}

export class PerformanceMetrics {
  private riskFreeRate: number = 0.02;  // 2% معدل خالي من المخاطرة سنوياً
  private tradingDaysPerYear: number = 365;  // الكريبتو يعمل 24/7

  constructor(riskFreeRate: number = 0.02) {
    this.riskFreeRate = riskFreeRate;
  }

  /**
   * حساب جميع المقاييس من سجل الصفقات
   */
  calculate(trades: BacktestTradeRecord[], initialCapital: number): PerformanceMetricsData {
    if (trades.length === 0) {
      return this.emptyMetrics();
    }

    // ترتيب الصفقات حسب الوقت
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    // حساب سلسلة العوائد
    const returns = sortedTrades.map(t => t.netPnl);
    const returnPcts = sortedTrades.map(t => t.netPnlPct / 100);
    
    // العوائد الإجمالية
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const totalReturnPct = initialCapital > 0 ? (totalReturn / initialCapital) * 100 : 0;
    
    // العائد السنوي
    const firstTradeTime = sortedTrades[0].timestamp;
    const lastTradeTime = sortedTrades[sortedTrades.length - 1].timestamp;
    const yearsElapsed = Math.max((lastTradeTime - firstTradeTime) / (1000 * 60 * 60 * 24 * 365), 0.01);
    const annualizedReturn = initialCapital > 0 
      ? Math.pow(Math.max(1 + totalReturn / initialCapital, 0.0001), 1 / yearsElapsed) - 1 
      : 0;
    
    // التقلب (Volatility)
    const volatility = this.calculateVolatility(returnPcts);
    
    // Sharpe Ratio
    const sharpeRatio = this.calculateSharpeRatio(returnPcts);
    
    // Sortino Ratio
    const sortinoRatio = this.calculateSortinoRatio(returnPcts);
    
    // Maximum Drawdown
    const maxDrawdown = this.calculateMaxDrawdown(returns, initialCapital);
    
    // إحصائيات الصفقات
    const winningTrades = trades.filter(t => t.netPnl > 0);
    const losingTrades = trades.filter(t => t.netPnl <= 0);
    
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const lossRate = 100 - winRate;
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.netPnl, 0) / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0) / losingTrades.length) 
      : 0;
    
    const largestWin = winningTrades.length > 0 
      ? Math.max(...winningTrades.map(t => t.netPnl)) 
      : 0;
    
    const largestLoss = losingTrades.length > 0 
      ? Math.min(...losingTrades.map(t => t.netPnl)) 
      : 0;
    
    // Profit Factor
    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    
    // Expectancy
    const expectancy = trades.length > 0 ? totalReturn / trades.length : 0;
    
    // Calmar Ratio
    const calmarRatio = maxDrawdown > 0 ? (totalReturn / (initialCapital > 0 ? initialCapital : 1)) / maxDrawdown : 0;
    
    // متوسط مدة الصفقة
    const avgDuration = trades.length > 0 
      ? trades.reduce((sum, t) => sum + t.duration, 0) / trades.length 
      : 0;
    const avgTradeDurationHours = avgDuration / (1000 * 60 * 60);
    
    // متوسط الصفقات اليومية
    const daysElapsed = Math.max(yearsElapsed * 365, 1);
    const avgTradesPerDay = trades.length / daysElapsed;
    
    // التكاليف
    const totalFees = trades.reduce((sum, t) => sum + t.fees, 0);
    const totalFundingCost = trades.reduce((sum, t) => sum + t.fundingCost, 0);
    const totalCosts = totalFees + totalFundingCost;
    const costDragPct = totalReturn > 0 ? (totalCosts / (totalReturn + totalCosts)) * 100 : 0;
    
    // Value at Risk
    const var95 = this.calculateVaR(returnPcts, 0.05);
    const var99 = this.calculateVaR(returnPcts, 0.01);
    
    return {
      totalReturn: parseFloat(totalReturn.toFixed(2)),
      totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(4)),
      annualizedReturnPct: parseFloat((annualizedReturn * 100).toFixed(2)),
      volatility: parseFloat(volatility.toFixed(4)),
      volatilityPct: parseFloat((volatility * 100).toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: isFinite(sortinoRatio) ? parseFloat(sortinoRatio.toFixed(2)) : 999,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
      maxDrawdownPct: parseFloat((maxDrawdown * 100).toFixed(2)),
      var95: parseFloat((var95 * 100).toFixed(2)),
      var99: parseFloat((var99 * 100).toFixed(2)),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: parseFloat(winRate.toFixed(1)),
      lossRate: parseFloat(lossRate.toFixed(1)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      largestWin: parseFloat(largestWin.toFixed(2)),
      largestLoss: parseFloat(largestLoss.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      calmarRatio: parseFloat(calmarRatio.toFixed(2)),
      avgTradeDuration: parseFloat(avgTradeDurationHours.toFixed(2)),
      avgTradesPerDay: parseFloat(avgTradesPerDay.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      totalFundingCost: parseFloat(totalFundingCost.toFixed(2)),
      costDragPct: parseFloat(costDragPct.toFixed(2))
    };
  }

  /**
   * حساب التقلب (الانحراف المعياري للعوائد)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const dailyVolatility = Math.sqrt(variance);
    
    // تحويل إلى سنوي
    return dailyVolatility * Math.sqrt(this.tradingDaysPerYear);
  }

  /**
   * حساب Sharpe Ratio
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    if (volatility === 0) return 0;
    
    const dailyRiskFreeRate = this.riskFreeRate / this.tradingDaysPerYear;
    const excessReturn = meanReturn - dailyRiskFreeRate;
    const dailySharpe = excessReturn / volatility;
    
    return dailySharpe * Math.sqrt(this.tradingDaysPerYear);
  }

  /**
   * حساب Sortino Ratio (يركز على المخاطرة السالبة فقط)
   */
  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);
    
    if (downsideReturns.length === 0) return 999;
    
    const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);
    
    if (downsideDeviation === 0) return 0;
    
    const dailyRiskFreeRate = this.riskFreeRate / this.tradingDaysPerYear;
    const excessReturn = meanReturn - dailyRiskFreeRate;
    const dailySortino = excessReturn / downsideDeviation;
    
    return dailySortino * Math.sqrt(this.tradingDaysPerYear);
  }

  /**
   * حساب Maximum Drawdown
   */
  private calculateMaxDrawdown(returns: number[], initialCapital: number): number {
    let peak = initialCapital;
    let maxDd = 0;
    let currentEquity = initialCapital;
    
    for (const ret of returns) {
      currentEquity += ret;
      
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      
      const drawdown = peak > 0 ? (peak - currentEquity) / peak : 0;
      if (drawdown > maxDd) {
        maxDd = drawdown;
      }
    }
    
    return maxDd;
  }

  /**
   * حساب Value at Risk (VaR)
   */
  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length < 10) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor(confidenceLevel * sortedReturns.length);
    
    return sortedReturns[index] || 0;
  }

  /**
   * مقاييس فارغة
   */
  private emptyMetrics(): PerformanceMetricsData {
    return {
      totalReturn: 0,
      totalReturnPct: 0,
      annualizedReturn: 0,
      annualizedReturnPct: 0,
      volatility: 0,
      volatilityPct: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      var95: 0,
      var99: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      lossRate: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      calmarRatio: 0,
      avgTradeDuration: 0,
      avgTradesPerDay: 0,
      totalFees: 0,
      totalFundingCost: 0,
      costDragPct: 0
    };
  }
}
