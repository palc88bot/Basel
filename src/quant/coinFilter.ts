/**
 * Safe Coin Filter - Prevents trading on risky or illiquid futures coins
 */

export interface CoinMetrics {
  symbol: string;
  price: number;
  volume24hUsd: number;
  liquidityScore: number; // 0 - 100
  spreadPct: number;
  volatility1h: number;
  rankByVolume: number;
  lastZScore: number;
  isStablecoin: boolean;
  isNewListing: boolean;
  lastUpdated: number;
}

export interface CoinFilterConfig {
  minVolume24hUsd?: number;   // default $50M
  maxSpreadPct?: number;      // default 0.0010 (0.10%)
  maxVolatility1h?: number;   // default 0.15 (15%)
  minRank?: number;           // default 1
  maxRank?: number;           // default 50
  maxAbsZScore?: number;      // default 4.0
  blacklist?: string[];
  whitelist?: string[];
}

export interface TradeableCheckResult {
  isTradeable: boolean;
  reason: string;
}

export const INSTITUTIONAL_ALLOWED_COINS = [
  'ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'SUIUSDT', 'LINKUSDT', 'NEARUSDT', 'APTUSDT',
  'PEPEUSDT', 'SHIBUSDT', 'POLUSDT', 'DOTUSDT', 'LTCUSDT', 'FETUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'TIAUSDT', 'RENDERUSDT', 'SEIUSDT',
  'RUNEUSDT', 'WIFUSDT', 'FTMUSDT', 'ATOMUSDT', 'ETCUSDT', 'TRXUSDT',
  'TONUSDT', 'ORDIUSDT', 'AAVEUSDT', 'UNIUSDT'
];

export class SanityChecks {
  public static readonly MAX_Z_SCORE_CIRCUIT_BREAKER = 15.0;
  public static readonly MAX_Z_SCORE_TRADEABLE = 5.5; // Increased from 4.0
  public static readonly MIN_HALF_LIFE = 0.5;         // High-frequency instant arbitrage minimum (0.5 sec)
  public static readonly MAX_HALF_LIFE = 60.0;        // Max 60 seconds fast mean-reversion
  public static readonly MIN_VOLUME_USD = 10_000_000.0; // Consistent with server.ts
  public static readonly MAX_SPREAD_PERCENT = 0.0050; // 0.50% Consistent with server.ts

  public static isValidNumber(val: any, name = 'value', allowNegative = false): boolean {
    if (val === null || val === undefined) return false;
    const num = Number(val);
    if (isNaN(num) || !isFinite(num)) return false;
    if (!allowNegative && num < 0) return false;
    return true;
  }

  public static validateZScore(z: number): boolean {
    if (!this.isValidNumber(z, 'Z-Score', true)) return false;
    const absZ = Math.abs(z);
    if (absZ > this.MAX_Z_SCORE_CIRCUIT_BREAKER) return false;
    if (absZ > this.MAX_Z_SCORE_TRADEABLE) return false;
    return true;
  }

  public static validateHalfLife(hl: number): boolean {
    if (!this.isValidNumber(hl, 'Half-Life', false)) return false;
    return hl >= this.MIN_HALF_LIFE && hl <= this.MAX_HALF_LIFE;
  }

  public static validateVolume(vol: number): boolean {
    if (!this.isValidNumber(vol, 'Volume', false)) return false;
    return vol >= this.MIN_VOLUME_USD;
  }

  public static validateSpread(spread: number): boolean {
    if (!this.isValidNumber(spread, 'Spread', false)) return false;
    const realSpread = spread > 1 ? spread / 100 : spread;
    return realSpread <= this.MAX_SPREAD_PERCENT;
  }
}

const DEFAULT_STABLECOINS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX',
  'FDUSD', 'PYUSD', 'GUSD', 'EURS', 'USDD', 'USD', 'USDE'
]);

export class SafeCoinFilter {
  private minVolume24hUsd: number;
  private maxSpreadPct: number;
  private maxVolatility1h: number;
  private minRank: number;
  private maxRank: number;
  private maxAbsZScore: number;

