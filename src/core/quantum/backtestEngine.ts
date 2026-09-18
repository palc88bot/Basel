import { Kline, OrderBookSnapshot } from './binanceWs';
import { QuantumTechnicalIndicators } from './indicators';
import { QuantumMind } from './quantumMind';
import { QuantumTrainer } from './trainer';

export interface QuantumTradeRecord {
    entryTime: number;
    exitTime: number;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    duration: number;
    exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_TEST' | 'SIGNAL_REVERSAL';
    slippagePaid: number;
    confidence: number;
}

export interface QuantumBacktestMetrics {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    totalPnlPercent: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    averageTradeDuration: number;
    bestTrade: number;
    worstTrade: number;
    totalSlippagePaid: number;
}

export interface QuantumBacktestConfig {
    initialCapital: number;
    basePositionSizePercent: number;  // 2% base
    leverage: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    commissionPercent: number;        // e.g. 0.04% taker fee
    slippagePercent: number;          // Realistic slippage: 0.02% to 0.05%
    confidenceThreshold: number;      // e.g. 15%
    dynamicPositionSizing: boolean;   // Scales size by confidence and inversely by ATR
}

interface ActiveQuantumPosition {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    size: number;
    entryTime: number;
    stopLoss: number;
    takeProfit: number;
    confidence: number;
    slippageAtEntry: number;
}

/**
 * Institutional-Grade Quantum Backtest Engine with Realistic Slippage & Dynamic Position Sizing
 */
export class QuantumBacktestEngine {
    private mind: QuantumMind;
    private config: QuantumBacktestConfig;
    private trades: QuantumTradeRecord[] = [];
    private equityCurve: number[] = [];
    private position: ActiveQuantumPosition | null = null;
    private capital: number;
    private totalSlippageAccumulated: number = 0;

    constructor(mind: QuantumMind, config: Partial<QuantumBacktestConfig> = {}) {
        this.mind = mind;
        this.config = {
            initialCapital: config.initialCapital || 10000,
            basePositionSizePercent: config.basePositionSizePercent || 0.02,
            leverage: config.leverage || 5,
            stopLossPercent: config.stopLossPercent || 0.01,
            takeProfitPercent: config.takeProfitPercent || 0.02,
            commissionPercent: config.commissionPercent || 0.0004,
            slippagePercent: config.slippagePercent !== undefined ? config.slippagePercent : 0.00025, // 0.025% realistic slippage
            confidenceThreshold: config.confidenceThreshold || 12,
            dynamicPositionSizing: config.dynamicPositionSizing !== undefined ? config.dynamicPositionSizing : true
        };
        this.capital = this.config.initialCapital;
    }

    /**
     * Run backtest on historic or generated klines
     */
    run(klines: Kline[], books?: OrderBookSnapshot[]): QuantumTradeRecord[] {
        this.trades = [];
        this.equityCurve = [this.capital];
        this.position = null;
        this.capital = this.config.initialCapital;
        this.totalSlippageAccumulated = 0;

        if (!klines || klines.length < 20) return [];

        for (let i = 20; i < klines.length; i++) {
            const pastKlines = klines.slice(0, i + 1);
            const book = books && books[i] ? books[i] : null;
            const currentPrice = klines[i].close;
            const currentHigh = klines[i].high;
            const currentLow = klines[i].low;

            // 1. Manage Open Position with Realistic Slippage
            if (this.position) {
                this.checkExit(currentHigh, currentLow, currentPrice, klines[i].timestamp);
            }

            // 2. Discover Entries via Quantum Mind
            if (!this.position) {
                const features = QuantumTechnicalIndicators.extractFeatures(pastKlines, book);
                const { decision, confidence } = this.mind.decide(features);

                if (confidence >= this.config.confidenceThreshold && decision !== 0) {
                    const atrInfo = QuantumTechnicalIndicators.atr(pastKlines);
                    this.enterPosition(decision === 1 ? 'LONG' : 'SHORT', currentPrice, klines[i].timestamp, confidence, atrInfo.norm);
                }
            }

            // 3. Track Equity
            this.equityCurve.push(this.calculateEquity(currentPrice));
        }

        // Close trailing position at end
        if (this.position) {
            const lastPrice = klines[klines.length - 1].close;
            this.closePosition(lastPrice, klines[klines.length - 1].timestamp, 'END_OF_TEST');
        }

        return this.trades;
    }

