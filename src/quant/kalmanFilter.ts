import { AntiCorruptionLayer } from './AntiCorruptionLayer';

export interface KalmanFilterConfig {
  delta?: number; // System noise covariance scaling
  ve?: number;    // Measurement noise variance
  vw?: number;    // Process noise variance
  maxHistory?: number;
}

export class KalmanHedgeRatio {
  private _beta: number = 1.0;
  private _alpha: number = 0.0;
  private _ve: number = 0.0005;
  private _vw: number = 0.0001;
  private _delta: number = 0.0001;
  private P: number[][]; // State covariance matrix (2x2)
  private Q: number[][]; // Process noise covariance matrix (2x2)
  private R: number;     // Measurement noise variance
  
  private betaHistory: number[] = [];
  private spreadHistory: number[] = []; 
  private maxHistory: number;

  constructor(config: KalmanFilterConfig = {}) {
    const delta = config.delta ?? 0.0001;
    const ve = config.ve ?? 0.0005;
    const vw = config.vw ?? 0.0001;
    
    const safeDelta = isFinite(delta) && delta > 0 ? delta : 0.0001;
    const safeVe = isFinite(ve) && ve > 0 ? ve : 0.0005;
    const safeVw = isFinite(vw) && vw > 0 ? vw : 0.0001;

    this._delta = safeDelta;
    this._ve = safeVe;
    this._vw = safeVw;

    this.P = [[safeDelta, 0], [0, safeDelta]];
    this.Q = [[safeVw, 0], [0, safeVw]];
    this.R = safeVe;
    this.maxHistory = config.maxHistory ?? 1000;
  }

  get beta(): number { return this._beta; }
  get alpha(): number { return this._alpha; }
  get ve(): number { return this.R; }
  get vw(): number { return this.Q[0][0]; }
  get delta(): number { return this._delta; }

  public updateParameters(config: KalmanFilterConfig): void {
    if (config.ve !== undefined && isFinite(config.ve) && config.ve > 0) {
      this.R = config.ve;
      this._ve = config.ve;
    }
    if (config.vw !== undefined && isFinite(config.vw) && config.vw > 0) {
      this.Q = [[config.vw, 0], [0, config.vw]];
      this._vw = config.vw;
    }
    if (config.delta !== undefined && isFinite(config.delta) && config.delta > 0) {
      this._delta = config.delta;
    }
  }

  set beta(val: number) {
    const v = AntiCorruptionLayer.validateBeta(val, 'kalman');
    this._beta = v.valid ? v.value : 1.0;
  }
  set alpha(val: number) {
    const v = AntiCorruptionLayer.validateAlpha(val, 'kalman');
    this._alpha = v.valid ? v.value : 0.0;
  }

