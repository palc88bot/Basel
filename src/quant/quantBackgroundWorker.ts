import { FuturesPair } from '../types';
import { SafeCoinFilter } from './SafeCoinFilter';
import { SanityChecks } from './SanityChecks';
import { KalmanHedgeRatio } from './kalmanFilter';
import { SmartPairSelector } from './smartPairSelector';
import { ExtremeZAlertSystem } from './extremeZAlerts';

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
}

export interface QuantWorkerConfig {
  intervalMs?: number;
  minVolume24hUsd?: number;
}

/**
 * Unified Background Worker for Quantitative Analysis and Kalman State Synchronization.
 * Runs non-blocking continuous cycles to warm Kalman matrices and compute statistics
 * without introducing latency or stalling incoming HTTP request handling.
 */
export class QuantBackgroundWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isScanningActive: boolean = false;
  private currentSnapshot: QuantWorkerSnapshot | null = null;
  private readonly listeners: Set<(snapshot: QuantWorkerSnapshot) => void> = new Set();
  private readonly intervalMs: number;

  constructor(
    private readonly deps: QuantWorkerDependencies,
    config: QuantWorkerConfig = {}
  ) {
    this.intervalMs = Math.max(3000, config.intervalMs ?? 8000);
  }

  /**
   * Starts the continuous background scanning loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[QuantWorker] 🚀 Background quant worker pipeline initialized (interval: ${this.intervalMs}ms)`);

    // Immediate first tick in background (non-blocking)
    this.runScanCycle().catch(err => {
      console.error('[QuantWorker] Error in initial scan cycle:', err.message);
    });

    this.timer = setInterval(() => {
      if (this.isScanningActive) {
        // Skip tick if previous tick is still waiting for exchange network response
        return;
      }
      this.runScanCycle().catch(err => {
        console.error('[QuantWorker] Error during background scan cycle:', err.message);
      });
    }, this.intervalMs);
  }

  /**
   * Stops the background worker
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[QuantWorker] 🛑 Background quant worker stopped');
  }

  public isBusy(): boolean {
    return this.isScanningActive;
  }

  public getSnapshot(): QuantWorkerSnapshot | null {
    return this.currentSnapshot;
  }

  public onSnapshot(listener: (snapshot: QuantWorkerSnapshot) => void): () => void {
    this.listeners.add(listener);
    if (this.currentSnapshot) {
      try {
        listener(this.currentSnapshot);
      } catch (e) {
        console.error('[QuantWorker] Error in initial snapshot listener call:', e);
      }
    }
    return () => this.listeners.delete(listener);
  }

  /**
   * Executes a single real market data processing cycle
   */
  public async runScanCycle(): Promise<QuantWorkerSnapshot> {
    this.isScanningActive = true;
    const startTime = Date.now();

    try {
      const { liveTickers, exchangeName } = await this.deps.fetchTickers();
      const isLiveMarket = liveTickers && liveTickers.size > 0;

      // Fail-Safe: If market data cannot be fetched, do NOT generate synthetic or mock data
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
          scanDurationMs: Date.now() - startTime,
          warning: '⚠️ انقطاع اتصال السوق - تم تعليق المسح لحماية رأس المال (لا توجد بيانات وهمية).'
        };
        this.currentSnapshot = offlineSnapshot;
        this.broadcast(offlineSnapshot);
        return offlineSnapshot;
      }

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

      // Benchmark price (BTC) for Kalman estimation
      const btcItem = rawList.find(i => i.symbol === 'BTCUSDT');
      const btcPrice = btcItem && btcItem.price > 0 ? btcItem.price : 68000;

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

      const activeOrdersMap = this.deps.getActiveOrders();

      // Analyze every candidate coin against institutional risk checks
      const allPairs: FuturesPair[] = rawList.map((item) => {
        // 1. Strict Institutional Blacklist
        if (this.deps.blacklist.has(item.symbol)) {
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
        } else if (km.zScore <= -1.8) {
          signal = km.zScore <= -2.2 ? 'STRONG_BUY' : 'BUY';
          statusGroup = 'READY';
          signalReasonAr = `انحراف سعري سالب حقيقي (Z=${km.zScore}) مع سرعة عودة ${km.halfLifeSec} ثانية - فرصة شراء إحصائي مؤكدة.`;
          activeTentacle = 'تحكيم إحصائي';
        } else if (km.zScore >= 1.8) {
          signal = km.zScore >= 2.2 ? 'STRONG_SELL' : 'SELL';
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

      const readyCount = allPairs.filter(p => p.statusGroup === 'READY').length;
      const preparedCount = allPairs.filter(p => p.statusGroup === 'PREPARED').length;
      const backgroundCount = allPairs.filter(p => p.statusGroup === 'BACKGROUND').length;

      const snapshot: QuantWorkerSnapshot = {
        success: true,
        isLive: true,
        exchangeName,
        totalScannedCoins: allPairs.length,
        readyCount,
        preparedCount,
        backgroundCount,
        pairs: allPairs,
        lastScanTime: new Date().toLocaleTimeString('ar-SA'),
        scanDurationMs: Date.now() - startTime
      };

      this.currentSnapshot = snapshot;
      this.broadcast(snapshot);
      return snapshot;
    } finally {
      this.isScanningActive = false;
    }
  }

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

    let zScore = isCalibrated ? kf.getZScore(30) : 0.0;
    if (isNaN(zScore) || !isFinite(zScore)) {
      zScore = 0.0;
    }
    zScore = parseFloat(Math.max(-4.0, Math.min(4.0, zScore)).toFixed(2));

    const rawHalfLifeSec = this.deps.smartPairSelector.calculateHalfLife(spreadHistory, 5);
    const isHalfLifeValid = SanityChecks.validateHalfLife(rawHalfLifeSec);
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

  private broadcast(snapshot: QuantWorkerSnapshot): void {
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[QuantWorker] Broadcast listener exception:', err);
      }
    }
  }
}
