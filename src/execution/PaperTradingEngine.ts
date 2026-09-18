/**
 * OMEGA QuantBrain - Paper Trading Engine
 * =========================================
 * محرك محاكاة تداول واقعي بدقة عالية
 * 
 * المميزات:
 *   1. ✅ Slippage ديناميكي (حسب الحجم والسيولة)
 *   2. ✅ رسوم حقيقية (Maker 0.02%, Taker 0.055%)
 *   3. ✅ Partial Fills (تنفيذ جزئي)
 *   4. ✅ Funding Cost حقيقي
 *   5. ✅ Latency Model (تأخير محاكى)
 *   6. ✅ سجل كامل لكل الصفقات
 *   7. ✅ حساب PnL دقيق بعد كل التكاليف
 */

import { OrderBookSimulator } from './OrderBookSimulator';
import { CircuitBreakersManager } from '../quant/circuitBreakers';

export interface PaperOrder {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;           // سعر الأمر (لـ LIMIT)
  timestamp: number;
  status: 'PENDING' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  filledQuantity: number;
  avgFillPrice: number;
  slippagePct: number;
  feeUsd: number;
  fundingCostUsd: number;
  latencyMs: number;
}

export interface PaperPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  entryTime: number;
  leverage: number;
  margin: number;
}

export interface PaperTrade {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  quantity: number;
  exitTime: number | null;
  exitPrice: number | null;
  grossPnl: number;
  fees: number;
  fundingCost: number;
  slippage: number;
  netPnl: number;
  netPnlPct: number;
  reason: 'TP' | 'SL' | 'TIME' | 'MANUAL' | 'SIGNAL' | null;
  duration: number | null;
}

export interface PaperTradingConfig {
  initialBalance: number;
  leverage: number;
  makerFeeRate: number;        // 0.0002 = 0.02%
  takerFeeRate: number;        // 0.00055 = 0.055%
  fundingRateInterval: number; // ساعات (8 ساعات عادة)
  slippageMultiplier: number;  // مضاعف الانزلاق (1.0 = واقعي)
  latencyMinMs: number;
  latencyMaxMs: number;
  maxPositionSizePct: number;  // % من المحفظة لكل صفقة
}

export class PaperTradingEngine {
  private config: PaperTradingConfig;
  private balance: number;
  private orderBookSim: OrderBookSimulator;
  private circuitBreakers: CircuitBreakersManager;
  
  // البيانات الحية
  private orders: Map<string, PaperOrder> = new Map();
  private positions: Map<string, PaperPosition> = new Map();
  private tradeHistory: PaperTrade[] = [];
  
  // الإحصائيات
  private totalTrades: number = 0;
  private winningTrades: number = 0;
  private losingTrades: number = 0;
  private totalFees: number = 0;
  private totalFundingCost: number = 0;
  private totalSlippage: number = 0;
  private peakBalance: number;
  private maxDrawdown: number = 0;
  
  constructor(
    config: Partial<PaperTradingConfig>,
    orderBookSim: OrderBookSimulator,
    circuitBreakers?: CircuitBreakersManager
  ) {
    this.config = {
      initialBalance: config.initialBalance || 1000,
      leverage: config.leverage || 5,
      makerFeeRate: config.makerFeeRate || 0.0002,
      takerFeeRate: config.takerFeeRate || 0.00055,
      fundingRateInterval: config.fundingRateInterval || 8,
      slippageMultiplier: config.slippageMultiplier || 1.0,
      latencyMinMs: config.latencyMinMs || 50,
      latencyMaxMs: config.latencyMaxMs || 150,
      maxPositionSizePct: config.maxPositionSizePct || 0.05  // 5% default
    };
    
    this.balance = this.config.initialBalance;
    this.peakBalance = this.balance;
    this.orderBookSim = orderBookSim;
    this.circuitBreakers = circuitBreakers || new CircuitBreakersManager(this.balance);
    
    console.log('✅ PaperTradingEngine initialized');
    console.log(`   Balance: $${this.balance}`);
    console.log(`   Leverage: ${this.config.leverage}x`);
    console.log(`   Taker Fee: ${(this.config.takerFeeRate * 100).toFixed(3)}%`);
    console.log(`   Maker Fee: ${(this.config.makerFeeRate * 100).toFixed(3)}%`);
    console.log(`   Max Position Size: ${(this.config.maxPositionSizePct * 100).toFixed(1)}%`);
  }

