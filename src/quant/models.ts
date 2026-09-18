export interface KalmanState {
  x: [number, number]; // [Beta, Velocity]
  P: [[number, number], [number, number]]; // Covariance Matrix
}

export class QuantModels {
  /**
   * مرشح كالمان التكيفي لتقدير نسبة التحوط (Beta) لحظياً
   */
  static kalmanFilter(measurement: number, prevState: KalmanState, dt: number = 1): KalmanState {
    const F: [[number, number], [number, number]] = [[1, dt], [0, 1]];
    const H: [number, number] = [1, 0];
    const Q: [[number, number], [number, number]] = [[0.01, 0], [0, 0.01]];
    const R = 0.1;

    // 1. Predict
    const xPred: [number, number] = [
      F[0][0] * prevState.x[0] + F[0][1] * prevState.x[1],
      F[1][0] * prevState.x[0] + F[1][1] * prevState.x[1]
    ];
    
    const P_pred: [[number, number], [number, number]] = [
      [F[0][0]*prevState.P[0][0] + F[0][1]*prevState.P[1][0], F[0][0]*prevState.P[0][1] + F[0][1]*prevState.P[1][1]],
      [F[1][0]*prevState.P[0][0] + F[1][1]*prevState.P[1][0], F[1][0]*prevState.P[0][1] + F[1][1]*prevState.P[1][1]]
    ];
    
    const P_pred_Q: [[number, number], [number, number]] = [
      [P_pred[0][0] + Q[0][0], P_pred[0][1] + Q[0][1]],
      [P_pred[1][0] + Q[1][0], P_pred[1][1] + Q[1][1]]
    ];

    // 2. Update
    const y = measurement - (H[0] * xPred[0] + H[1] * xPred[1]);
    const S = H[0] * P_pred_Q[0][0] * H[0] + H[1] * P_pred_Q[1][0] * H[0] + R;
    const K: [number, number] = [
      (P_pred_Q[0][0] * H[0] + P_pred_Q[0][1] * H[1]) / S,
      (P_pred_Q[1][0] * H[0] + P_pred_Q[1][1] * H[1]) / S
    ];

    const xUpdated: [number, number] = [xPred[0] + K[0] * y, xPred[1] + K[1] * y];
    const PUpdated: [[number, number], [number, number]] = [
      [(1 - K[0] * H[0]) * P_pred_Q[0][0], (1 - K[0] * H[0]) * P_pred_Q[0][1]],
      [(1 - K[1] * H[1]) * P_pred_Q[1][0], (1 - K[1] * H[1]) * P_pred_Q[1][1]]
    ];

    return { x: xUpdated, P: PUpdated };
  }

  /**
   * حساب عمر النصف (Half-Life) باستخدام نموذج Ornstein-Uhlenbeck
   */
  static calculateHalfLife(prices: number[]): number {
    if (prices.length < 10) return Infinity;
    
    const logPrices = prices.map(p => Math.log(p));
    const returns: number[] = [];
    for (let i = 1; i < logPrices.length; i++) returns.push(logPrices[i] - logPrices[i - 1]);

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;

    const ratio = Math.pow(meanReturn, 2) / (variance || 0.0001);
    const theta = ratio >= 1 ? 0.01 : -Math.log(1 - ratio); 
    
    return theta > 0 ? Math.log(2) / theta : Infinity;
  }

  /**
   * مؤشر هيرست (Hurst Exponent) للتأكد من خاصية الارتداد (Mean-Reversion)
   */
  static calculateHurst(prices: number[]): number {
    if (prices.length < 20) return 0.5;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) returns.push(Math.log(prices[i] / prices[i - 1]));

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length);
    if (stdDev === 0) return 0.5;

    let maxCumDev = 0, minCumDev = 0, cumDev = 0;
    for (const ret of returns) {
      cumDev += (ret - mean);
      if (cumDev > maxCumDev) maxCumDev = cumDev;
      if (cumDev < minCumDev) minCumDev = cumDev;
    }
    
    const hurst = Math.log((maxCumDev - minCumDev) / stdDev) / Math.log(returns.length);
    return Math.max(0, Math.min(1, hurst));
  }

  /**
   * حساب Z-Score المتداول للفارق السعري
   */
  static calculateZScore(prices: number[], window: number = 20): number {
    if (prices.length < window) return 0;
    const slice = prices.slice(-window);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (prices[prices.length - 1] - mean) / stdDev;
  }
}
