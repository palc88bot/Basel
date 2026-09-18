import { QuantModels, KalmanState } from '../quant/models';
import { AdvancedQuantModels, GarchState } from '../quant/advancedModels';
import { FrictionEngine, L2Book } from '../quant/frictionEngine';
import { AtomicExecutor, OrderRequest, ExchangeClient } from '../execution/atomicExecutor';
import { PositionMonitor } from '../monitoring/positionMonitor';
import { CircuitBreakerGuard } from '../quant/circuitBreakerGuard';
import { LatencySlippageMonitor } from '../monitoring/latencySlippageMonitor';
import { NotificationService } from '../services/notificationService';
import { CollateralGuard } from '../quant/collateralGuard';

export class OmegaEngine {
  private frictionEngine: FrictionEngine;
  private executor: AtomicExecutor;
  private kalmanState: KalmanState = { x: [1.0, 0.0], P: [[1000, 0], [0, 1000]] };
  private garchState: GarchState = { omega: 0.00001, alpha: 0.10, beta: 0.85, lastVariance: 0.0002 };

  constructor(private capitalUSD: number, private leverage: number, private client: ExchangeClient) {
    this.frictionEngine = new FrictionEngine();
    this.executor = new AtomicExecutor(client);
  }

  async evaluateAndExecute(
    pricesA: number[], pricesB: number[],
    _currentSpreadBps: number, fundingDiff: number,
    l2BookA: L2Book, l2BookB: L2Book,
    symbolA: string, symbolB: string, qtyA: number, qtyB: number, expectedPriceA: number, expectedPriceB: number
  ) {
    // 0. فحص حارس الطوارئ وقطع الصفقات (Circuit Breaker Guard)
    const cb = CircuitBreakerGuard.getInstance();
    const cbStatus = cb.getStatus();
    if (cbStatus.isTripped) {
      return {
        decision: 'BLOCKED_BY_CIRCUIT_BREAKER',
        reason: cbStatus.tripReason || 'تم تفعيل حارس الطوارئ لحماية الحساب',
        cbStatus
      };
    }

    // 1. الحسابات الكمية الأساسية (Kalman, Half-Life, Hurst)
    const spreadPrices = pricesA.map((p, i) => p - (this.kalmanState.x[0] * pricesB[i]));
    const rawZScore = QuantModels.calculateZScore(spreadPrices, 20);
    const halfLife = QuantModels.calculateHalfLife(spreadPrices);
    const hurst = QuantModels.calculateHurst(spreadPrices);

    // 2. نموذج GARCH(1,1) للتقلب الشرطي وتعديل Z-Score
    const returnsA = pricesA.slice(1).map((p, i) => (p - pricesA[i]) / pricesA[i]);
    const garchRes = AdvancedQuantModels.calculateGarchVolatility(returnsA, this.garchState);
    this.garchState = garchRes.newState;

    // تعديل Z-Score بناءً على التقلب الديناميكي (GARCH Volatility Adjuster)
    const zScore = rawZScore / garchRes.scaledZScoreMultiplier;

    // 3. نموذج ماركوف المخفي (HMM Market Regime Detection)
    const regimeRes = AdvancedQuantModels.detectMarketRegime(spreadPrices, hurst, halfLife);
    if (!regimeRes.isSafeForStatArb) {
      return { 
        decision: 'WAIT', 
        reason: `HMM Regime Blocked: ${regimeRes.regime} (Mean-Reverting Prob: ${(regimeRes.meanRevertingProb * 100).toFixed(0)}%)`,
        regimeRes 
      };
    }

    // 4. نموذج تدفق الأوامر الدقيقة (Order Flow Imbalance - OFI)
    const ofiRes = AdvancedQuantModels.calculateOrderFlowImbalance(l2BookA, l2BookB);
    const isLong = zScore <= -2.0;
    const isShort = zScore >= 2.0;

    if (isLong && !ofiRes.isSupportiveOfLong) {
      return { decision: 'WAIT', reason: 'OFI opposes Long entry (Heavy sell wall detected)', ofiRes };
    }
    if (isShort && !ofiRes.isSupportiveOfShort) {
      return { decision: 'WAIT', reason: 'OFI opposes Short entry (Heavy buy wall detected)', ofiRes };
    }

    // 5. نموذج تحجيم الصفقات التكيفي (Adaptive Kelly Criterion & Volatility Sizing)
    const kellyRes = AdvancedQuantModels.calculateAdaptiveKellySizing(
      this.capitalUSD,
      0.68,
      2.2,
      zScore,
      garchRes.scaledZScoreMultiplier,
      regimeRes.meanRevertingProb
    );

    // 6. فحص الاحتكاك الفعلي (Friction Engine)
    const avgL2: L2Book = {
      bids: [...l2BookA.bids, ...l2BookB.bids],
      asks: [...l2BookA.asks, ...l2BookB.asks],
      spreadBps: (l2BookA.spreadBps + l2BookB.spreadBps) / 2
    };

    const evResult = this.frictionEngine.calculate(
      Math.abs(zScore) * 10,
      kellyRes.positionNotionalUsd,
      avgL2, fundingDiff, halfLife / 60
    );

    if (!evResult.isProfitable) {
      return { decision: 'REJECTED', reason: 'Friction exceeds expected net profit', evResult, kellyRes };
    }

    // 7. التنفيذ الذري لفرصة التحكيم اللحظي ورصد التأخير والانزلاق
    const startTimeMs = Date.now();
    const legA: OrderRequest = { symbol: symbolA, side: zScore > 0 ? 'Sell' : 'Buy', qty: qtyA, expectedPrice: expectedPriceA };
    const legB: OrderRequest = { symbol: symbolB, side: zScore > 0 ? 'Buy' : 'Sell', qty: qtyB, expectedPrice: expectedPriceB };

    const execResult = await this.executor.execute(legA, legB);

    if (execResult.status !== 'SUCCESS') {
      return { decision: 'EXECUTION_FAILED', reason: execResult.reason, details: execResult.details };
    }

    // تسجيل مقاييس الأداء والتأخير (Latency & Slippage Metrics)
    const latMonitor = LatencySlippageMonitor.getInstance();
    const fillPriceA = execResult.details?.legA?.avgPrice || expectedPriceA;
    const latMetrics = latMonitor.recordExecution(symbolA, legA.side, startTimeMs, expectedPriceA, fillPriceA);

    // إرسال إشعار فوري للصفقة (Instant Trade Notification)
    const netPnlEstimateUsd = (evResult.netEvBps / 10000) * kellyRes.positionNotionalUsd;
    NotificationService.getInstance().sendTradeAlert({
      symbolA,
      symbolB,
      action: zScore > 0 ? 'SELL_LEG_A_BUY_LEG_B' : 'BUY_LEG_A_SELL_LEG_B',
      zScore,
      halfLifeSec: Math.round(halfLife),
      expectedPnlUsd: netPnlEstimateUsd
    }).catch(console.error);

    // فحص سلامة الهامش وإعادة التوازن المزدوج (Collateral Guard)
    const collateralState = CollateralGuard.getInstance().evaluateCollateralState([
      { name: 'Binance', equity: this.capitalUSD / 2, usedMargin: kellyRes.positionNotionalUsd / 2 },
      { name: 'Bybit', equity: this.capitalUSD / 2, usedMargin: kellyRes.positionNotionalUsd / 2 }
    ]);

    // 8. المراقبة التلقائية للظروف والإغلاق اللحظي
    const monitor = new PositionMonitor(halfLife, zScore);
    monitor.start();

    return { 
      decision: 'EXECUTED', 
      monitor, 
      zScore, 
      garchRes, 
      regimeRes, 
      ofiRes, 
      kellyRes, 
      evResult, 
      execResult,
      latMetrics,
      collateralState
    };
  }
}