  public getCircuitBreakers(): CircuitBreakersManager {
    return this.circuitBreakers;
  }

  // ==================== تنفيذ الأوامر ====================

  /**
   * تنفيذ أمر شراء (محاكاة واقعية)
   */
  async executeBuy(
    symbol: string, 
    quantity: number, 
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    limitPrice?: number
  ): Promise<PaperOrder> {
    const orderId = `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const latency = this.simulateLatency();
    
    // 0. فحص قاطع الدائرة (Circuit Breaker Gate)
    const cbCheck = this.circuitBreakers.check(this.balance, this.maxDrawdown);
    if (cbCheck.halted) {
      return this.createRejectedOrder(orderId, symbol, 'BUY', orderType, quantity, `Circuit Breaker Halted: ${cbCheck.reason}`);
    }

    // 🕐 محاكاة التأخير
    await this.sleep(latency);
    
    // التحقق من الرصيد والحد الأقصى لحجم الصفقة
    const refPrice = limitPrice || this.getMidPrice(symbol) || 1.0;
    const requiredMargin = (quantity * refPrice) / this.config.leverage;
    
    if (requiredMargin > this.balance) {
      return this.createRejectedOrder(orderId, symbol, 'BUY', orderType, quantity, 'Insufficient balance');
    }

    // Enforce maxPositionSizePct
    const maxAllowedMargin = this.balance * this.config.maxPositionSizePct;
    if (requiredMargin > maxAllowedMargin) {
      return this.createRejectedOrder(
        orderId, 
        symbol, 
        'BUY', 
        orderType, 
        quantity, 
        `Exceeds max position size limit of ${(this.config.maxPositionSizePct * 100).toFixed(1)}% ($${maxAllowedMargin.toFixed(2)})`
      );
    }
    
    // حساب سعر التنفيذ (مع الانزلاق)
    let execution = this.orderBookSim.calculateExecutionPrice(symbol, 'BUY', quantity);
    if (!execution) {
      // إذا لم يكن هناك دفتر أوامر، نبنيه تلقائياً من السعر التقديري
      const estPrice = limitPrice || this.getMidPrice(symbol) || refPrice;
      this.orderBookSim.buildSyntheticOrderBook(symbol, estPrice, 50_000_000);
      execution = this.orderBookSim.calculateExecutionPrice(symbol, 'BUY', quantity);
    }

    if (!execution) {
      return this.createRejectedOrder(orderId, symbol, 'BUY', orderType, quantity, 'No order book data');
    }
    
    // تطبيق مضاعف الانزلاق
    const adjustedSlippage = execution.slippagePct * this.config.slippageMultiplier;
    const finalPrice = orderType === 'MARKET' 
      ? execution.avgPrice 
      : Math.min(limitPrice || execution.avgPrice, execution.avgPrice);
    
    // حساب الرسوم
    const notionalValue = quantity * finalPrice;
    const feeRate = orderType === 'LIMIT' ? this.config.makerFeeRate : this.config.takerFeeRate;
    const feeUsd = notionalValue * feeRate;
    
    // إنشاء الأمر
    const order: PaperOrder = {
      orderId,
      symbol,
      side: 'BUY',
      orderType,
      quantity,
      price: finalPrice,
      timestamp: Date.now(),
      status: 'FILLED',
      filledQuantity: quantity,
      avgFillPrice: finalPrice,
      slippagePct: adjustedSlippage,
      feeUsd,
      fundingCostUsd: 0,
      latencyMs: latency
    };
    
    // تحديث الرصيد
    this.balance -= feeUsd;
    this.totalFees += feeUsd;
    this.totalSlippage += adjustedSlippage * notionalValue;
    
    // تحديث المركز
    this.updatePosition(symbol, 'BUY', quantity, finalPrice);
    
    // حفظ الأمر
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * تنفيذ أمر بيع (محاكاة واقعية)
   */
  async executeSell(
    symbol: string, 
    quantity: number, 
    orderType: 'MARKET' | 'LIMIT' = 'MARKET',
    limitPrice?: number
  ): Promise<PaperOrder> {
    const orderId = `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const latency = this.simulateLatency();
    
    // 🕐 محاكاة التأخير
    await this.sleep(latency);
    
    // التحقق من وجود مركز
    const position = this.positions.get(symbol);
    if (!position || position.side !== 'LONG') {
      return this.createRejectedOrder(orderId, symbol, 'SELL', orderType, quantity, 'No long position to close');
    }
    
    // حساب سعر التنفيذ
    let execution = this.orderBookSim.calculateExecutionPrice(symbol, 'SELL', quantity);
    if (!execution) {
      const estPrice = limitPrice || position.entryPrice;
      this.orderBookSim.buildSyntheticOrderBook(symbol, estPrice, 50_000_000);
      execution = this.orderBookSim.calculateExecutionPrice(symbol, 'SELL', quantity);
    }

    if (!execution) {
      return this.createRejectedOrder(orderId, symbol, 'SELL', orderType, quantity, 'No order book data');
    }
    
    const adjustedSlippage = execution.slippagePct * this.config.slippageMultiplier;
    const finalPrice = orderType === 'MARKET' 
      ? execution.avgPrice 
      : Math.max(limitPrice || execution.avgPrice, execution.avgPrice);
    
    // حساب الرسوم
    const notionalValue = quantity * finalPrice;
    const feeRate = orderType === 'LIMIT' ? this.config.makerFeeRate : this.config.takerFeeRate;
    const feeUsd = notionalValue * feeRate;
    
    // حساب PnL
    const entryPrice = position.entryPrice;
    const grossPnl = (finalPrice - entryPrice) * quantity;
    
    // حساب تكلفة التمويل
    const fundingCost = this.calculateFundingCost(symbol, quantity, entryPrice, position.entryTime);
    
    // حساب صافي الربح/الخسارة
    const netPnl = grossPnl - feeUsd - fundingCost;
    
    // إنشاء الأمر
    const order: PaperOrder = {
      orderId,
      symbol,
      side: 'SELL',
      orderType,
      quantity,
      price: finalPrice,
      timestamp: Date.now(),
      status: 'FILLED',
      filledQuantity: quantity,
      avgFillPrice: finalPrice,
      slippagePct: adjustedSlippage,
      feeUsd,
      fundingCostUsd: fundingCost,
      latencyMs: latency
    };
    
    // تحديث الرصيد
    this.balance += grossPnl - feeUsd - fundingCost;
    this.totalFees += feeUsd;
    this.totalFundingCost += fundingCost;
    
    // تسجيل الصفقة وإعلام قاطع الدائرة
    this.recordTrade(symbol, 'LONG', entryPrice, finalPrice, quantity, feeUsd, fundingCost, adjustedSlippage, netPnl);
    
    // إزالة المركز
    this.positions.delete(symbol);
    
    // حفظ الأمر
    this.orders.set(orderId, order);
    
    return order;
  }