  private stablecoins: Set<string>;
  private blacklisted: Set<string>;
  private whitelisted: Set<string>;

  private metricsCache: Map<string, CoinMetrics> = new Map();
  private cacheTtlMs = 5 * 60 * 1000; // 5 mins

  constructor(config: CoinFilterConfig = {}) {
    this.minVolume24hUsd = config.minVolume24hUsd ?? 10_000_000; // Consistent with server.ts
    this.maxSpreadPct = config.maxSpreadPct ?? 0.0050; // 0.50% max spread
    this.maxVolatility1h = config.maxVolatility1h ?? 0.30; // 30% max
    this.minRank = config.minRank ?? 1;
    this.maxRank = config.maxRank ?? 300;
    this.maxAbsZScore = config.maxAbsZScore ?? 5.5; // Reject Z > 5.5

    this.stablecoins = new Set(DEFAULT_STABLECOINS);
    this.blacklisted = new Set(config.blacklist || []);
    this.whitelisted = new Set(config.whitelist || INSTITUTIONAL_ALLOWED_COINS);
  }

  public addCustomCoin(symbol: string): void {
    const formatted = symbol.trim().toUpperCase().replace(/[-_]/g, '');
    const fullSym = formatted.endsWith('USDT') ? formatted : `${formatted}USDT`;
    this.whitelisted.add(fullSym);
    this.blacklisted.delete(fullSym);
  }

  public removeCustomCoin(symbol: string): void {
    const formatted = symbol.trim().toUpperCase().replace(/[-_]/g, '');
    const fullSym = formatted.endsWith('USDT') ? formatted : `${formatted}USDT`;
    this.whitelisted.delete(fullSym);
  }

  public getWhitelistedCoins(): string[] {
    return Array.from(this.whitelisted);
  }

  public isStablecoin(symbol: string): boolean {
    const base = symbol.replace(/[-_]/g, '').replace('USDT', '').replace('USDC', '').toUpperCase();
    return this.stablecoins.has(base);
  }

  public calculateLiquidityScore(volume24hUsd: number, spreadPct: number): number {
    let volScore = 0;
    if (volume24hUsd >= 1_000_000_000) volScore = 50;
    else if (volume24hUsd >= 100_000_000) volScore = 40;
    else if (volume24hUsd >= 10_000_000) volScore = 25;
    else if (volume24hUsd >= 1_000_000) volScore = 10;

    let spreadScore = 0;
    if (spreadPct <= 0.0001) spreadScore = 50;
    else if (spreadPct <= 0.0005) spreadScore = 35;
    else if (spreadPct <= 0.0010) spreadScore = 20;
    else if (spreadPct <= 0.0020) spreadScore = 10;

    return volScore + spreadScore;
  }

  public updateMetrics(
    symbol: string,
    price: number,
    volume24hUsd: number,
    spreadPct: number,
    volatility1h: number = 0.02,
    zScore: number = 0
  ): CoinMetrics {
    const isStable = this.isStablecoin(symbol);
    const liquidityScore = this.calculateLiquidityScore(volume24hUsd, spreadPct);

    const metrics: CoinMetrics = {
      symbol,
      price,
      volume24hUsd,
      liquidityScore,
      spreadPct,
      volatility1h,
      rankByVolume: 0,
      lastZScore: zScore,
      isStablecoin: isStable,
      isNewListing: false,
      lastUpdated: Date.now()
    };

    this.metricsCache.set(symbol, metrics);
    return metrics;
  }

  public calculateRanks(symbolsList?: string[]) {
    const entries = Array.from(this.metricsCache.values());
    entries.sort((a, b) => b.volume24hUsd - a.volume24hUsd);
    entries.forEach((m, idx) => {
      m.rankByVolume = idx + 1;
    });
  }