    /**
     * Enter Position with Dynamic Sizing & Entry Slippage
     */
    private enterPosition(
        side: 'LONG' | 'SHORT', 
        rawPrice: number, 
        time: number, 
        confidence: number,
        normalizedAtr: number
    ): void {
        // Slippage adjustment at entry (Buy higher, Sell lower)
        const slippageMultiplier = 1 + (side === 'LONG' ? this.config.slippagePercent : -this.config.slippagePercent);
        const actualEntryPrice = rawPrice * slippageMultiplier;
        const slippageCost = Math.abs(actualEntryPrice - rawPrice);

        // Dynamic Position Sizing: Confidence scaling [0.5x to 2.0x] & Volatility damping
        let sizeScalar = 1.0;
        if (this.config.dynamicPositionSizing) {
            const confidenceBoost = 0.5 + (confidence / 50); // e.g. 50% conf -> 1.5x
            const volDampener = 1 / (1 + Math.max(0, normalizedAtr * 0.5));
            sizeScalar = Math.min(2.0, Math.max(0.4, confidenceBoost * volDampener));
        }

        const positionValue = this.capital * (this.config.basePositionSizePercent * sizeScalar) * this.config.leverage;
        const size = positionValue / actualEntryPrice;

        let stopLoss: number, takeProfit: number;
        if (side === 'LONG') {
            stopLoss = actualEntryPrice * (1 - this.config.stopLossPercent);
            takeProfit = actualEntryPrice * (1 + this.config.takeProfitPercent);
        } else {
            stopLoss = actualEntryPrice * (1 + this.config.stopLossPercent);
            takeProfit = actualEntryPrice * (1 - this.config.takeProfitPercent);
        }

        this.position = {
            side,
            entryPrice: actualEntryPrice,
            size,
            entryTime: time,
            stopLoss,
            takeProfit,
            confidence,
            slippageAtEntry: slippageCost * size
        };

        this.totalSlippageAccumulated += slippageCost * size;
        this.capital -= positionValue * this.config.commissionPercent;
    }

    /**
     * Check Trailing Stop and Take Profit
     */
    private checkExit(high: number, low: number, currentPrice: number, time: number): void {
        if (!this.position) return;

        let shouldExit = false;
        let exitPrice = currentPrice;
        let reason: 'STOP_LOSS' | 'TAKE_PROFIT' = 'STOP_LOSS';

        if (this.position.side === 'LONG') {
            if (low <= this.position.stopLoss) {
                shouldExit = true;
                // Slippage penalty on emergency stop
                exitPrice = this.position.stopLoss * (1 - this.config.slippagePercent);
                reason = 'STOP_LOSS';
            } else if (high >= this.position.takeProfit) {
                shouldExit = true;
                exitPrice = this.position.takeProfit * (1 - this.config.slippagePercent * 0.5);
                reason = 'TAKE_PROFIT';
            }
        } else {
            if (high >= this.position.stopLoss) {
                shouldExit = true;
                exitPrice = this.position.stopLoss * (1 + this.config.slippagePercent);
                reason = 'STOP_LOSS';
            } else if (low <= this.position.takeProfit) {
                shouldExit = true;
                exitPrice = this.position.takeProfit * (1 + this.config.slippagePercent * 0.5);
                reason = 'TAKE_PROFIT';
            }
        }

        if (shouldExit) {
            this.closePosition(exitPrice, time, reason);
        }
    }

    /**
     * Close Position and Log Execution
     */
    private closePosition(
        rawExitPrice: number, 
        time: number, 
        reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'END_OF_TEST' | 'SIGNAL_REVERSAL'
    ): void {
        if (!this.position) return;

        const entryValue = this.position.size * this.position.entryPrice;
        const exitValue = this.position.size * rawExitPrice;

        let rawPnl = this.position.side === 'LONG' 
            ? exitValue - entryValue 
            : entryValue - exitValue;

        // Fees
        const commission = exitValue * this.config.commissionPercent;
        const netPnl = rawPnl - commission;
        const pnlPercent = this.capital > 0 ? netPnl / this.capital : 0;

        this.trades.push({
            entryTime: this.position.entryTime,
            exitTime: time,
            side: this.position.side,
            entryPrice: parseFloat(this.position.entryPrice.toFixed(4)),
            exitPrice: parseFloat(rawExitPrice.toFixed(4)),
            pnl: parseFloat(netPnl.toFixed(2)),
            pnlPercent: parseFloat((pnlPercent * 100).toFixed(2)),
            duration: time - this.position.entryTime,
            exitReason: reason,
            slippagePaid: parseFloat(this.position.slippageAtEntry.toFixed(2)),
            confidence: this.position.confidence
        });

        this.capital += netPnl;
        this.position = null;
    }

    private calculateEquity(currentPrice: number): number {
        let equity = this.capital;
        if (this.position) {
            const currentValue = this.position.size * currentPrice;
            const entryValue = this.position.size * this.position.entryPrice;
            const unrealizedPnl = this.position.side === 'LONG' 
                ? currentValue - entryValue 
                : entryValue - currentValue;
            equity += unrealizedPnl;
        }
        return equity;
    }

    getEquityCurve(): number[] {
        return this.equityCurve;
    }

    getTrades(): QuantumTradeRecord[] {
        return this.trades;
    }

    getMetrics(): QuantumBacktestMetrics {
        return QuantumPerformanceCalculator.calculate(this.trades, this.config.initialCapital, this.totalSlippageAccumulated);
    }
}

/**
 * Performance Calculator for Quant Backtest
 */