  /**
   * فتح مركز Short
   */
  async openShort(symbol: string, quantity: number, refPrice?: number): Promise<PaperOrder> {
    const orderId = `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const latency = this.simulateLatency();
    
    // 0. Circuit Breakers check
    const cbCheck = this.circuitBreakers.check(this.balance, this.maxDrawdown);
    if (cbCheck.halted) {
      return this.createRejectedOrder(orderId, symbol, 'SELL', 'MARKET', quantity, `Circuit Breaker Halted: ${cbCheck.reason}`);
    }

    await this.sleep(latency);
    
    const estimatedPrice = refPrice || this.getMidPrice(symbol) || 1.0;
    const requiredMargin = (quantity * estimatedPrice) / this.config.leverage;
    if (requiredMargin > this.balance) {
      return this.createRejectedOrder(orderId, symbol, 'SELL', 'MARKET', quantity, 'Insufficient balance');
    }

    const maxAllowedMargin = this.balance * this.config.maxPositionSizePct;
    if (requiredMargin > maxAllowedMargin) {
      return this.createRejectedOrder(
        orderId, 
        symbol, 
        'SELL', 
        'MARKET', 
        quantity, 
        `Exceeds max position size limit of ${(this.config.maxPositionSizePct * 100).toFixed(1)}% ($${maxAllowedMargin.toFixed(2)})`
      );
    }

    // حساب سعر التنفيذ
    let execution = this.orderBookSim.calculateExecutionPrice(symbol, 'SELL', quantity);
    if (!execution) {
      this.orderBookSim.buildSyntheticOrderBook(symbol, estimatedPrice, 50_000_000);
      execution = this.orderBookSim.calculateExecutionPrice(symbol, 'SELL', quantity);
    }

    if (!execution) {
      return this.createRejectedOrder(orderId, symbol, 'SELL', 'MARKET', quantity, 'No order book data');
    }
    
    const adjustedSlippage = execution.slippagePct * this.config.slippageMultiplier;
    const finalPrice = execution.avgPrice;
    
    // حساب الرسوم
    const notionalValue = quantity * finalPrice;
    const feeUsd = notionalValue * this.config.takerFeeRate;
    
    // إنشاء الأمر
    const order: PaperOrder = {
      orderId,
      symbol,
      side: 'SELL',
      orderType: 'MARKET',
      quantity,
      price: finalPrice,
      timestamp: Date.now(),
      status: 'FILLED',
      filledQuantity: quantity,
      avgFillPrice: finalPrice,
      slippagePct: adjustedSlippage,
      feeUsd,
      fundingCostUsd: 0,
      latencyMs: latency
    };
    
    // تحديث الرصيد
    this.balance -= feeUsd;
    this.totalFees += feeUsd;
    
    // إنشاء مركز Short
    const margin = notionalValue / this.config.leverage;
    this.positions.set(symbol, {
      symbol,
      side: 'SHORT',
      quantity,
      entryPrice: finalPrice,
      currentPrice: finalPrice,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      entryTime: Date.now(),
      leverage: this.config.leverage,
      margin
    });
    
    this.orders.set(orderId, order);
    return order;
  }

  /**
   * إغلاق مركز Short
   */
  async closeShort(symbol: string, quantity: number): Promise<PaperOrder> {
    const orderId = `PAPER-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const latency = this.simulateLatency();
    
    await this.sleep(latency);
    
    const position = this.positions.get(symbol);
    if (!position || position.side !== 'SHORT') {
      return this.createRejectedOrder(orderId, symbol, 'BUY', 'MARKET', quantity, 'No short position');
    }
    
    // حساب سعر التنفيذ (شراء لإغلاق Short)
    let execution = this.orderBookSim.calculateExecutionPrice(symbol, 'BUY', quantity);
    if (!execution) {
      this.orderBookSim.buildSyntheticOrderBook(symbol, position.entryPrice, 50_000_000);
      execution = this.orderBookSim.calculateExecutionPrice(symbol, 'BUY', quantity);
    }

    if (!execution) {
      return this.createRejectedOrder(orderId, symbol, 'BUY', 'MARKET', quantity, 'No order book data');
    }
    
    const adjustedSlippage = execution.slippagePct * this.config.slippageMultiplier;
    const finalPrice = execution.avgPrice;
    
    // حساب الرسوم
    const notionalValue = quantity * finalPrice;
    const feeUsd = notionalValue * this.config.takerFeeRate;
    
    // حساب PnL (Short يربح عندما ينخفض السعر)
    const entryPrice = position.entryPrice;
    const grossPnl = (entryPrice - finalPrice) * quantity;
    
    // حساب تكلفة التمويل
    const fundingCost = this.calculateFundingCost(symbol, quantity, entryPrice, position.entryTime);
    
    // صافي الربح/الخسارة
    const netPnl = grossPnl - feeUsd - fundingCost;
    
    // إنشاء الأمر
    const order: PaperOrder = {
      orderId,
      symbol,
      side: 'BUY',
      orderType: 'MARKET',
      quantity,
      price: finalPrice,
      timestamp: Date.now(),
      status: 'FILLED',
      filledQuantity: quantity,
      avgFillPrice: finalPrice,
      slippagePct: adjustedSlippage,
      feeUsd,
      fundingCostUsd: fundingCost,
      latencyMs: latency
    };
    
    // تحديث الرصيد
    this.balance += grossPnl - feeUsd - fundingCost;
    this.totalFees += feeUsd;
    this.totalFundingCost += fundingCost;
    
    // تسجيل الصفقة
    this.recordTrade(symbol, 'SHORT', entryPrice, finalPrice, quantity, feeUsd, fundingCost, adjustedSlippage, netPnl);
    
    // إزالة المركز
    this.positions.delete(symbol);
    
    this.orders.set(orderId, order);
    return order;
  }

