// src/market/regime-detector.ts
import { MarketData } from '../data/data-buffer';

export type MarketRegime = 
  | 'BULL' 
  | 'BEAR' 
  | 'SIDEWAYS' 
  | 'HIGH_VOLATILITY' 
  | 'TRENDING' 
  | 'CRASH' 
  | 'ACCUMULATION' 
  | 'DISTRIBUTION';

export class RegimeDetector {
  public static detectRegime(data: MarketData): MarketRegime {
    if (data.priceAction < -0.6 || (data.futureReturn && data.futureReturn < -0.05)) {
      return 'CRASH';
    }
    if (data.atrNormalized > 0.75) {
      return 'HIGH_VOLATILITY';
    }
    if (data.momentum > 0.35 && data.rsi > 55) {
      return 'BULL';
    }
    if (data.momentum < -0.35 && data.rsi < 45) {
      return 'BEAR';
    }
    if (Math.abs(data.momentum) > 0.25) {
      return 'TRENDING';
    }
    return 'SIDEWAYS';
  }
}
