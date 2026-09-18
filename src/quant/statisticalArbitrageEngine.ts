/**
 * OMEGA QuantBrain - Statistical Arbitrage Engine
 * ================================================
 * Real-time Pair Mean-Reversion Engine combining Integration of Kalman State
 * and Ornstein-Uhlenbeck (OU) stochastic process modeling.
 */

import { KalmanHedgeRatio } from './kalmanFilter';
import { AntiCorruptionLayer } from './AntiCorruptionLayer';

export interface OUParameters {
  theta: number;          // Speed of mean reversion
  mu: number;             // Long-term equilibrium mean
  sigma: number;          // Process volatility
  sigmaEq: number;        // Equilibrium standard deviation
  halfLifeSec: number;    // OU Half-life in seconds
  zScoreOU: number;       // Ornstein-Uhlenbeck Z-Score
  rSquared: number;       // Model goodness of fit
  isValid: boolean;
}

export interface StatArbPairState {
  pairKey: string;
  symbolA: string;
  symbolB: string;
  priceA: number;
  priceB: number;
  beta: number;
  alpha: number;
  spread: number;
  ouParams: OUParameters;
  signal: 'BUY_SPREAD' | 'SELL_SPREAD' | 'EXIT' | 'NEUTRAL';
  signalConfidence: number;
  lastUpdatedMs: number;
  tradeExecuted: boolean;
}

export interface StatArbEngineConfig {
  entryZThreshold?: number;     // Default |Z| >= 2.0
  exitZThreshold?: number;      // Default |Z| <= 0.2
  stopLossZThreshold?: number;  // Default |Z| >= 4.0
  minHalfLifeSec?: number;      // Default 10 seconds
  maxHalfLifeSec?: number;      // Default 3600 seconds (1 hour)
  sampleIntervalSec?: number;   // Default 1 second
  maxSpreadHistory?: number;    // Default 500 samples
}

export class StatisticalArbitrageEngine {
  private static instance: StatisticalArbitrageEngine | null = null;

  private isBotRunning: boolean = false;
  private config: Required<StatArbEngineConfig>;
  private kalmanMap: Map<string, KalmanHedgeRatio> = new Map();
  private pairStates: Map<string, StatArbPairState> = new Map();
  private spreadHistories: Map<string, number[]> = new Map();

  constructor(config: StatArbEngineConfig = {}) {
    this.config = {
      entryZThreshold: config.entryZThreshold ?? 2.0,
      exitZThreshold: config.exitZThreshold ?? 0.2,
      stopLossZThreshold: config.stopLossZThreshold ?? 3.5,
      minHalfLifeSec: config.minHalfLifeSec ?? 0.5,
      maxHalfLifeSec: config.maxHalfLifeSec ?? 60,
      sampleIntervalSec: config.sampleIntervalSec ?? 1,
      maxSpreadHistory: config.maxSpreadHistory ?? 1000,
    };
  }

  public static getInstance(config?: StatArbEngineConfig): StatisticalArbitrageEngine {
    if (!StatisticalArbitrageEngine.instance) {
      StatisticalArbitrageEngine.instance = new StatisticalArbitrageEngine(config);
    }
    return StatisticalArbitrageEngine.instance;
  }

  /**
   * Bind the bot running state (controls whether execution/trading signals are triggered)
   */
  public bindBotRunningState(getRunningState: () => boolean): void {
    this.isBotRunning = getRunningState();
  }

  public setBotRunning(running: boolean): void {
    this.isBotRunning = running;
  }

  public getBotRunning(): boolean {
    return this.isBotRunning;
  }

  /**
   * Core Update: Process tick pair (SymbolA, SymbolB) using Kalman State & OU Process
   */
  public processPairTick(
    pairKey: string,
    symbolA: string,
    symbolB: string,
    priceA: number,
    priceB: number,
    dtSec: number = 1
  ): StatArbPairState {
    const now = Date.now();

    // 1. Validate prices
    const valA = AntiCorruptionLayer.validatePrice(priceA, symbolA);
    const valB = AntiCorruptionLayer.validatePrice(priceB, symbolB);

    if (!valA.valid || !valB.valid) {
      return this.getFallbackState(pairKey, symbolA, symbolB, priceA, priceB, now);
    }

    // 2. Get or initialize Kalman Hedge Ratio state
    let kalman = this.kalmanMap.get(pairKey);
    if (!kalman) {
      kalman = new KalmanHedgeRatio({ delta: 0.0001, ve: 0.0005, vw: 0.0001 });
      this.kalmanMap.set(pairKey, kalman);
    }

    // 3. Update Kalman Filter State vector [beta, alpha] and compute exact Spread
    const { beta, alpha, spread } = kalman.update(priceA, priceB);

    // 4. Record Spread History
    let spreadHistory = this.spreadHistories.get(pairKey) || [];
    spreadHistory.push(spread);
    if (spreadHistory.length > this.config.maxSpreadHistory) {
      spreadHistory.shift();
    }
    this.spreadHistories.set(pairKey, spreadHistory);

    // 5. Fit Ornstein-Uhlenbeck (OU) Mean-Reversion Model on Spread History
    const ouParams = this.fitOrnsteinUhlenbeckProcess(spreadHistory, dtSec);

    // 6. Generate Trading Signal & Signal Confidence
    let signal: 'BUY_SPREAD' | 'SELL_SPREAD' | 'EXIT' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.0;

    if (this.isBotRunning && ouParams.isValid) {
      const zOU = ouParams.zScoreOU;
      const hl = ouParams.halfLifeSec;

      const isHalfLifeValid = hl >= this.config.minHalfLifeSec && hl <= this.config.maxHalfLifeSec;

      if (isHalfLifeValid) {
        if (zOU <= -this.config.entryZThreshold) {
          signal = 'BUY_SPREAD'; // Buy A, Short B
          confidence = Math.min(1.0, Math.abs(zOU) / 3.0) * (ouParams.rSquared || 0.5);
        } else if (zOU >= this.config.entryZThreshold) {
          signal = 'SELL_SPREAD'; // Short A, Buy B
          confidence = Math.min(1.0, Math.abs(zOU) / 3.0) * (ouParams.rSquared || 0.5);
        } else if (Math.abs(zOU) <= this.config.exitZThreshold) {
          signal = 'EXIT';
          confidence = 1.0;
        }
      }
    }

    const pairState: StatArbPairState = {
      pairKey,
      symbolA,
      symbolB,
      priceA,
      priceB,
      beta,
      alpha,
      spread,
      ouParams,
      signal,
      signalConfidence: confidence,
      lastUpdatedMs: now,
      tradeExecuted: false,
    };

    this.pairStates.set(pairKey, pairState);
    return pairState;
  }