export class QuantumPerformanceCalculator {
    static calculate(
        trades: QuantumTradeRecord[], 
        initialCapital: number = 10000,
        totalSlippage: number = 0
    ): QuantumBacktestMetrics {
        if (!trades || trades.length === 0) {
            return {
                totalTrades: 0, winningTrades: 0, losingTrades: 0,
                winRate: 0, totalPnl: 0, totalPnlPercent: 0,
                averageWin: 0, averageLoss: 0, profitFactor: 0,
                sharpeRatio: 0, maxDrawdown: 0, maxDrawdownPercent: 0,
                calmarRatio: 0, averageTradeDuration: 0, bestTrade: 0, worstTrade: 0,
                totalSlippagePaid: 0
            };
        }

        const winners = trades.filter(t => t.pnl > 0);
        const losers = trades.filter(t => t.pnl <= 0);

        const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
        const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0;
        const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + t.pnl, 0) / losers.length) : 0;

        const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
        const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);

        // Sharpe Ratio
        const returns = trades.map(t => t.pnlPercent / 100);
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
        const stdReturn = Math.sqrt(variance);
        const sharpeRatio = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

        // Max Drawdown
        let equity = initialCapital;
        let peak = initialCapital;
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;

        for (const t of trades) {
            equity += t.pnl;
            if (equity > peak) peak = equity;
            const dd = peak - equity;
            const ddPct = peak > 0 ? dd / peak : 0;
            if (dd > maxDrawdown) maxDrawdown = dd;
            if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;
        }

        const annualReturn = meanReturn * 252;
        const calmarRatio = maxDrawdownPercent > 0 ? annualReturn / maxDrawdownPercent : 0;
        const avgDuration = trades.reduce((s, t) => s + t.duration, 0) / trades.length;

        return {
            totalTrades: trades.length,
            winningTrades: winners.length,
            losingTrades: losers.length,
            winRate: parseFloat(((winners.length / trades.length) * 100).toFixed(1)),
            totalPnl: parseFloat(totalPnl.toFixed(2)),
            totalPnlPercent: parseFloat(((totalPnl / initialCapital) * 100).toFixed(2)),
            averageWin: parseFloat(avgWin.toFixed(2)),
            averageLoss: parseFloat(avgLoss.toFixed(2)),
            profitFactor: parseFloat(profitFactor.toFixed(2)),
            sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
            maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
            maxDrawdownPercent: parseFloat((maxDrawdownPercent * 100).toFixed(2)),
            calmarRatio: parseFloat(calmarRatio.toFixed(2)),
            averageTradeDuration: Math.round(avgDuration),
            bestTrade: Math.max(...trades.map(t => t.pnl)),
            worstTrade: Math.min(...trades.map(t => t.pnl)),
            totalSlippagePaid: parseFloat(totalSlippage.toFixed(2))
        };
    }
}

/**
 * Walk-Forward Analysis to combat overfitting and validate out-of-sample adaptability
 */
export class QuantumWalkForwardEngine {
    static async run(
        klines: Kline[],
        mind: QuantumMind,
        config: { trainWindow?: number; testWindow?: number; step?: number } = {},
        onProgress?: (windowIdx: number, totalWindows: number, metric: QuantumBacktestMetrics) => void
    ): Promise<{
        windowsCount: number;
        allTrades: QuantumTradeRecord[];
        aggregateMetrics: QuantumBacktestMetrics;
        windowResults: Array<{ window: number; trainRange: [number, number]; testRange: [number, number]; metrics: QuantumBacktestMetrics }>;
    }> {
        const trainWindow = config.trainWindow || 200;
        const testWindow = config.testWindow || 60;
        const step = config.step || 60;

        const allTrades: QuantumTradeRecord[] = [];
        const windowResults: Array<{ window: number; trainRange: [number, number]; testRange: [number, number]; metrics: QuantumBacktestMetrics }> = [];

        const totalWindows = Math.floor(Math.max(1, (klines.length - trainWindow) / step));
        let window = 0;

        for (let start = 0; start + trainWindow + testWindow <= klines.length; start += step) {
            window++;
            const trainEnd = start + trainWindow;
            const testEnd = trainEnd + testWindow;

            const trainKlines = klines.slice(start, trainEnd);
            const testKlines = klines.slice(trainEnd, testEnd);

            // 1. Train on in-sample window
            const trainer = new QuantumTrainer(mind, {
                epochs: 6,
                learningRate: 0.03,
                validationSplit: 0.15,
                maxGradientBatches: 2
            });

            const trainRes = await trainer.train(trainKlines);
            mind.updateAllWeights(trainRes.weights);

            // 2. Test strictly on Out-Of-Sample window
            const engine = new QuantumBacktestEngine(mind, {
                initialCapital: 10000,
                basePositionSizePercent: 0.02,
                leverage: 5,
                slippagePercent: 0.0003,
                dynamicPositionSizing: true
            });

            const windowTrades = engine.run(testKlines);
            allTrades.push(...windowTrades);

            const metrics = engine.getMetrics();
            windowResults.push({
                window,
                trainRange: [start, trainEnd],
                testRange: [trainEnd, testEnd],
                metrics
            });

            if (onProgress) {
                onProgress(window, totalWindows, metrics);
            }
        }

        const aggregateMetrics = QuantumPerformanceCalculator.calculate(allTrades, 10000);

        return {
            windowsCount: window,
            allTrades,
            aggregateMetrics,
            windowResults
        };
    }
}