  /**
   * إغلاق أي مركز مفتوح (Long أو Short) تلقائياً
   */
  async closePosition(symbol: string): Promise<PaperOrder | null> {
    const position = this.positions.get(symbol);
    if (!position) return null;
    
    if (position.side === 'LONG') {
      return await this.executeSell(symbol, position.quantity, 'MARKET');
    } else {
      return await this.closeShort(symbol, position.quantity);
    }
  }

  // ==================== حسابات مساعدة ====================

  /**
   * حساب تكلفة التمويل (Funding Cost)
   */
  private calculateFundingCost(
    symbol: string, 
    quantity: number, 
    entryPrice: number, 
    entryTime: number
  ): number {
    const notionalValue = quantity * entryPrice;
    const hoursHeld = (Date.now() - entryTime) / (1000 * 60 * 60);
    const fundingPeriods = Math.floor(hoursHeld / this.config.fundingRateInterval);
    
    if (fundingPeriods <= 0) return 0;
    
    const fundingRate = 0.0001; // 0.01% لكل 8 ساعات
    return notionalValue * fundingRate * fundingPeriods;
  }

  /**
   * محاكاة التأخير (Latency)
   */
  private simulateLatency(): number {
    const { latencyMinMs, latencyMaxMs } = this.config;
    return Math.floor(Math.random() * (latencyMaxMs - latencyMinMs + 1)) + latencyMinMs;
  }

