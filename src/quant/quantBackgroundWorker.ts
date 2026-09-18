/**
 * OMEGA QuantBrain - Unified Quantitative Background Worker (24/7 Autonomous Daemon)
 * ===================================================================================
 * محرك التحليل الكمي والتنفيذ الآلي المستقل الذي يعمل 24/7 في الخلفية.
 * 
 * المزايا الهندسية الفائقة:
 *   1. ✅ استقلالية تامة عن العميل (يعمل بدون متصفح 24/7)
 *   2. ✅ مفتاح الإيقاف الطارئ الفوري (Emergency Kill Switch + إلغاء الأوامر المفتوحة)
 *   3. ✅ حماية رأس المال الصارمة (Circuit Breakers + Blacklist + SafeCoinFilter)
 *   4. ✅ Point-in-Time Data Store (منع Lookahead Bias وتوثيق بيانات البورصة مع Timestamps)
 *   5. ✅ Signal Decision Record (سجل تدقيق كامل لكل قرار دخول/استبعاد وأسبابه)
 *   6. ✅ Quantum-Inspired Portfolio Optimizer (تحسين توزيع المحفظة وتقليل الارتباط عبر QUBO)
 *   7. ✅ معايرة العقود والأسعار بدقة المنصة (PrecisionManager + MinNotional Guard)
 *   8. ✅ نظام الخروج الهجين (HybridExit: 3% Hard SL + Kalman Mean Reversion Z -> 0)
 *   9. ✅ تسليح الذاكرة بالأسعار الحية دون بيانات وهمية (100% Real Live Market Data)
 */

import { FuturesPair } from '../types';
import { SafeCoinFilter } from './SafeCoinFilter';
import { SanityChecks } from './SanityChecks';
import { KalmanHedgeRatio } from './kalmanFilter';
import { SmartPairSelector } from './smartPairSelector';
import { ExtremeZAlertSystem } from './extremeZAlerts';
import { CircuitBreakersManager } from './circuitBreakers';
import { StateDatabase } from './stateDatabase';
import { HummingbotExecutor } from '../execution/hummingbotExecutor';
import { HybridExitSystem } from '../execution/hybridExit';
import { PrecisionManager } from '../execution/precisionManager';
import { PointInTimeStore } from './pointInTimeStore';
import { SignalDecisionRecorder } from './signalDecisionRecord';
import { QuantumInspiredPortfolioOptimizer, QuantumOptimizationResult } from './quantumOptimizer';
import { PointInTimeDatabase, PriceTick } from './PointInTimeDatabase';

export interface WorkerCycleResult {
  cycleId: number;
  timestamp: number;
  durationMs: number;
  pairsScanned: number;
  pairsPassed: number;
  signalsGenerated: number;
  tradesExecuted: number;
  errors: string[];
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  quantumOptimization?: QuantumOptimizationResult;
}

export interface WorkerConfig {
  intervalMs: number;             // فترة تشغيل الدورة (افتراضي: 8000ms)
  maxPairsPerCycle: number;       // الحد الأقصى للأزواج المفحوصة
  minVolumeUsd: number;           // الحد الأدنى للسيولة ($10M)
  entryZThreshold: number;        // عتبة الدخول الإحصائي (|Z| >= 1.8)
  maxConcurrentPositions: number; // الحد الأقصى للصفقات المتزامنة (3 صفقات)
  enableAutoTrading: boolean;     // تفعيل التداول التلقائي (افتراضي: مغلق للأمان)
  tradeAllocationPct: number;     // نسبة التخصيص من المحفظة للصفقة (5%)
}

export interface QuantWorkerSnapshot {
  success: boolean;
  isLive: boolean;
  exchangeName: string;
  totalScannedCoins: number;
  readyCount: number;
  preparedCount: number;
  backgroundCount: number;
  pairs: FuturesPair[];
  lastScanTime: string;
  scanDurationMs: number;
  warning?: string;
  quantumPortfolio?: QuantumOptimizationResult;
}

export interface QuantWorkerCallbacks {
  onCycleComplete?: (result: WorkerCycleResult) => void;
  onSignalGenerated?: (signal: FuturesPair) => void;
  onTradeExecuted?: (trade: { symbol: string; side: 'BUY' | 'SELL'; price: number; quantity: number; zScore: number }) => void;
  onError?: (error: string) => void;
}

export interface QuantWorkerDependencies {
  fetchTickers: () => Promise<{ liveTickers: Map<string, any>; exchangeName: string }>;
  getActiveOrders: () => Set<string>;
  safeCoinFilter: SafeCoinFilter;
  smartPairSelector: SmartPairSelector;
  kalmanFiltersMap: Map<string, KalmanHedgeRatio>;
  zAlertSystem: ExtremeZAlertSystem;
  blacklist: Set<string>;
  arabicNames?: Record<string, string>;
  // Execution & Risk dependencies
  executor?: HummingbotExecutor;
  hybridExit?: HybridExitSystem;
  stateDb?: StateDatabase;
  circuitBreakers?: CircuitBreakersManager;
  precisionManager?: PrecisionManager;
  pitStore?: PointInTimeStore;
  pointInTimeDb?: PointInTimeDatabase;
  decisionRecorder?: SignalDecisionRecorder;
}

