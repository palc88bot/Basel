/**
 * Sanity Checks - Institutional Risk and Mathematical Bounds Verifier
 * Ported and unified from quantitative specification
 */

export class SanityChecks {
  static readonly MAX_Z_SCORE_CIRCUIT_BREAKER = 10.0; // Absolute catastrophic limit
  static readonly MAX_Z_SCORE_TRADEABLE = 5.5;        // Maximum allowable entry Z-score
  static readonly MIN_HALF_LIFE = 0.5;                // 0.5 seconds high-frequency instant arbitrage minimum
  static readonly MAX_HALF_LIFE = 60.0;               // 60 seconds maximum mean-reversion speed
  static readonly MIN_VOLUME_USD = 10_000_000.0;      // $10M min 24h volume
  static readonly MAX_SPREAD_PERCENT = 0.0050;        // 0.50% max spread

  static isValidNumber(value: any, nameOrAllowNegative?: string | boolean, allowNegative = false): boolean {
    if (value === null || value === undefined) return false;
    const isNegativeAllowed = typeof nameOrAllowNegative === 'boolean' ? nameOrAllowNegative : allowNegative;
    const num = Number(value);
    if (Number.isNaN(num) || !Number.isFinite(num)) return false;
    if (!isNegativeAllowed && num < 0) return false;
    return true;
  }

  static validateZScore(zScore: number): boolean {
    if (!this.isValidNumber(zScore, true)) return false;
    const absZ = Math.abs(zScore);
    if (absZ > this.MAX_Z_SCORE_CIRCUIT_BREAKER) {
      console.warn(`🚨 SANITY CHECK CIRCUIT BREAKER: Extreme catastrophic Z-Score ${zScore}`);
      return false;
    }
    if (absZ > this.MAX_Z_SCORE_TRADEABLE) {
      return false;
    }
    return true;
  }

  static validateHalfLife(halfLife: number): boolean {
    if (!this.isValidNumber(halfLife, false)) return false;
    if (halfLife < this.MIN_HALF_LIFE || halfLife > this.MAX_HALF_LIFE) {
      return false;
    }
    return true;
  }

  static validateVolume(volume: number): boolean {
    if (!this.isValidNumber(volume, false)) return false;
    return volume >= this.MIN_VOLUME_USD;
  }

  static validateSpread(spread: number): boolean {
    if (!this.isValidNumber(spread, false)) return false;
    const realSpread = spread > 1 ? spread / 100 : spread;
    return realSpread <= this.MAX_SPREAD_PERCENT;
  }
}