  /**
   * Update state given price_A (dependent) and price_B (independent)
   */
  public update(priceA: number, priceB: number): { beta: number; alpha: number; spread: number } {
    const priceACheck = AntiCorruptionLayer.validatePrice(priceA, 'AssetA');
    if (!priceACheck.valid) {
      return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
    }

    const priceBCheck = AntiCorruptionLayer.validatePrice(priceB, 'AssetB');
    if (!priceBCheck.valid) {
      return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
    }

    try {
      // Measurement vector H = [priceB, 1.0]
      const H = [priceB, 1.0];
      const y = priceA;

      // Prior state prediction x_pred = [beta, alpha]
      const xPred = [this._beta, this._alpha];

      // Prior covariance P_pred = P + Q
      const PPred = [
        [this.P[0][0] + this.Q[0][0], this.P[0][1] + this.Q[0][1]],
        [this.P[1][0] + this.Q[1][0], this.P[1][1] + this.Q[1][1]]
      ];

      PPred[0][0] = Math.max(0, PPred[0][0]);
      PPred[1][1] = Math.max(0, PPred[1][1]);

      // Innovation y_tilde = y - H * x_pred
      const yHat = H[0] * xPred[0] + H[1] * xPred[1];
      const innovation = y - yHat;

      if (!isFinite(innovation) || isNaN(innovation)) {
        return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
      }

      // Innovation covariance S = H * P_pred * H^T + R
      const S = (H[0] * PPred[0][0] + H[1] * PPred[1][0]) * H[0] +
                (H[0] * PPred[0][1] + H[1] * PPred[1][1]) * H[1] + this.R;

      const sCheck = AntiCorruptionLayer.validateInnovationCovariance(S, 'kalman');
      if (!sCheck.valid) {
        const reset = AntiCorruptionLayer.getResetKalmanState(this._beta, this._alpha);
        this._beta = reset.beta;
        this._alpha = reset.alpha;
        this.P = reset.P;
        return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
      }

      // Kalman gain K = P_pred * H^T / S (2x1)
      const K = [
        (PPred[0][0] * H[0] + PPred[0][1] * H[1]) / S,
        (PPred[1][0] * H[0] + PPred[1][1] * H[1]) / S
      ];

      const kCheck = AntiCorruptionLayer.validateKalmanGain(K, 'kalman');
      if (!kCheck.valid) {
        const reset = AntiCorruptionLayer.getResetKalmanState(this._beta, this._alpha);
        this._beta = reset.beta;
        this._alpha = reset.alpha;
        this.P = reset.P;
        return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
      }

      // Updated state x_new = x_pred + K * innovation
      let newBeta = xPred[0] + K[0] * innovation;
      let newAlpha = xPred[1] + K[1] * innovation;

      newBeta = Math.max(-100, Math.min(100, newBeta));
      newAlpha = Math.max(-100000, Math.min(100000, newAlpha));

      if (!isFinite(newBeta) || isNaN(newBeta)) newBeta = xPred[0];
      if (!isFinite(newAlpha) || isNaN(newAlpha)) newAlpha = xPred[1];

      this._beta = newBeta;
      this._alpha = newAlpha;

      // Updated covariance P = (I - K * H) * P_pred
      const I_KH = [
        [1 - K[0] * H[0], -K[0] * H[1]],
        [-K[1] * H[0], 1 - K[1] * H[1]]
      ];

      const newP = [
        [
          I_KH[0][0] * PPred[0][0] + I_KH[0][1] * PPred[1][0],
          I_KH[0][0] * PPred[0][1] + I_KH[0][1] * PPred[1][1]
        ],
        [
          I_KH[1][0] * PPred[0][0] + I_KH[1][1] * PPred[1][0],
          I_KH[1][0] * PPred[0][1] + I_KH[1][1] * PPred[1][1]
        ]
      ];

      if (Number.isFinite(newP[0][0]) && Number.isFinite(newP[1][1])) {
        this.P = newP;
      }

      // Symmetry restoration
      this.P[0][1] = this.P[1][0] = (this.P[0][1] + this.P[1][0]) / 2;
      this.P[0][0] = Math.max(1e-10, this.P[0][0]);
      this.P[1][1] = Math.max(1e-10, this.P[1][1]);

      // Calculate the ACTUAL spread (residual) for mean-reversion analysis
      const actualSpread = priceA - (this._beta * priceB + this._alpha);
      const spreadCheck = AntiCorruptionLayer.validateSpread(actualSpread, 'kalman');

      this.betaHistory.push(this._beta);
      if (this.betaHistory.length > this.maxHistory) this.betaHistory.shift();

      if (spreadCheck.valid) {
        this.spreadHistory.push(actualSpread);
        if (this.spreadHistory.length > this.maxHistory) this.spreadHistory.shift();
        return { 
          beta: this._beta, 
          alpha: this._alpha, 
          spread: actualSpread 
        };
      } else {
        return { beta: this._beta, alpha: this._alpha, spread: 0.0 };
      }
    } catch (err) {
      console.error('[KalmanFilter] Unexpected computation error, performing state reset:', err);
      this.reset();
      return { beta: 1.0, alpha: 0.0, spread: 0.0 };
    }
  }

  /**
   * Calculate Z-Score over sliding window based on the ACTUAL spread history
   * with adaptive relative volatility threshold
   */
  public getZScore(window = 30): number {
    const clean = AntiCorruptionLayer.sanitizeArray(this.spreadHistory, 'spreadHistory');

    // Lowered from 10 to 3 for fast institutional calibration
    if (clean.length < Math.min(3, window)) {
      return 0.0;
    }

    const recent = clean.slice(-window);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (recent.length - 1);
    const std = Math.sqrt(variance);

    const minStd = Math.max(1e-5, Math.abs(mean) * 1e-3);
    if (!Number.isFinite(std) || std < minStd) return 0.0;

    const rawZ = (recent[recent.length - 1] - mean) / std;
    return Number.isFinite(rawZ) ? rawZ : 0.0;
  }

  /**
   * Check if Beta exhibits dynamic variance
   */
  public isDynamic(): boolean {
    if (this.betaHistory.length < 20) return false;
    const clean = AntiCorruptionLayer.sanitizeArray(this.betaHistory, 'betaHistory');
    if (clean.length < 20) return false;

    const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
    const variance = clean.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (clean.length - 1);
    const threshold = 0.001 * Math.max(0.01, Math.abs(mean));
    return Math.sqrt(variance) > threshold;
  }

  public getHistory(): { beta: number[]; spread: number[] } {
    return {
      beta: [...this.betaHistory],
      spread: [...this.spreadHistory]
    };
  }

  public sanitize(): void {
    this.spreadHistory = AntiCorruptionLayer.sanitizeArray(this.spreadHistory, 'spreadHistory');
    this.betaHistory = AntiCorruptionLayer.sanitizeArray(this.betaHistory, 'betaHistory');
  }
  
  public reset() {
    this._beta = 1.0;
    this._alpha = 0.0;
    this.P = [[0.001, 0], [0, 0.001]];
    this.betaHistory = [];
    this.spreadHistory = [];
  }
}