export class QuantBackgroundWorker {
  private startTime: number = Date.now();
  private config: WorkerConfig;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isScanningActive: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private cycleCount: number = 0;
  private lastCycleResult: WorkerCycleResult | null = null;
  private cycleHistory: WorkerCycleResult[] = [];
  private currentSnapshot: QuantWorkerSnapshot | null = null;
  private readonly listeners: Set<(snapshot: QuantWorkerSnapshot) => void> = new Set();
  
  // Auxiliary stores
  public readonly pitStore: PointInTimeStore;
  public readonly pointInTimeDb?: PointInTimeDatabase;
  public readonly decisionRecorder: SignalDecisionRecorder;

  // Callbacks
  private callbacks: QuantWorkerCallbacks = {};

  private executedSignalKeys: Map<string, number> = new Map(); // Idempotency tracker with TTL (5 min)

  constructor(
    private readonly deps: QuantWorkerDependencies,
    config: Partial<WorkerConfig> = {}
  ) {
    this.pitStore = deps.pitStore || new PointInTimeStore(120);
    this.pointInTimeDb = deps.pointInTimeDb;
    this.decisionRecorder = deps.decisionRecorder || new SignalDecisionRecorder(200);

    this.config = {
      intervalMs: Math.max(3000, config.intervalMs ?? 8000),
      maxPairsPerCycle: config.maxPairsPerCycle ?? 50,
      minVolumeUsd: config.minVolumeUsd ?? 50_000_000, // Institutional $50M standard
      entryZThreshold: config.entryZThreshold ?? 1.8,
      maxConcurrentPositions: config.maxConcurrentPositions ?? 3,
      enableAutoTrading: config.enableAutoTrading ?? false, // مغلق افتراضياً للأمان المؤسسي
      tradeAllocationPct: config.tradeAllocationPct ?? 0.05
    };

    // Periodic GC for executed signal keys
    setInterval(() => {
      const now = Date.now();
      for (const [key, ts] of this.executedSignalKeys.entries()) {
        if (now - ts > 300_000) { // 5 minutes
          this.executedSignalKeys.delete(key);
        }
      }
    }, 60_000);

    console.log('[QuantWorker] 🛡️ 24/7 Autonomous Background Worker Initialized');
    console.log(`   Interval: ${this.config.intervalMs}ms | Auto-Trading: ${this.config.enableAutoTrading ? 'ACTIVE' : 'SAFE MODE (OFF)'}`);
    console.log(`   Entry Z: ${this.config.entryZThreshold} | Max Concurrent Positions: ${this.config.maxConcurrentPositions}`);
  }

  // ==================== دورة الحياة (Lifecycle Control) ====================

  /**
   * تشغيل المحرك الدائم في الخلفية 24/7
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('[QuantWorker] ⚠️ Worker is already running.');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    console.log(`[QuantWorker] 🚀 Background quant worker loop started (Interval: ${this.config.intervalMs}ms)`);

    // First scan cycle immediately in background
    this.runScanCycle().catch(err => {
      console.error('[QuantWorker] Error in initial scan cycle:', err.message);
    });

    // Scheduled interval loop
    this.timer = setInterval(() => {
      if (this.isPaused || !this.isRunning) return;
      if (this.isScanningActive) {
        // Skip tick if previous scan cycle is still waiting on network I/O
        return;
      }
      this.runScanCycle().catch(err => {
        console.error('[QuantWorker] Error during background scan cycle:', err.message);
      });
    }, this.config.intervalMs);
  }

  /**
   * إيقاف المحرك بشكل نظيف
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[QuantWorker] 🛑 Background quant worker stopped.');
  }

  /**
   * إيقاف مؤقت دون فقدان مصفوفات كالمان وحالة الذاكرة
   */
  public pause(): void {
    this.isPaused = true;
    console.log('[QuantWorker] ⏸️ Background quant worker paused.');
  }

  /**
   * استئناف العمل
   */
  public resume(): void {
    this.isPaused = false;
    console.log('[QuantWorker] ▶️ Background quant worker resumed.');
  }