  /**
   * Fit Ornstein-Uhlenbeck stochastic process via discrete OLS AR(1):
   * S_t = a + b * S_{t-1} + e_t
   */
  public fitOrnsteinUhlenbeckProcess(spreads: number[], dtSec: number = 1): OUParameters {
    const sanitized = AntiCorruptionLayer.sanitizeArray(spreads, 'spreads');

    const defaultOU: OUParameters = {
      theta: 0,
      mu: 0,
      sigma: 0,
      sigmaEq: 0,
      halfLifeSec: 180,
      zScoreOU: 0,
      rSquared: 0,
      isValid: false,
    };

    if (sanitized.length < 10) {
      return defaultOU;
    }

    // Prepare x = S_{t-1}, y = S_t
    const N = sanitized.length - 1;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < N; i++) {
      const x = sanitized[i];
      const y = sanitized[i + 1];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const denom = N * sumX2 - sumX * sumX;
    if (Math.abs(denom) < 1e-12) {
      return defaultOU;
    }

    const b = (N * sumXY - sumX * sumY) / denom; // AR(1) coefficient
    const a = (sumY - b * sumX) / N;            // AR(1) intercept

    // Check mean-reversion stability condition: 0 < b < 1
    if (b <= 0 || b >= 1.0) {
      return defaultOU;
    }

    // Estimate residuals & R^2
    let sse = 0;
    let sst = 0;
    const meanY = sumY / N;

    for (let i = 0; i < N; i++) {
      const x = sanitized[i];
      const y = sanitized[i + 1];
      const pred = a + b * x;
      const res = y - pred;
      sse += res * res;
      sst += (y - meanY) * (y - meanY);
    }

    const varRes = sse / (N - 2 > 0 ? N - 2 : 1);
    const rSquared = sst > 1e-12 ? Math.max(0, 1 - sse / sst) : 0;

    // OU Continuous parameters derivation:
    // b = exp(-theta * dt) => theta = -ln(b) / dt
    const theta = -Math.log(b) / dtSec;
    if (!Number.isFinite(theta) || theta <= 0) {
      return defaultOU;
    }

    // OU Mean mu = a / (1 - b)
    const mu = a / (1 - b);

    // OU Half-life t_{1/2} = ln(2) / theta
    const halfLifeSec = Math.log(2) / theta;

    // OU Equilibrium Variance: sigma_eq^2 = varRes / (1 - b^2)
    const sigmaEq2 = varRes / (1 - b * b);
    const sigmaEq = Math.sqrt(Math.max(1e-12, sigmaEq2));

    // Current spread value
    const currentSpread = sanitized[sanitized.length - 1];

    // OU Z-Score = (Spread_t - mu) / sigma_eq
    const zScoreOU = (currentSpread - mu) / sigmaEq;

    const boundedZ = Math.max(-10, Math.min(10, Number.isFinite(zScoreOU) ? zScoreOU : 0));

    return {
      theta,
      mu,
      sigma: Math.sqrt(Math.max(0, varRes * (2 * theta) / (1 - Math.exp(-2 * theta * dtSec)))),
      sigmaEq,
      halfLifeSec: Number.isFinite(halfLifeSec) ? halfLifeSec : 180,
      zScoreOU: boundedZ,
      rSquared,
      isValid: Number.isFinite(boundedZ) && Number.isFinite(halfLifeSec),
    };
  }

  public getAllPairStates(): StatArbPairState[] {
    return Array.from(this.pairStates.values());
  }

  public getPairState(pairKey: string): StatArbPairState | undefined {
    return this.pairStates.get(pairKey);
  }

  public reset(): void {
    this.kalmanMap.clear();
    this.pairStates.clear();
    this.spreadHistories.clear();
  }

  private getFallbackState(
    pairKey: string,
    symbolA: string,
    symbolB: string,
    priceA: number,
    priceB: number,
    now: number
  ): StatArbPairState {
    return {
      pairKey,
      symbolA,
      symbolB,
      priceA,
      priceB,
      beta: 1.0,
      alpha: 0.0,
      spread: 0.0,
      ouParams: {
        theta: 0,
        mu: 0,
        sigma: 0,
        sigmaEq: 0,
        halfLifeSec: 180,
        zScoreOU: 0,
        rSquared: 0,
        isValid: false,
      },
      signal: 'NEUTRAL',
      signalConfidence: 0,
      lastUpdatedMs: now,
      tradeExecuted: false,
    };
  }
}