  public isTradeable(
    symbol: string,
    overrideMetrics?: CoinMetrics,
    zScore?: number
  ): TradeableCheckResult {
    const metrics = overrideMetrics || this.metricsCache.get(symbol);

    if (this.whitelisted.size > 0 && !this.whitelisted.has(symbol)) {
      return { isTradeable: false, reason: `NOT_WHITELISTED (${symbol})` };
    }

    if (this.blacklisted.has(symbol)) {
      return { isTradeable: false, reason: `BLACKLISTED (${symbol})` };
    }

    if (this.isStablecoin(symbol)) {
      return { isTradeable: false, reason: `STABLECOIN (${symbol})` };
    }

    if (!metrics) {
      return { isTradeable: false, reason: `NO_METRICS (${symbol})` };
    }

    if (metrics.volume24hUsd < this.minVolume24hUsd) {
      return {
        isTradeable: false,
        reason: `LOW_VOLUME ($${(metrics.volume24hUsd / 1e6).toFixed(1)}M < $${(this.minVolume24hUsd / 1e6).toFixed(0)}M)`
      };
    }

    const realSpreadPct = metrics.spreadPct > 1 ? metrics.spreadPct / 100 : metrics.spreadPct;
    if (realSpreadPct > this.maxSpreadPct) {
      return {
        isTradeable: false,
        reason: `HIGH_SPREAD (${(realSpreadPct * 100).toFixed(3)}% > ${(this.maxSpreadPct * 100).toFixed(2)}%)`
      };
    }

    if (metrics.volatility1h > this.maxVolatility1h) {
      return {
        isTradeable: false,
        reason: `HIGH_VOLATILITY (${(metrics.volatility1h * 100).toFixed(1)}% > ${(this.maxVolatility1h * 100).toFixed(0)}%)`
      };
    }

    if (metrics.rankByVolume > 0 && (metrics.rankByVolume < this.minRank || metrics.rankByVolume > this.maxRank)) {
      return {
        isTradeable: false,
        reason: `BAD_RANK (#${metrics.rankByVolume} outside #${this.minRank}-#${this.maxRank})`
      };
    }

    const effectiveZ = zScore !== undefined ? zScore : metrics.lastZScore;
    if (Math.abs(effectiveZ) > this.maxAbsZScore) {
      return {
        isTradeable: false,
        reason: `EXTREME_Z (|${effectiveZ.toFixed(2)}| > ${this.maxAbsZScore})`
      };
    }

    return { isTradeable: true, reason: 'OK' };
  }

  public filterSymbols(
    symbols: string[],
    zScores?: Map<string, number>
  ): Map<string, TradeableCheckResult> {
    const results = new Map<string, TradeableCheckResult>();
    for (const sym of symbols) {
      const z = zScores?.get(sym);
      results.set(sym, this.isTradeable(sym, undefined, z));
    }
    return results;
  }

  public getFilteredList(
    symbols: string[],
    zScores?: Map<string, number>
  ): string[] {
    const results = this.filterSymbols(symbols, zScores);
    const valid: string[] = [];
    results.forEach((res, sym) => {
      if (res.isTradeable) valid.push(sym);
    });
    return valid;
  }

  public getReport(symbols: string[], zScores?: Map<string, number>): string {
    const results = this.filterSymbols(symbols, zScores);
    const tradeable: string[] = [];
    const rejected: Map<string, string[]> = new Map();

    results.forEach((res, sym) => {
      if (res.isTradeable) {
        tradeable.push(sym);
      } else {
        const key = res.reason.split(' ')[0];
        if (!rejected.has(key)) rejected.set(key, []);
        rejected.get(key)!.push(sym);
      }
    });

    const lines: string[] = [
      '==================================================',
      '🔍 Safe Coin Filter Execution Report',
      '==================================================',
      `✅ Tradeable Coins: ${tradeable.length}/${symbols.length}`,
      tradeable.length > 0 ? `   ${tradeable.slice(0, 10).join(', ')}${tradeable.length > 10 ? ` (+${tradeable.length - 10} more)` : ''}` : '   None',
      `❌ Rejected Coins: ${symbols.length - tradeable.length}/${symbols.length}`
    ];

    rejected.forEach((coins, reasonKey) => {
      lines.push(`   ${reasonKey}: ${coins.length} coins`);
    });

    lines.push('==================================================');
    return lines.join('\n');
  }
}
