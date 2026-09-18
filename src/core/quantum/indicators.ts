import { Kline, OrderBookSnapshot } from './binanceWs';

/**
 * 8-Dimensional Multi-Modal Quantum Feature Extractor
 * Normalizes all market signals to [-1, 1] suitable for Hilbert Space Qubit Rotation (Ry / Rz)
 */
export class QuantumTechnicalIndicators {
    /**
     * RSI - Relative Strength Index normalized to [-1, 1]
     */
    static rsi(closes: number[], period: number = 14): number {
        if (closes.length < period + 1) return 0;
        
        let gains = 0, losses = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            const diff = closes[i] - closes[i - 1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        
        if (avgLoss === 0) return 1;
        const rs = avgGain / avgLoss;
        const normalized = 1 - (1 / (1 + rs)); // [0, 1]
        return (normalized - 0.5) * 2; // [-1, 1]
    }

    /**
     * MACD Histogram normalized
     */
    static macd(closes: number[]): { macd: number; signal: number; histogram: number; norm: number } {
        if (closes.length < 26) {
            return { macd: 0, signal: 0, histogram: 0, norm: 0 };
        }
        const ema12 = this.ema(closes, 12);
        const ema26 = this.ema(closes, 26);
        const macdLine = ema12 - ema26;
        
        const macdHistory: number[] = [];
        for (let i = 26; i < closes.length; i++) {
            const e12 = this.ema(closes.slice(0, i + 1), 12);
            const e26 = this.ema(closes.slice(0, i + 1), 26);
            macdHistory.push(e12 - e26);
        }
        
        const signal = macdHistory.length >= 9 
            ? this.ema(macdHistory, 9) 
            : macdLine;
        const histogram = macdLine - signal;
        const currentClose = closes[closes.length - 1] || 1;
        const norm = Math.tanh(histogram / (currentClose * 0.002));
        
        return {
            macd: macdLine,
            signal,
            histogram,
            norm: Math.max(-1, Math.min(1, norm))
        };
    }

    /**
     * Exponential Moving Average
     */
    static ema(data: number[], period: number): number {
        if (data.length === 0) return 0;
        if (data.length < period) return data[data.length - 1];
        
        const k = 2 / (period + 1);
        let val = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        for (let i = period; i < data.length; i++) {
            val = data[i] * k + val * (1 - k);
        }
        return val;
    }

    /**
     * Bollinger Bands %B normalized to [-1, 1]
     */
    static bollinger(closes: number[], period: number = 20): { percentB: number; norm: number } {
        if (closes.length < period) return { percentB: 0.5, norm: 0 };
        const slice = closes.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / period;
        const std = Math.sqrt(variance);
        
        const upper = mean + 2 * std;
        const lower = mean - 2 * std;
        const current = closes[closes.length - 1];
        const span = upper - lower;
        const percentB = span > 0 ? (current - lower) / span : 0.5;
        const norm = Math.max(-1, Math.min(1, (percentB - 0.5) * 2));
        
        return { percentB, norm };
    }

    /**
     * ATR - Average True Range normalized
     */
    static atr(klines: Kline[], period: number = 14): { atr: number; norm: number } {
        if (klines.length < period + 1) return { atr: 0, norm: 0 };
        
        const trs: number[] = [];
        for (let i = 1; i < klines.length; i++) {
            const high = klines[i].high;
            const low = klines[i].low;
            const prevClose = klines[i - 1].close;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trs.push(tr);
        }
        
        const rawAtr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
        const close = klines[klines.length - 1].close || 1;
        const atrFraction = rawAtr / close;
        const norm = Math.max(-1, Math.min(1, Math.tanh(atrFraction * 80)));
        return { atr: rawAtr, norm };
    }

    /**
     * Volume Delta (CVD) normalized
     */
    static volumeDelta(klines: Kline[]): number {
        if (klines.length < 2) return 0;
        
        const recent = klines.slice(-5);
        let delta = 0;
        for (const k of recent) {
            const range = k.high - k.low;
            if (range === 0) continue;
            const buyVolume = k.volume * ((k.close - k.low) / range);
            const sellVolume = k.volume * ((k.high - k.close) / range);
            delta += buyVolume - sellVolume;
        }
        const lastVol = klines[klines.length - 1].volume || 1;
        return Math.max(-1, Math.min(1, Math.tanh(delta / (lastVol * 3))));
    }

    /**
     * Order Book Imbalance (OFI / Depth Ratio) [-1, 1]
     */
    static orderBookImbalance(book: OrderBookSnapshot | null, depth: number = 10): number {
        if (!book || !book.bids.length || !book.asks.length) return 0;
        const bidVolume = book.bids.slice(0, depth).reduce((s, b) => s + b.quantity, 0);
        const askVolume = book.asks.slice(0, depth).reduce((s, a) => s + a.quantity, 0);
        const total = bidVolume + askVolume;
        if (total === 0) return 0;
        return Math.max(-1, Math.min(1, (bidVolume - askVolume) / total));
    }

    /**
     * Momentum [-1, 1]
     */
    static momentum(closes: number[], period: number = 10): number {
        if (closes.length < period) return 0;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - period];
        if (past === 0) return 0;
        const pct = (current - past) / past;
        return Math.max(-1, Math.min(1, Math.tanh(pct * 25)));
    }

    /**
     * Price Action Candlestick body pressure [-1, 1]
     */
    static priceAction(klines: Kline[]): number {
        if (klines.length < 3) return 0;
        const recent = klines.slice(-3);
        
        const bullish = recent.filter(k => k.close >= k.open).length;
        const bodyStrength = recent.reduce((sum, k) => {
            const body = Math.abs(k.close - k.open);
            const range = k.high - k.low;
            return sum + (range > 0 ? body / range : 0.5);
        }, 0) / recent.length;
        
        const raw = ((bullish / recent.length) - 0.5) * 2 * bodyStrength;
        return Math.max(-1, Math.min(1, raw));
    }

    /**
     * Combine all into unified 8-dimensional normalized array for the 8-qubit Quantum Mind:
     * [0] RSI, [1] MACD, [2] Bollinger, [3] ATR Volatility, [4] Volume Delta, [5] Order Book Imbalance, [6] Momentum, [7] Price Action
     */
    static extractFeatures(klines: Kline[], book: OrderBookSnapshot | null): number[] {
        if (!klines || klines.length === 0) {
            return [0, 0, 0, 0, 0, 0, 0, 0];
        }
        const closes = klines.map(k => k.close);
        
        const rsi = this.rsi(closes);
        const macdNorm = this.macd(closes).norm;
        const bbNorm = this.bollinger(closes).norm;
        const atrNorm = this.atr(klines).norm;
        const volNorm = this.volumeDelta(klines);
        const obImb = this.orderBookImbalance(book);
        const mom = this.momentum(closes);
        const pa = this.priceAction(klines);
        
        return [
            parseFloat(rsi.toFixed(3)),
            parseFloat(macdNorm.toFixed(3)),
            parseFloat(bbNorm.toFixed(3)),
            parseFloat(atrNorm.toFixed(3)),
            parseFloat(volNorm.toFixed(3)),
            parseFloat(obImb.toFixed(3)),
            parseFloat(mom.toFixed(3)),
            parseFloat(pa.toFixed(3))
        ];
    }
}
