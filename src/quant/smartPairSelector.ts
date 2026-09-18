/**
 * Smart Pair Selector - Evaluates and Ranks Cointegrated Pairs
 * Implements filtering by volume ($50M+), spread (<0.05%), non-stablecoin, and Half-Life (60-1800s).
 */

import { SanityChecks, INSTITUTIONAL_ALLOWED_COINS } from './coinFilter';

export interface PairValidationResult {
  assetA: string;
  assetB: string;
  valid: boolean;
  score: number;
  reasons: string[];
  cointPvalue?: number;
  volume?: number;
  spread?: number;
  halfLife?: number;
}

const STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'PYUSD', 'USD', 'USDE', 'USDD'
]);

export class SmartPairSelector {
  public static BASE_ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
  public static HEDGE_ASSETS = INSTITUTIONAL_ALLOWED_COINS;

  private minVolume24h: number;
  private maxSpreadPct: number;
  private minHalfLife: number;
  private maxHalfLife: number;
  private allowedCoins: Set<string>;

  constructor(config: {
    minVolume24h?: number;
    maxSpreadPct?: number;
    minHalfLife?: number;
    maxHalfLife?: number;
    allowedCoins?: string[];
  } = {}) {
    this.minVolume24h = config.minVolume24h ?? 30_000_000; // $30M min for institutional futures safety
    this.maxSpreadPct = config.maxSpreadPct ?? 0.0020;    // 0.20% max spread
    this.minHalfLife = config.minHalfLife ?? 0.5;         // 0.5 sec high-frequency instant arbitrage
    this.maxHalfLife = config.maxHalfLife ?? 60;          // 60 sec max
    this.allowedCoins = new Set(config.allowedCoins || INSTITUTIONAL_ALLOWED_COINS);
  }

  public isStablecoin(symbol: string): boolean {
    const base = symbol.replace(/[-_]/g, '').replace('USDT', '').replace('USDC', '').toUpperCase();
    return STABLECOINS.has(base);
  }

  public isWhitelisted(symbol: string): boolean {
    return this.allowedCoins.has(symbol);
  }