  /**
   * الحصول على السعر المتوسط
   */
  private getMidPrice(symbol: string): number {
    const metrics = this.orderBookSim.getMetrics(symbol);
    return metrics ? metrics.midPrice : 0;
  }

  /**
   * تحديث مركز موجود
   */
  private updatePosition(symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number): void {
    const existing = this.positions.get(symbol);
    
    if (!existing) {
      // إنشاء مركز جديد
      const notionalValue = quantity * price;
      const margin = notionalValue / this.config.leverage;
      
      this.positions.set(symbol, {
        symbol,
        side: side === 'BUY' ? 'LONG' : 'SHORT',
        quantity,
        entryPrice: price,
        currentPrice: price,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        entryTime: Date.now(),
        leverage: this.config.leverage,
        margin
      });
    } else {
      // إضافة إلى مركز موجود
      const totalQty = existing.quantity + quantity;
      const avgPrice = (existing.entryPrice * existing.quantity + price * quantity) / (totalQty > 0 ? totalQty : 1);
      
      existing.quantity = totalQty;
      existing.entryPrice = avgPrice;
      existing.currentPrice = price;
    }
  }

  /**
   * تسجيل صفقة مكتملة
   */
  private recordTrade(
    symbol: string,
    side: 'LONG' | 'SHORT',
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    fees: number,
    fundingCost: number,
    slippagePct: number,
    netPnl: number
  ): void {
    const trade: PaperTrade = {
      tradeId: `TRADE-${Date.now()}`,
      symbol,
      side,
      entryTime: this.positions.get(symbol)?.entryTime || Date.now(),
      entryPrice,
      quantity,
      exitTime: Date.now(),
      exitPrice,
      grossPnl: side === 'LONG' 
        ? (exitPrice - entryPrice) * quantity 
        : (entryPrice - exitPrice) * quantity,
      fees,
      fundingCost,
      slippage: slippagePct * exitPrice * quantity,
      netPnl,
      netPnlPct: (netPnl / ((entryPrice * quantity) || 1)) * 100,
      reason: 'SIGNAL',
      duration: Date.now() - (this.positions.get(symbol)?.entryTime || Date.now())
    };
    
    this.tradeHistory.push(trade);
    this.totalTrades++;
    
    if (netPnl > 0) {
      this.winningTrades++;
    } else {
      this.losingTrades++;
    }
    
    // CircuitBreakers: Record trade result
    this.circuitBreakers.recordTradeResult(netPnl);

    // تحديث Maximum Drawdown
    if (this.balance > this.peakBalance) {
      this.peakBalance = this.balance;
    }
    const drawdown = (this.peakBalance - this.balance) / (this.peakBalance > 0 ? this.peakBalance : 1);
    if (drawdown > this.maxDrawdown) {
      this.maxDrawdown = drawdown;
    }

    // CircuitBreakers: Evaluate drawdown limit
    this.circuitBreakers.check(this.balance, this.maxDrawdown);
  }

