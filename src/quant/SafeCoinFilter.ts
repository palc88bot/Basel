/**
 * Safe Coin Filter - Strict Institutional Whitelist and Blacklist Enforcer
 */

import { SanityChecks } from './SanityChecks';

// 🚨 Absolute System Blacklist: Permanently forbidden from trading
export const ABSOLUTE_BLACKLIST = new Set([
  'PLAYUSDT', 'HEIUSDT', 'AKEUSDT', 'POWERUSDT', 'LSKUSDT',
  'USDCUSDT', 'BUSDUSDT', 'DAIUSDT', 'TUSDUSDT', 'FRAXUSDT',
  'FDUSDUSDT', 'PYUSDUSDT', 'EURUSDT', 'USTCUSDT', 'LUNAUSDT'
]);

export const DEFAULT_STABLECOIN_BASES = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX',
  'FDUSD', 'PYUSD', 'GUSD', 'EURS', 'USDD', 'USD', 'USDE'
]);

export interface CoinFilterConfig {
  minVolume24hUsd?: number;
  maxSpreadPct?: number;
  maxVolatility1h?: number;
  minRank?: number;
  maxRank?: number;
  maxAbsZScore?: number;
  blacklist?: string[];
  whitelist?: string[];
}

export class SafeCoinFilter {
  private minVolume24hUsd: number;
  private maxSpreadPct: number;
  private maxAbsZScore: number;
  private blacklisted: Set<string>;
  private stablecoins: Set<string>;

  constructor(config: CoinFilterConfig = {}) {
    this.minVolume24hUsd = config.minVolume24hUsd ?? 10_000_000;
    this.maxSpreadPct = config.maxSpreadPct ?? 0.0050; // 0.50%
    this.maxAbsZScore = config.maxAbsZScore ?? 5.5;

    this.blacklisted = new Set([...ABSOLUTE_BLACKLIST, ...(config.blacklist || [])]);
    this.stablecoins = new Set(DEFAULT_STABLECOIN_BASES);
  }

  public isStablecoin(symbol: string): boolean {
    const base = symbol.replace(/[-_]/g, '').replace('USDT', '').replace('USDC', '').toUpperCase();
    return this.stablecoins.has(base);
  }

  public isTradeable(
    symbol: string,
    volume24hUsd?: number,
    zScore?: number
  ): { isTradeable: boolean; reason: string } {
    const cleanSym = symbol.toUpperCase().replace(/[-_]/g, '');

    // 1. Check Blacklist first (Absolute highest priority)
    if (this.blacklisted.has(cleanSym)) {
      return { isTradeable: false, reason: `محظور نظامياً (قائمة سوداء: ${cleanSym})` };
    }

    // 2. Check Stablecoin
    if (this.isStablecoin(cleanSym)) {
      return { isTradeable: false, reason: 'عملة مستقرة (Stablecoin غير قابلة للتحكيم)' };
    }

    // 3. Liquidity & 24h Volume Verification
    if (volume24hUsd !== undefined && volume24hUsd < this.minVolume24hUsd) {
      return {
        isTradeable: false,
        reason: `سيولة منخفضة ($${(volume24hUsd / 1_000_000).toFixed(1)}M < $${(this.minVolume24hUsd / 1_000_000).toFixed(0)}M)`
      };
    }

    // 4. Statistical Deviation Bounds
    if (zScore !== undefined) {
      if (!SanityChecks.validateZScore(zScore)) {
        return { isTradeable: false, reason: `انحراف إحصائي غير صالح أو مفرط (Z=${zScore})` };
      }
      if (Math.abs(zScore) > this.maxAbsZScore) {
        return { isTradeable: false, reason: `انحراف إحصائي مفرط (|Z=${zScore}| > ${this.maxAbsZScore})` };
      }
    }

    return { isTradeable: true, reason: 'صالح ومؤهل للتداول' };
  }

  private metricsCache: Map<string, any> = new Map();

  public updateMetrics(
    symbol: string,
    price: number,
    volume24hUsd: number,
    spreadPct: number,
    volatility1h: number = 0.02,
    zScore: number = 0
  ): any {
    const isStable = this.isStablecoin(symbol);
    const metrics = {
      symbol,
      price,
      volume24hUsd,
      spreadPct,
      volatility1h,
      rankByVolume: 0,
      lastZScore: zScore,
      isStablecoin: isStable,
      lastUpdated: Date.now()
    };
    this.metricsCache.set(symbol, metrics);
    return metrics;
  }

  public calculateRanks(symbolsList?: string[]) {
    const entries = Array.from(this.metricsCache.values());
    entries.sort((a: any, b: any) => b.volume24hUsd - a.volume24hUsd);
    entries.forEach((m: any, idx) => {
      m.rankByVolume = idx + 1;
    });
  }

  public getReport(symbols: string[], zScores?: Map<string, number>): string {
    const tradeable: string[] = [];
    const rejected: Map<string, string[]> = new Map();

    for (const sym of symbols) {
      const z = zScores?.get(sym);
      const metrics = this.metricsCache.get(sym);
      const check = this.isTradeable(sym, metrics?.volume24hUsd, z);
      if (check.isTradeable) {
        tradeable.push(sym);
      } else {
        const key = check.reason.split(' ')[0];
        if (!rejected.has(key)) rejected.set(key, []);
        rejected.get(key)!.push(sym);
      }
    }

    const lines: string[] = [
      '==================================================',
      '🔍 Safe Coin Filter Execution Report (TypeScript Engine)',
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
