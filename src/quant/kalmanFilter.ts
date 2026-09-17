/**
 * Kalman Filter for Dynamic Hedge Ratio & Spread Z-Score
 * Implements Kalman Filter to estimate dynamic Beta and Alpha between Asset A and Asset B.
 */

export interface KalmanFilterConfig {
  delta?: number; // System noise covariance scaling
  ve?: number;    // Measurement noise variance
  vw?: number;    // Process noise variance
}

export class KalmanHedgeRatio {
  public beta: number = 1.0;
  public alpha: number = 0.0;
  private P: number[][]; // State covariance matrix (2x2)
  private Q: number[][]; // Process noise covariance matrix (2x2)
  private R: number;     // Measurement noise variance

  private betaHistory: number[] = [];
  private spreadHistory: number[] = [];
  private maxHistory = 1000;

  constructor(config: KalmanFilterConfig = {}) {
    const delta = config.delta ?? 0.001;
    const ve = config.ve ?? 0.001;
    const vw = config.vw ?? 0.001;

    this.P = [[delta, 0], [0, delta]];
    this.Q = [[vw, 0], [0, vw]];
    this.R = ve;
  }

  /**
   * Update state given price_A (dependent) and price_B (independent)
   */
  public update(priceA: number, priceB: number): { beta: number; alpha: number; spread: number } {
    if (priceB <= 0) {
      return { beta: this.beta, alpha: this.alpha, spread: 0.0 };
    }

    // Measurement vector H = [priceB, 1.0]
    const H = [priceB, 1.0];
    const y = priceA;

    // Prior state prediction x_pred = [beta, alpha]
    const xPred = [this.beta, this.alpha];

    // Prior covariance P_pred = P + Q
    const PPred = [
      [this.P[0][0] + this.Q[0][0], this.P[0][1] + this.Q[0][1]],
      [this.P[1][0] + this.Q[1][0], this.P[1][1] + this.Q[1][1]]
    ];

    // Innovation y_tilde = y - H * x_pred
    const yHat = H[0] * xPred[0] + H[1] * xPred[1];
    const innovation = y - yHat;

    // Innovation covariance S = H * P_pred * H^T + R
    const S = (H[0] * PPred[0][0] + H[1] * PPred[1][0]) * H[0] +
              (H[0] * PPred[0][1] + H[1] * PPred[1][1]) * H[1] + this.R;

    // Kalman gain K = P_pred * H^T / S (2x1)
    const K = [
      (PPred[0][0] * H[0] + PPred[0][1] * H[1]) / S,
      (PPred[1][0] * H[0] + PPred[1][1] * H[1]) / S
    ];

    // Updated state x_new = x_pred + K * innovation
    this.beta = xPred[0] + K[0] * innovation;
    this.alpha = xPred[1] + K[1] * innovation;

    // Updated covariance P = (I - K * H) * P_pred
    const I_KH = [
      [1 - K[0] * H[0], -K[0] * H[1]],
      [-K[1] * H[0], 1 - K[1] * H[1]]
    ];

    this.P = [
      [
        I_KH[0][0] * PPred[0][0] + I_KH[0][1] * PPred[1][0],
        I_KH[0][0] * PPred[0][1] + I_KH[0][1] * PPred[1][1]
      ],
      [
        I_KH[1][0] * PPred[0][0] + I_KH[1][1] * PPred[1][0],
        I_KH[1][0] * PPred[0][1] + I_KH[1][1] * PPred[1][1]
      ]
    ];

    const spread = innovation;

    this.betaHistory.push(this.beta);
    if (this.betaHistory.length > this.maxHistory) this.betaHistory.shift();

    this.spreadHistory.push(spread);
    if (this.spreadHistory.length > this.maxHistory) this.spreadHistory.shift();

    return { beta: this.beta, alpha: this.alpha, spread };
  }

  /**
   * Calculate Z-Score over sliding window
   */
  public getZScore(window = 100): number {
    if (this.spreadHistory.length < Math.min(10, window)) {
      return 0.0;
    }

    const recent = this.spreadHistory.slice(-window);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    const std = Math.sqrt(variance);

    if (std < 1e-8) return 0.0;
    return (recent[recent.length - 1] - mean) / std;
  }

  /**
   * Check if Beta exhibits dynamic variance
   */
  public isDynamic(): boolean {
    if (this.betaHistory.length < 20) return true;
    const mean = this.betaHistory.reduce((s, v) => s + v, 0) / this.betaHistory.length;
    const variance = this.betaHistory.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / this.betaHistory.length;
    return Math.sqrt(variance) > 0.001;
  }

  public getHistory(): { beta: number[]; spread: number[] } {
    return {
      beta: [...this.betaHistory],
      spread: [...this.spreadHistory]
    };
  }
}