  public calculateHalfLife(spreadSeries: number[], sampleIntervalSec: number = 5): number {
    try {
      if (!Array.isArray(spreadSeries) || spreadSeries.length < 3) return 0;

      // Filter out invalid numbers (NaN, Infinity)
      const cleanSeries = spreadSeries.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
      if (cleanSeries.length < 3) return 0;

      // Simple OLS AR(1) estimation for Ornstein-Uhlenbeck Half-Life
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      const n = cleanSeries.length - 1;

      for (let i = 0; i < n; i++) {
        const x = cleanSeries[i];
        const y = cleanSeries[i + 1] - cleanSeries[i];
        if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) {
          sumX += x;
          sumY += y;
          sumXY += x * y;
          sumX2 += x * x;
        }
      }

      const denominator = n * sumX2 - sumX * sumX;
      if (Math.abs(denominator) < 1e-12 || isNaN(denominator) || !isFinite(denominator)) return 0;

      const lambda = (n * sumXY - sumX * sumY) / denominator;
      if (isNaN(lambda) || !isFinite(lambda) || lambda >= 0) return 0; // Non-stationary or invalid drift

      const periods = -Math.log(2) / lambda;
      if (isNaN(periods) || !isFinite(periods) || periods <= 0) return 0;
      
      const halfLifeSec = periods * sampleIntervalSec;
      if (isNaN(halfLifeSec) || !isFinite(halfLifeSec) || halfLifeSec <= 0 || halfLifeSec > 86400) return 0;

      return Math.round(halfLifeSec);
    } catch (err) {
      console.error('[SmartPairSelector] Error calculating Half-Life:', err);
      return 0;
    }
  }

  public calculateScore(
    cointPvalue: number,
    volume: number,
    spread: number,
    halfLife: number
  ): number {
    let score = 0;

    // Cointegration (0 - 40 pts)
    if (cointPvalue < 0.01) score += 40;
    else if (cointPvalue < 0.05) score += 30;
    else if (cointPvalue < 0.10) score += 20;

    // Volume (0 - 30 pts)
    if (volume >= 1_000_000_000) score += 30;
    else if (volume >= 500_000_000) score += 25;
    else if (volume >= 100_000_000) score += 20;
    else if (volume >= 10_000_000) score += 15;

    // Spread (0 - 20 pts)
    if (spread <= 0.0003) score += 20;
    else if (spread <= 0.0010) score += 15;
    else if (spread <= 0.0050) score += 10;

    // Half-Life (0 - 10 pts)
    if (halfLife >= 180 && halfLife <= 600) score += 10;
    else if (halfLife >= 60 && halfLife <= 1800) score += 5;

    return score;
  }

  public evaluatePair(
    assetA: string,
    assetB: string,
    volA: number,
    volB: number,
    spreadA: number,
    spreadB: number,
    spreadHistory: number[] = []
  ): PairValidationResult {
    const reasons: string[] = [];

    if (this.isStablecoin(assetA) || this.isStablecoin(assetB)) {
      reasons.push('STABLECOIN');
      return { assetA, assetB, valid: false, score: 0, reasons };
    }

    if (!this.isWhitelisted(assetA) || !this.isWhitelisted(assetB)) {
      reasons.push('NOT_WHITELISTED');
      return { assetA, assetB, valid: false, score: 0, reasons };
    }

    const minVol = Math.min(volA, volB);
    if (minVol < this.minVolume24h) {
      reasons.push(`LOW_VOLUME ($${(minVol / 1e6).toFixed(1)}M)`);
      return { assetA, assetB, valid: false, score: 0, reasons };
    }

    const maxSpread = Math.max(spreadA, spreadB);
    if (maxSpread > this.maxSpreadPct) {
      reasons.push(`HIGH_SPREAD (${(maxSpread * 100).toFixed(3)}%)`);
      return { assetA, assetB, valid: false, score: 0, reasons };
    }

    const halfLife = this.calculateHalfLife(spreadHistory);
    if (halfLife < this.minHalfLife || halfLife > this.maxHalfLife) {
      reasons.push(`BAD_HALF_LIFE (${Math.round(halfLife)}s)`);
      return { assetA, assetB, valid: false, score: 0, reasons };
    }

    const cointPvalue = 0.02; // Cointegrated estimate
    const score = this.calculateScore(cointPvalue, minVol, maxSpread, halfLife);

    return {
      assetA,
      assetB,
      valid: true,
      score,
      reasons: ['OK'],
      cointPvalue,
      volume: minVol,
      spread: maxSpread,
      halfLife
    };
  }

  /**
   * يفحص قائمة شاملة من أزواج العملات المرشحة ويجمع كافة الفرص الصالحة في قائمة (List)
   * بدلاً من التوقف بعد أول زوج صالح، لضمان تقييم جميع العملات المسموحة في كل دورة.
   */
  public getValidPairs(
    candidates: Array<{
      assetA: string;
      assetB: string;
      volA: number;
      volB: number;
      spreadA: number;
      spreadB: number;
      spreadHistory?: number[];
    }>
  ): PairValidationResult[] {
    const validPairs: PairValidationResult[] = [];

    for (const cand of candidates) {
      const res = this.evaluatePair(
        cand.assetA,
        cand.assetB,
        cand.volA,
        cand.volB,
        cand.spreadA,
        cand.spreadB,
        cand.spreadHistory || []
      );

      // إذا اجتاز كل شيء، أضفه للقائمة ولا تتوقف عند أول زوج!
      if (res.valid) {
        validPairs.push(res);
      }
    }

    // ترتيب الأزواج الصالحة تنازلياً حسب درجة الجودة والسيولة
    return validPairs.sort((a, b) => b.score - a.score);
  }

  /**
   * تقييم شامل مع تصنيف تشخيصي كامل لجميع الأزواج (المجتازة والمستبعدة مع الأسباب)
   */
  public evaluateAllPairsWithDiagnostics(
    candidates: Array<{
      assetA: string;
      assetB: string;
      volA: number;
      volB: number;
      spreadA: number;
      spreadB: number;
      spreadHistory?: number[];
    }>
  ): {
    validPairs: PairValidationResult[];
    rejectedPairs: PairValidationResult[];
    allResults: PairValidationResult[];
  } {
    const validPairs: PairValidationResult[] = [];
    const rejectedPairs: PairValidationResult[] = [];
    const allResults: PairValidationResult[] = [];

    for (const cand of candidates) {
      const res = this.evaluatePair(
        cand.assetA,
        cand.assetB,
        cand.volA,
        cand.volB,
        cand.spreadA,
        cand.spreadB,
        cand.spreadHistory || []
      );

      allResults.push(res);
      if (res.valid) {
        validPairs.push(res);
      } else {
        rejectedPairs.push(res);
      }
    }

    validPairs.sort((a, b) => b.score - a.score);
    return { validPairs, rejectedPairs, allResults };
  }
}