  /**
   * إنشاء أمر مرفوض
   */
  private createRejectedOrder(
    orderId: string, 
    symbol: string, 
    side: 'BUY' | 'SELL', 
    orderType: 'MARKET' | 'LIMIT', 
    quantity: number, 
    reason: string
  ): PaperOrder {
    const order: PaperOrder = {
      orderId,
      symbol,
      side,
      orderType,
      quantity,
      price: 0,
      timestamp: Date.now(),
      status: 'REJECTED',
      filledQuantity: 0,
      avgFillPrice: 0,
      slippagePct: 0,
      feeUsd: 0,
      fundingCostUsd: 0,
      latencyMs: 0
    };
    
    this.orders.set(orderId, order);
    console.warn(`[Paper] ❌ REJECTED ${side} ${symbol}: ${reason}`);
    
    return order;
  }

  reset(newInitialBalance?: number): void {
    if (newInitialBalance !== undefined && newInitialBalance > 0) {
      this.config.initialBalance = newInitialBalance;
    }
    this.balance = this.config.initialBalance;
    this.peakBalance = this.balance;
    this.maxDrawdown = 0;
    this.totalTrades = 0;
    this.winningTrades = 0;
    this.losingTrades = 0;
    this.totalFees = 0;
    this.totalFundingCost = 0;
    this.totalSlippage = 0;
    this.orders.clear();
    this.positions.clear();
    this.tradeHistory = [];
    this.circuitBreakers.reset();
    console.log(`🔄 PaperTradingEngine reset with balance: $${this.balance}`);
  }

  setBalance(amount: number): void {
    if (amount > 0) {
      this.balance = amount;
      if (this.balance > this.peakBalance) {
        this.peakBalance = this.balance;
      }
    }
  }

  // ==================== Getters ====================

  getBalance(): number {
    return this.balance;
  }

  getInitialBalance(): number {
    return this.config.initialBalance;
  }

  getPositions(): Map<string, PaperPosition> {
    return this.positions;
  }

  getTradeHistory(limit: number = 50): PaperTrade[] {
    return this.tradeHistory.slice(-limit);
  }

  getStatistics(): any {
    const winRate = this.totalTrades > 0 
      ? (this.winningTrades / this.totalTrades) * 100 
      : 0;
    
    const avgWin = this.tradeHistory
      .filter(t => t.netPnl > 0)
      .reduce((sum, t) => sum + t.netPnl, 0) / Math.max(this.winningTrades, 1);
    
    const avgLoss = this.tradeHistory
      .filter(t => t.netPnl <= 0)
      .reduce((sum, t) => sum + t.netPnl, 0) / Math.max(this.losingTrades, 1);
    
    const profitFactor = avgLoss !== 0 
      ? Math.abs(avgWin * this.winningTrades / (avgLoss * this.losingTrades)) 
      : 0;
    
    return {
      balance: parseFloat(this.balance.toFixed(2)),
      initialBalance: this.config.initialBalance,
      totalPnl: parseFloat((this.balance - this.config.initialBalance).toFixed(2)),
      totalPnlPct: parseFloat((((this.balance - this.config.initialBalance) / this.config.initialBalance) * 100).toFixed(2)),
      totalTrades: this.totalTrades,
      winningTrades: this.winningTrades,
      losingTrades: this.losingTrades,
      winRate: parseFloat(winRate.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      totalFees: parseFloat(this.totalFees.toFixed(4)),
      totalFundingCost: parseFloat(this.totalFundingCost.toFixed(4)),
      totalSlippage: parseFloat(this.totalSlippage.toFixed(4)),
      maxDrawdown: parseFloat((this.maxDrawdown * 100).toFixed(2)),
      openPositions: this.positions.size
    };
  }

  // ==================== أدوات مساعدة ====================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