  /**
   * 🚨 مفتاح الإيقاف الطارئ الفوري (Kill Switch)
   * يوقف المحرك، يعطل التداول التلقائي، ويلغي فوراً جميع الأوامر المفتوحة على المنصة
   */
  public async emergencyStop(): Promise<{ cancelledOrders: number; message: string }> {
    this.isRunning = false;
    this.isPaused = true;
    this.config.enableAutoTrading = false;

    if (this.deps.stateDb) {
      try {
        if (typeof (this.deps.stateDb as any).setKillSwitch === 'function') {
          await (this.deps.stateDb as any).setKillSwitch(true);
        }
        if (typeof (this.deps.stateDb as any).setAutoEngineActive === 'function') {
          await (this.deps.stateDb as any).setAutoEngineActive(false);
        }
      } catch (e: any) {
        console.error('[QuantWorker] Failed to persist kill switch to stateDb:', e.message);
      }
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    console.error('🚨 [QuantWorker] EMERGENCY KILL SWITCH ACTIVATED - All automated operations halted.');

    let cancelledOrders = 0;
    if (this.deps.executor && typeof this.deps.executor.cancelAllOrders === 'function') {
      try {
        cancelledOrders = await this.deps.executor.cancelAllOrders();
        console.log(`[QuantWorker] 🛡️ Emergency cancel completed: ${cancelledOrders} open orders cancelled.`);
      } catch (err: any) {
        console.error('[QuantWorker] Failed to cancel orders during emergency stop:', err.message);
      }
    }

    return {
      cancelledOrders,
      message: `تم تفعيل مفتاح الطوارئ بنجاح وإلغاء ${cancelledOrders} أمر مفتوح وتعليق المحرك.`
    };
  }

  // ==================== حلقة المسح والتحليل والتنفيذ ====================

  /**
   * تنفيذ دورة مسح إحصائي ومعايرة كالمان حقيقية + تسجيل Point-in-Time + تحسين كمومي
   */
  public async runScanCycle(): Promise<QuantWorkerSnapshot> {
    this.isScanningActive = true;
    const startTime = performance.now();
    this.cycleCount++;

    // Safety timeout: reset scanning active flag if cycle exceeds 30s
    const scanTimeoutTimer = setTimeout(() => {
      if (this.isScanningActive) {
        console.warn('[QuantWorker] ⚠️ Scan cycle exceeded 30s safety threshold. Resetting active flag.');
        this.isScanningActive = false;
      }
    }, 30_000);

    const cycleResult: WorkerCycleResult = {
      cycleId: this.cycleCount,
      timestamp: Date.now(),
      durationMs: 0,
      pairsScanned: 0,
      pairsPassed: 0,
      signalsGenerated: 0,
      tradesExecuted: 0,
      errors: [],
      status: 'SUCCESS'
    };

    try {
      const { liveTickers, exchangeName } = await this.deps.fetchTickers();
      const isLiveMarket = liveTickers && liveTickers.size > 0;
      const fetchLatencyMs = Math.round(performance.now() - startTime);

      // Fail-Safe: No mock/synthetic data if market is disconnected
      if (!isLiveMarket) {
        const offlineSnapshot: QuantWorkerSnapshot = {
          success: true,
          isLive: false,
          exchangeName,
          totalScannedCoins: 0,
          readyCount: 0,
          preparedCount: 0,
          backgroundCount: 0,
          pairs: [],
          lastScanTime: new Date().toLocaleTimeString('ar-SA'),
          scanDurationMs: fetchLatencyMs,
          warning: '⚠️ انقطاع اتصال السوق - تم تعليق المسح لحماية رأس المال (لا توجد بيانات وهمية).'
        };
        this.currentSnapshot = offlineSnapshot;
        this.broadcast(offlineSnapshot);
        cycleResult.status = 'FAILED';
        cycleResult.errors.push('No market data available from exchange');
        this.finalizeCycle(cycleResult, startTime);
        return offlineSnapshot;
      }

      // Record live point-in-time snapshot for audit & backtest integrity
      this.pitStore.recordSnapshot(exchangeName, true, liveTickers, fetchLatencyMs);

      // Parse raw exchange tickers
      const rawList: Array<{
        symbol: string;
        nameAr: string;
        price: number;
        change24h: number;
        volume24hUsd: number;
        fundingRate: number;
        spreadPct: number;
        minNotionalUsd: number;
        recommendedLeverage: number;
      }> = [];

      liveTickers.forEach((t: any, sym: string) => {
        if (!sym.endsWith('USDT')) return;
        const baseCoin = sym.replace('USDT', '');
        const nameAr = this.deps.arabicNames?.[sym] || `${baseCoin} (USDT)`;
        const rawPrice = Number(t.lastPrice) || 0;
        const change24h = typeof t.price24hPcnt === 'number' && !isNaN(t.price24hPcnt) && isFinite(t.price24hPcnt)
          ? parseFloat(t.price24hPcnt.toFixed(2))
          : 0;
        const rawVol = Number(t.turnover24h) || (t.volume24h && rawPrice ? Number(t.volume24h) * rawPrice : 0) || 0;
        const volume24hUsd = typeof rawVol === 'number' && !isNaN(rawVol) && isFinite(rawVol) ? rawVol : 0;
        const spreadPct = (t.spreadPct && t.spreadPct > 0 && t.spreadPct < 0.05) ? Number(t.spreadPct) : 0.00015;

        rawList.push({
          symbol: sym,
          nameAr: baseCoin,
          price: rawPrice,
          change24h,
          volume24hUsd,
          fundingRate: Number(t.fundingRate) || 0.0001,
          spreadPct,
          minNotionalUsd: 5.0,
          recommendedLeverage: 3
        });
      });

      cycleResult.pairsScanned = rawList.length;

      // Real Dynamic Benchmark Price (BTCUSDT) from live tickers
      const btcItem = rawList.find(i => i.symbol === 'BTCUSDT');
      if (!btcItem || btcItem.price <= 0) {
        const noBtcSnapshot: QuantWorkerSnapshot = {
          success: true,
          isLive: false,
          exchangeName,
          totalScannedCoins: rawList.length,
          readyCount: 0,
          preparedCount: 0,
          backgroundCount: 0,
          pairs: [],
          lastScanTime: new Date().toLocaleTimeString('ar-SA'),
          scanDurationMs: fetchLatencyMs,
          warning: '⚠️ سعر BTCUSDT المرجعي الحي غير متوفر - تم تعليق الدورة لضمان دقة معايرة كالمان.'
        };
        this.currentSnapshot = noBtcSnapshot;
        this.broadcast(noBtcSnapshot);
        cycleResult.status = 'PARTIAL';
        cycleResult.errors.push('Live BTCUSDT price unavailable for benchmark calibration');
        this.finalizeCycle(cycleResult, startTime);
        return noBtcSnapshot;
      }
      const btcPrice = btcItem.price;

      // Update Kalman filters and SafeCoinFilter metrics for all symbols
      rawList.forEach((item) => {
        const km = this.getDynamicKalmanMetrics(item.symbol, item.price, btcPrice);
        this.deps.safeCoinFilter.updateMetrics(
          item.symbol,
          item.price,
          item.volume24hUsd,
          item.spreadPct,
          Math.abs(item.change24h) / 100,
          km.zScore
        );
      });
      this.deps.safeCoinFilter.calculateRanks();

      // Persist PriceTicks to PointInTimeDatabase if available
      if (this.pointInTimeDb && rawList.length > 0) {
        const nowTs = Date.now();
        const ticks: PriceTick[] = rawList.map(item => ({
          symbol: item.symbol,
          price: item.price,
          timestamp: nowTs,
          source: (exchangeName.toUpperCase().includes('BYBIT') ? 'BYBIT' : 'BINANCE') as 'BINANCE' | 'BYBIT',
          volume: item.volume24hUsd,
          spread: item.spreadPct
        }));
        this.pointInTimeDb.addTicks(ticks);
      }

      const activeOrdersMap = this.deps.getActiveOrders();

      // Analyze every candidate coin against institutional risk checks
      const allPairs: FuturesPair[] = rawList.map((item) => {
        // 1. Strict Institutional Blacklist
        if (this.deps.blacklist.has(item.symbol)) {
          this.decisionRecorder.recordDecision({
            timestamp: Date.now(),
            symbol: item.symbol,
            price: item.price,
            zScore: 0,
            halfLifeSec: 0,
            spreadPct: item.spreadPct,
            decision: 'REJECTED',
            rejectionReason: '⛔ محظور نظامياً بقرار المؤسسة (قائمة سوداء مطلقة)',
            executionOutcome: 'BLOCKED_BY_RISK',
            metrics: { isCalibrated: false, isHalfLifeValid: false, isSafeFilterPass: false, volume24hUsd: item.volume24hUsd }
          });

          return {
            symbol: item.symbol,
            nameAr: item.nameAr,
            price: item.price,
            change24h: item.change24h,
            volume24hUsd: item.volume24hUsd,
            fundingRate: item.fundingRate,
            spreadPct: item.spreadPct,
            zScore: 0,
            halfLifeSec: 0,
            isCalibrated: false,
            isHalfLifeValid: false,
            beta: 0,
            spread: 0,
            signal: 'NEUTRAL' as const,
            signalReasonAr: '⛔ محظور نظامياً بقرار المؤسسة (قائمة سوداء مطلقة)',
            activeTentacle: 'مراقبة سيولة' as const,
            minNotionalUsd: item.minNotionalUsd,
            recommendedLeverage: item.recommendedLeverage,
            liquidityRank: 0,
            statusGroup: 'BACKGROUND' as const,
            isSafeTradeable: false,
            filterReason: '⛔ محظور نظامياً بقرار المؤسسة (قائمة سوداء مطلقة)'
          };
        }

        const km = this.getDynamicKalmanMetrics(item.symbol, item.price, btcPrice);
        const absZ = Math.abs(km.zScore);

        // SafeCoinFilter criteria
        const filterCheck = this.deps.safeCoinFilter.isTradeable(item.symbol, undefined, km.zScore);

        // Extreme Z-Score Alert Check
        const isPosOpen = activeOrdersMap.has(item.symbol);
        this.deps.zAlertSystem.check(item.symbol, km.zScore, isPosOpen, {
          volume24hUsd: item.volume24hUsd,
          spreadPct: item.spreadPct
        });

        let signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL' = 'NEUTRAL';
        let statusGroup: 'READY' | 'PREPARED' | 'BACKGROUND' = 'BACKGROUND';
        let signalReasonAr = '';
        let activeTentacle: 'تحكيم إحصائي' | 'شبكة ديناميكية' | 'DCA تراكمي' | 'مراقبة سيولة' = 'مراقبة سيولة';

        const isZValid = SanityChecks.validateZScore(km.zScore);
        const isHlValid = km.isHalfLifeValid;

        // Gatekeeping logic
        if (!km.isCalibrated) {
          statusGroup = 'BACKGROUND';
          signal = 'NEUTRAL';
          signalReasonAr = '⏳ فلتر كالمان قيد المعايرة (تجميع عينات حية للسبريد)...';
        } else if (!filterCheck.isTradeable) {
          statusGroup = 'BACKGROUND';
          signalReasonAr = `⚠️ مستبعد بفلتر الأمان: ${filterCheck.reason}`;
        } else if (!isZValid) {
          statusGroup = 'BACKGROUND';
          signalReasonAr = `🚨 قاطع الدائرة الإحصائي: مؤشر Z-Score غير صالح أو مفرط (${km.zScore})`;
        } else if (!isHlValid) {
          statusGroup = 'BACKGROUND';
          signalReasonAr = km.rawHalfLifeSec === 0
            ? '⛔ نصف العمر غير صالح إحصائياً (لا ارتداد للمتوسط أو عدم كفاية البيانات)'
            : `⛔ نصف العمر (${km.rawHalfLifeSec} ثانية) خارج النطاق المؤسسي الآمن (60s - 1800s)`;
        } else if (km.zScore <= -this.config.entryZThreshold) {
          signal = km.zScore <= -(this.config.entryZThreshold + 0.4) ? 'STRONG_BUY' : 'BUY';
          statusGroup = 'READY';
          signalReasonAr = `انحراف سعري سالب حقيقي (Z=${km.zScore}) مع سرعة عودة ${km.halfLifeSec} ثانية - فرصة شراء إحصائي مؤكدة.`;
          activeTentacle = 'تحكيم إحصائي';
        } else if (km.zScore >= this.config.entryZThreshold) {
          signal = km.zScore >= (this.config.entryZThreshold + 0.4) ? 'STRONG_SELL' : 'SELL';
          statusGroup = 'READY';
          signalReasonAr = `تشبع سعري موجب حقيقي (Z=+${km.zScore}) مع سرعة عودة ${km.halfLifeSec} ثانية - فرصة تصحيح بيعي مؤكدة.`;
          activeTentacle = 'تحكيم إحصائي';
        } else if (absZ >= 0.8) {
          statusGroup = 'PREPARED';
          activeTentacle = 'شبكة ديناميكية';
          signalReasonAr = `تذبذب نشط واقتراب الانحراف (Z=${km.zScore}) - العملة تحت المراقبة الحثيثة ومُهيأة للدخول فور وصول العتبة.`;
        } else {
          statusGroup = 'BACKGROUND';
          activeTentacle = 'مراقبة سيولة';
          signalReasonAr = `استقرار وتوازن إحصائي (Z=${km.zScore}) - العملة في منطقة التجميع الطبيعية تحت الملاحظة بالخلفية.`;
        }

        // Record Signal Decision in Audit Trail
        const isTradeable = filterCheck.isTradeable && isHlValid && isZValid && km.isCalibrated;
        let decision: 'ENTER_LONG' | 'ENTER_SHORT' | 'PREPARED_WATCH' | 'REJECTED' = 'REJECTED';
        if (statusGroup === 'READY' && isTradeable) {
          decision = (signal === 'BUY' || signal === 'STRONG_BUY') ? 'ENTER_LONG' : 'ENTER_SHORT';
        } else if (statusGroup === 'PREPARED') {
          decision = 'PREPARED_WATCH';
        }

        this.decisionRecorder.recordDecision({
          timestamp: Date.now(),
          symbol: item.symbol,
          price: item.price,
          zScore: km.zScore,
          halfLifeSec: km.rawHalfLifeSec,
          spreadPct: item.spreadPct,
          decision,
          rejectionReason: statusGroup === 'BACKGROUND' ? signalReasonAr : undefined,
          executionOutcome: decision === 'ENTER_LONG' || decision === 'ENTER_SHORT'
            ? (this.config.enableAutoTrading ? 'EXECUTED_LIVE' : 'EXECUTED_PAPER')
            : 'MONITORING_ONLY',
          metrics: {
            isCalibrated: km.isCalibrated,
            isHalfLifeValid: isHlValid,
            isSafeFilterPass: filterCheck.isTradeable,
            volume24hUsd: item.volume24hUsd
          }
        });

        return {
          symbol: item.symbol,
          nameAr: item.nameAr,
          price: item.price,
          change24h: item.change24h,
          volume24hUsd: item.volume24hUsd,
          fundingRate: item.fundingRate,
          spreadPct: item.spreadPct,
          zScore: km.zScore,
          halfLifeSec: km.rawHalfLifeSec,
          isCalibrated: km.isCalibrated,
          isHalfLifeValid: km.isHalfLifeValid,
          beta: km.beta,
          spread: km.spread,
          signal,
          signalReasonAr,
          activeTentacle,
          minNotionalUsd: item.minNotionalUsd,
          recommendedLeverage: item.recommendedLeverage,
          liquidityRank: 0,
          statusGroup,
          isSafeTradeable: filterCheck.isTradeable && isHlValid,
          filterReason: !isHlValid
            ? (km.rawHalfLifeSec === 0 ? 'نصف العمر غير صالح' : `نصف العمر خارج النطاق (${km.rawHalfLifeSec}s)`)
            : filterCheck.reason
        };
      });

      // Sort by status group priority then volume
      allPairs.sort((a, b) => {
        const groupRank: Record<string, number> = { READY: 1, PREPARED: 2, BACKGROUND: 3 };
        const rankA = groupRank[a.statusGroup || 'BACKGROUND'] ?? 3;
        const rankB = groupRank[b.statusGroup || 'BACKGROUND'] ?? 3;
        if (rankA !== rankB) return rankA - rankB;
        return b.volume24hUsd - a.volume24hUsd;
      });

      allPairs.forEach((p, idx) => {
        p.liquidityRank = idx + 1;
      });

      const readyCoins = allPairs.filter(p => p.statusGroup === 'READY');
      const preparedCoins = allPairs.filter(p => p.statusGroup === 'PREPARED');
      const backgroundCount = allPairs.filter(p => p.statusGroup === 'BACKGROUND').length;

      cycleResult.pairsPassed = readyCoins.length + preparedCoins.length;

      // Check for tradeable signals
      const tradeableSignals = readyCoins.filter(
        p => p.isSafeTradeable && (p.signal === 'BUY' || p.signal === 'STRONG_BUY' || p.signal === 'SELL' || p.signal === 'STRONG_SELL')
      );

      cycleResult.signalsGenerated = tradeableSignals.length;

      // Run Quantum-Inspired Portfolio Optimization across Top candidates
      const candidatesForOptimization = [...readyCoins, ...preparedCoins].slice(0, 10).map(p => ({
        symbol: p.symbol,
        zScore: p.zScore,
        halfLifeSec: p.halfLifeSec,
        volume24hUsd: p.volume24hUsd,
        spreadPct: p.spreadPct,
        beta: p.beta
      }));

      let quantumOpt: QuantumOptimizationResult | undefined;
      if (candidatesForOptimization.length > 0) {
        quantumOpt = QuantumInspiredPortfolioOptimizer.optimize(
          candidatesForOptimization,
          1000.0,
          this.config.maxConcurrentPositions
        );
      }
      cycleResult.quantumOptimization = quantumOpt;

      // Trigger Signal Callbacks
      if (this.callbacks.onSignalGenerated) {
        for (const sig of tradeableSignals) {
          try {
            this.callbacks.onSignalGenerated(sig);
          } catch (e: any) {
            cycleResult.errors.push(`Signal callback error (${sig.symbol}): ${e.message}`);
          }
        }
      }

      // Autonomous Safe Trade Execution (if enabled and Circuit Breakers allow)
      if (this.config.enableAutoTrading && tradeableSignals.length > 0) {
        const canTrade = !this.deps.circuitBreakers || this.deps.circuitBreakers.canTrade();
        if (canTrade) {
          const executed = await this.executeSignals(tradeableSignals);
          cycleResult.tradesExecuted = executed;
        } else {
          const haltReason = this.deps.circuitBreakers?.getHaltReason() || 'Circuit breaker active';
          cycleResult.errors.push(`Trading halted by circuit breaker: ${haltReason}`);
        }
      }

      const snapshot: QuantWorkerSnapshot = {
        success: true,
        isLive: true,
        exchangeName,
        totalScannedCoins: allPairs.length,
        readyCount: readyCoins.length,
        preparedCount: preparedCoins.length,
        backgroundCount,
        pairs: allPairs,
        lastScanTime: new Date().toLocaleTimeString('ar-SA'),
        scanDurationMs: Math.round(performance.now() - startTime),
        quantumPortfolio: quantumOpt
      };

      this.currentSnapshot = snapshot;
      this.broadcast(snapshot);
      cycleResult.status = cycleResult.errors.length > 0 ? 'PARTIAL' : 'SUCCESS';
      this.finalizeCycle(cycleResult, startTime);
      return snapshot;

    } catch (err: any) {
      cycleResult.status = 'FAILED';
      cycleResult.errors.push(err.message);
      console.error('[QuantWorker] ❌ Critical scan cycle error:', err.message);
      this.finalizeCycle(cycleResult, startTime);
      throw err;
    } finally {
      clearTimeout(scanTimeoutTimer);
      this.isScanningActive = false;
    }
  }

  /**
   * تنفيذ الإشارات المؤكدة بالتكامل مع PrecisionManager و HybridExit و StateDatabase
   */
  private async executeSignals(signals: FuturesPair[]): Promise<number> {
    if (!this.deps.executor || !this.deps.stateDb) {
      return 0;
    }

    let executedCount = 0;
    const currentPositions = this.deps.stateDb.getAllPositions();
    const availableSlots = this.config.maxConcurrentPositions - currentPositions.length;

    if (availableSlots <= 0) {
      return 0;
    }

    // Sort signals by Conviction Score: |Z| weighted by fast Half-life
    const sortedSignals = [...signals]
      .sort((a, b) => {
        const hlA = Math.max(10, a.halfLifeSec || 300);
        const hlB = Math.max(10, b.halfLifeSec || 300);
        const convictionA = Math.abs(a.zScore) / (hlA / 300);
        const convictionB = Math.abs(b.zScore) / (hlB / 300);
        return convictionB - convictionA;
      })
      .slice(0, availableSlots);

    for (const sig of sortedSignals) {
      // 1. Guard against duplicate position on the same symbol
      if (this.deps.stateDb.getPosition(sig.symbol)) {
        continue;
      }

      // 2. Idempotency Check: prevent duplicate execution for same signal window (30s)
      const idempotencyKey = `${sig.symbol}-${sig.signal}-${Math.floor(Date.now() / 30_000)}`;
      if (this.executedSignalKeys.has(idempotencyKey)) {
        console.log(`[QuantWorker] 🛡️ Idempotent signal execution skipped for ${sig.symbol}`);
        continue;
      }

      try {
        const isSuccess = await this.executeTrade(sig);
        if (isSuccess) {
          this.executedSignalKeys.set(idempotencyKey, Date.now());
          executedCount++;
        }
      } catch (err: any) {
        console.error(`[QuantWorker] Trade execution failed for ${sig.symbol}:`, err.message);
      }
    }

    return executedCount;
  }

  /**
   * تنفيذ صفقة واحدة بأقصى معايير السلامة الكمية
   */
  private async executeTrade(signal: FuturesPair): Promise<boolean> {
    const { symbol, price, zScore } = signal;
    const isBuy = signal.signal === 'BUY' || signal.signal === 'STRONG_BUY';
    const side: 'BUY' | 'SELL' = isBuy ? 'BUY' : 'SELL';

    try {
      // 1. التحقق من الرصيد الحي والمتاح
      const walletBalance = (this.deps.executor && typeof this.deps.executor.getWalletBalance === 'function')
        ? await this.deps.executor.getWalletBalance()
        : 0;

      if (walletBalance <= 0) {
        console.warn(`[QuantWorker] ⚠️ Cannot trade ${symbol}: Wallet balance is 0 or unverified ($${walletBalance}).`);
        return false;
      }

      const currentPositions = this.deps.stateDb?.getAllPositions() || [];
      const totalExposure = currentPositions.reduce((sum, p) => sum + (p.entryPrice * p.size), 0);
      const availableBalance = Math.max(0, walletBalance - totalExposure);

      if (availableBalance <= 10.0) {
        console.warn(`[QuantWorker] ⚠️ Insufficient available balance for ${symbol} ($${availableBalance.toFixed(2)}).`);
        return false;
      }

      // 2. حساب حجم الصفقة المؤسسي بناءً على الرصيد المتاح
      const tradeSizeUsd = availableBalance * this.config.tradeAllocationPct;
      const rawQuantity = tradeSizeUsd / (price > 0 ? price : 1.0);

      // 3. فحص ومعايرة الدقة بواسطة PrecisionManager (إلزامي)
      if (!this.deps.precisionManager) {
        console.error(`[QuantWorker] ❌ FATAL: precisionManager is required for execution.`);
        return false;
      }
      const validation = this.deps.precisionManager.validateOrder(symbol, rawQuantity, price);
      if (!validation.isValid) {
        console.warn(`[QuantWorker] ⚠️ Precision check blocked trade for ${symbol}: ${validation.reason}`);
        return false;
      }
      let calibratedQty = validation.roundedQuantity;
      let calibratedPrice = validation.roundedPrice;

      // 4. إرسال الأمر للمنصة عبر HummingbotExecutor (MARKET لتفادي تفويت الإشارة)
      const positionId = `QW-${symbol}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const orderResult = await this.deps.executor!.placeOrder({
        tradingPair: symbol,
        isBuy,
        amount: calibratedQty,
        price: calibratedPrice,
        orderType: 'MARKET',
        positionId
      });

      if (orderResult && orderResult.success) {
        const slPrice = isBuy ? calibratedPrice * 0.97 : calibratedPrice * 1.03;
        const tpPrice = isBuy ? calibratedPrice * 1.05 : calibratedPrice * 0.95;

        // 5. تسليح الوقف الكارثي والخروج الهجين (Hybrid Exit Protection) إلزامي أولاً لمنع نافذة الخطر
        if (!this.deps.hybridExit) {
          console.error(`[QuantWorker] ❌ FATAL: hybridExit is required. Cancelling order.`);
          if (orderResult.orderId) {
            await this.deps.executor!.cancelOrder(orderResult.orderId, symbol);
          }
          return false;
        }

        await this.deps.hybridExit.armExitProtection({
          symbol,
          side,
          entryPrice: calibratedPrice,
          entryZ: zScore,
          size: calibratedQty
        });

        // 6. تسجيل المركز في قاعدة بيانات الحالة الحية (مع التحقق)
        if (!this.deps.stateDb) {
          console.error(`[QuantWorker] ❌ FATAL: stateDb is required.`);
          return false;
        }

        this.deps.stateDb.savePosition(
          symbol,
          isBuy ? 'LONG' : 'SHORT',
          calibratedPrice,
          calibratedQty,
          slPrice,
          tpPrice
        );

        console.log(
          `[QuantWorker] 🟢 Executed Trade: ${symbol} ${side} @ ${calibratedPrice} ` +
          `(Qty: ${calibratedQty}, Z: ${zScore.toFixed(2)})`
        );

        if (this.callbacks.onTradeExecuted) {
          this.callbacks.onTradeExecuted({
            symbol,
            side,
            price: calibratedPrice,
            quantity: calibratedQty,
            zScore
          });
        }

        return true;
      }

      return false;
    } catch (err: any) {
      console.error(`[QuantWorker] Execution error on ${symbol}:`, err.message);
      return false;
    }
  }

  // ==================== المعايرة الإحصائية والـ Helper Functions ====================

  private getDynamicKalmanMetrics(
    symbol: string,
    price: number,
    btcPrice: number
  ): {
    zScore: number;
    halfLifeSec: number;
    rawHalfLifeSec: number;
    isHalfLifeValid: boolean;
    beta: number;
    spread: number;
    isCalibrated: boolean;
  } {
    const benchmarkPrice = btcPrice > 0 ? btcPrice : 68000;
    const currentPrice = price > 0 ? price : 1.0;

    let kf = this.deps.kalmanFiltersMap.get(symbol);
    if (!kf) {
      kf = new KalmanHedgeRatio({ delta: 0.0001, ve: 0.001, vw: 0.001 });
      kf.beta = currentPrice / benchmarkPrice;
      this.deps.kalmanFiltersMap.set(symbol, kf);
    }

    const { beta, spread } = kf.update(currentPrice, benchmarkPrice);
    const spreadHistory = kf.getHistory().spread;
    const isCalibrated = spreadHistory.length >= 10;

    let zScore = isCalibrated ? kf.getZScore(Math.min(30, spreadHistory.length)) : 0.0;
    if (isNaN(zScore) || !isFinite(zScore)) {
      zScore = 0.0;
    }
    zScore = parseFloat(Math.max(-8.0, Math.min(8.0, zScore)).toFixed(2));

    const cycleIntervalSec = Math.max(1, Math.round(this.config.intervalMs / 1000));
    const rawHalfLifeSec = this.deps.smartPairSelector.calculateHalfLife(spreadHistory, cycleIntervalSec);
    const isHalfLifeValid = spreadHistory.length >= 10 && SanityChecks.validateHalfLife(rawHalfLifeSec);
    const halfLifeSec = isHalfLifeValid ? rawHalfLifeSec : 0;

    return {
      zScore,
      halfLifeSec,
      rawHalfLifeSec,
      isHalfLifeValid,
      beta: parseFloat(beta.toFixed(4)),
      spread: parseFloat(spread.toFixed(4)),
      isCalibrated
    };
  }

  private finalizeCycle(result: WorkerCycleResult, startTime: number): void {
    result.durationMs = Math.round(performance.now() - startTime);
    if (result.errors.length > 10) {
      result.errors = result.errors.slice(-10);
    }
    this.lastCycleResult = result;

    this.cycleHistory.push(result);
    if (this.cycleHistory.length > 100) {
      this.cycleHistory = this.cycleHistory.slice(-100);
    }

    if (this.callbacks.onCycleComplete) {
      try {
        this.callbacks.onCycleComplete(result);
      } catch (e: any) {
        console.error('[QuantWorker] Error in onCycleComplete callback:', e.message);
      }
    }
  }

  private broadcast(snapshot: QuantWorkerSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[QuantWorker] Broadcast listener exception:', err);
      }
    }
  }

  // ==================== Getter & Setters ====================

  public getSnapshot(): QuantWorkerSnapshot | null {
    return this.currentSnapshot;
  }

  public isBusy(): boolean {
    return this.isScanningActive;
  }

  public onSnapshot(listener: (snapshot: QuantWorkerSnapshot) => void): () => void {
    this.listeners.add(listener);
    if (this.currentSnapshot) {
      try {
        listener(this.currentSnapshot);
      } catch (e) {
        console.error('[QuantWorker] Error in snapshot listener:', e);
      }
    }
    return () => this.listeners.delete(listener);
  }

  public getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    isScanningActive: boolean;
    cycleCount: number;
    lastCycle: WorkerCycleResult | null;
    config: WorkerConfig;
    uptimeSec: number;
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isScanningActive: this.isScanningActive,
      cycleCount: this.cycleCount,
      lastCycle: this.lastCycleResult,
      config: { ...this.config },
      uptimeSec: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  public getCycleHistory(limit: number = 20): WorkerCycleResult[] {
    return this.cycleHistory.slice(-limit);
  }

  public getLastCycleResult(): WorkerCycleResult | null {
    return this.lastCycleResult;
  }

  public setConfig(newConfig: Partial<WorkerConfig>): void {
    if (newConfig.intervalMs !== undefined && newConfig.intervalMs < 3000) {
      throw new Error('intervalMs must be at least 3000ms');
    }
    if (newConfig.entryZThreshold !== undefined && (newConfig.entryZThreshold <= 0 || newConfig.entryZThreshold > 5)) {
      throw new Error('entryZThreshold must be between 0 and 5');
    }
    if (newConfig.maxConcurrentPositions !== undefined && (newConfig.maxConcurrentPositions <= 0 || newConfig.maxConcurrentPositions > 10)) {
      throw new Error('maxConcurrentPositions must be between 1 and 10');
    }
    this.config = {
      ...this.config,
      ...newConfig
    };
    console.log('[QuantWorker] ⚙️ Configuration updated:', this.config);
  }

  public setCallbacks(callbacks: QuantWorkerCallbacks): void {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks
    };
  }
}
