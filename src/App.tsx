import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { CapitalAdaptationView } from './components/CapitalAdaptationView';
import { VisualStrategyDesignerView } from './components/VisualStrategyDesignerView';
import { TentaclesManagerView } from './components/TentaclesManagerView';
import { HyperoptView } from './components/HyperoptView';
import { QuantitativeEngineView } from './components/QuantitativeEngineView';
import { BacktestView } from './components/BacktestView';
import { RiskManagementView } from './components/RiskManagementView';
import { AlertsManagerView } from './components/AlertsManagerView';
import { GeminiQuantCopilot } from './components/GeminiQuantCopilot';
import { ExecutionEngineView } from './components/ExecutionEngineView';
import { SecretVaultView } from './components/SecretVaultView';
import { OmegaQuantSuiteView } from './components/OmegaQuantSuiteView';
import { PaperTradingManagerView } from './components/PaperTradingManagerView';
import { MarketTick, Position, BotConfig } from './types';
import {
  SmartPairSelector,
  SanityChecks,
  SafeCoinFilter,
  INSTITUTIONAL_ALLOWED_COINS
} from './quant';

/**
 * Robust Ornstein-Uhlenbeck Half-Life calculation using Ordinary Least Squares (OLS) regression
 * on rolling price window history.
 */
function calculateHalfLife(priceSeries: number[], sampleIntervalSec: number = 5): number {
  try {
    if (!Array.isArray(priceSeries) || priceSeries.length < 10) return 0;
    const clean = priceSeries.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (clean.length < 10) return 0;

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = clean.length - 1;

    for (let i = 0; i < n; i++) {
      const x = clean[i];
      const y = clean[i + 1] - clean[i];
      if (isFinite(x) && isFinite(y)) {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-12 || !isFinite(denominator)) return 0;

    const lambda = (n * sumXY - sumX * sumY) / denominator;
    if (!isFinite(lambda) || lambda >= 0) return 0; // Must be negative for mean reversion

    const periods = -Math.log(2) / lambda;
    if (!isFinite(periods) || periods <= 0) return 0;

    const halfLifeSec = periods * sampleIntervalSec;
    if (!isFinite(halfLifeSec) || halfLifeSec <= 0 || halfLifeSec > 86400) return 0;

    return Math.round(halfLifeSec);
  } catch (err) {
    console.error('[App] OLS Half-Life calculation error:', err);
    return 0;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [botRunning, setBotRunning] = useState(true);
  
  // Paper Trading State
  const [isPaperTrading, setIsPaperTrading] = useState(true);
  const [paperBalance, setPaperBalance] = useState(1000.0);

  // Real Wallet Balance from Bybit V5 (defaults to 0.00 until authenticated)
  const [walletBalance, setWalletBalance] = useState(0.0);
  const [equity, setEquity] = useState(0.0);
  const [dailyPnl, setDailyPnl] = useState(0.0);
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [latestTick, setLatestTick] = useState<MarketTick | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const rollingPriceHistoryRef = useRef<Map<string, number[]>>(new Map());
  
  const [bybitAccount, setBybitAccount] = useState<{
    hasCredentials: boolean;
    testnet: boolean;
    statusMessageAr: string;
  }>({
    hasCredentials: false,
    testnet: true,
    statusMessageAr: 'جاري فحص اتصال المنصة (Platform Agnostic)...'
  });

  const [platformConfig, setPlatformConfig] = useState<any>(null);

  const [config, setConfig] = useState<BotConfig>({
    initialEquity: 1000,
    walletBalance: 0.0,
    assetA: 'BTC-USDT',
    assetB: 'ETH-USDT',
    kalmanDelta: 0.001,
    kalmanVe: 0.001,
    kalmanVw: 0.001,
    minHalfLife: 0.5,
    maxHalfLife: 60,
    entryZ: 2.0,
    exitZ: 0.0,
    stopZ: 2.8,
    minConfidence: 0.7,
    maxPositionPct: 0.05,
    maxLeverage: 4,
    useKelly: false,
    timeLimitSeconds: 3600,
    enableStatArb: true,
    enableDCA: false,
    enableGrid: false,
    dcaAmountUsd: 10,
    dcaDropThreshold: -0.02,
    gridLevels: 10,
    gridSpacingPct: 0.02,
    makerFeeRate: 0.0002,
    takerFeeRate: 0.00055,
    minExchangeNotionalUsd: 5.0,
    autoAdaptMicroWallets: true
  });

  const fetchRealBybitState = async () => {
    return fetchUniversalState();
  };

  const handleToggleBotRunning = async (running: boolean) => {
    setBotRunning(running);
    try {
      await fetch('/api/execution/toggle-auto-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: running })
      });
    } catch (err) {
      console.error('Failed to toggle auto engine:', err);
    }
  };

  const handleTogglePaperTrading = async (active?: boolean) => {
    try {
      const targetState = active !== undefined ? active : !isPaperTrading;
      const res = await fetch('/api/paper/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: targetState })
      });
      const data = await res.json();
      if (data.success) {
        setIsPaperTrading(data.isPaperTrading);
        if (data.paperBalance) setPaperBalance(data.paperBalance);
      }
    } catch (err) {
      console.error('Failed to toggle paper trading mode:', err);
    }
  };

  // Fetch Platform Config & Universal Account State
  const fetchUniversalState = async () => {
    try {
      const [configRes, accRes, posRes, futuresRes, engineRes, paperRes] = await Promise.all([
        fetch('/api/exchange/platform-config'),
        fetch('/api/exchange/account'),
        fetch('/api/exchange/positions'),
        fetch('/api/quant/futures-pairs'),
        fetch('/api/execution/auto-engine'),
        fetch('/api/paper/mode').catch(() => null)
      ]);
      const configData = await configRes.json();
      const accData = await accRes.json();
      const posData = await posRes.json();
      const futuresData = await futuresRes.json();
      const engineData = await engineRes.json().catch(() => ({ success: false }));
      const paperData = paperRes ? await paperRes.json().catch(() => ({ success: false })) : null;

      if (paperData && paperData.success) {
        setIsPaperTrading(paperData.isPaperTrading);
        if (typeof paperData.paperBalance === 'number') {
          setPaperBalance(paperData.paperBalance);
        }
      }

      if (configData.success) {
        setPlatformConfig(configData.config);
      }

      if (engineData.success && typeof engineData.active === 'boolean') {
        setBotRunning(engineData.active);
      }

      if (accData.success) {
        setBybitAccount({
          hasCredentials: accData.hasCredentials,
          testnet: accData.testnet,
          statusMessageAr: accData.statusMessageAr || 'متصل بمنصة التداول بنجاح'
        });
        setWalletBalance(accData.walletBalance || 0.0);
        setEquity(accData.totalEquity || 0.0);
        setDailyPnl(accData.unrealisedPnl || 0.0);
      }

      // Sync positions from exchange account & StateDatabase
      if (posData.success && Array.isArray(posData.positions)) {
        if (posData.positions.length === 0) {
          setPositions([]);
        } else {
          const mapped: Position[] = posData.positions.map((p: any) => {
            const isLong = (p.side || '').toUpperCase() === 'BUY' || (p.side || '').toUpperCase() === 'LONG';
            return {
              id: `EXG-${p.symbol}`,
              pair: p.symbol,
              direction: isLong ? 'LONG' : 'SHORT',
              entryPriceA: p.entryPrice,
              sizeUsd: p.positionValue || (p.size * p.entryPrice),
              leverage: p.leverage || 4,
              entryTime: p.createdTime || Date.now(),
              pnl: p.unrealisedPnl || 0,
              pnlPercentage: (p.positionValue || (p.size * p.entryPrice)) > 0 
                ? ((p.unrealisedPnl || 0) / (p.positionValue || (p.size * p.entryPrice))) * 100 
                : 0,
              status: 'OPEN',
              assignedTentacle: 'تحكيم إحصائي متعدد العملات (مؤمن بقاعدة الحالة)'
            };
          });
          setPositions(mapped);
        }
      }
    } catch (err) {
      console.error('Failed to sync universal exchange state:', err);
    }
  };

  // WebSocket Manager with Exponential Backoff and Auto-Reconnect
  const [wsStatus, setWsStatus] = useState<{
    status: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'FAILED';
    exchangeName: string;
    reconnectAttempt: number;
  }>({
    status: 'CONNECTED',
    exchangeName: 'Universal Multi-Exchange (Binance & Bybit V5)',
    reconnectAttempt: 0
  });

  useEffect(() => {
    let timeoutId: any = null;
    let isCancelled = false;

    const checkWsConnection = async (attempt = 0) => {
      try {
        const res = await fetch('/api/quant/websocket/status');
        const data = await res.json();
        if (!isCancelled) {
          if (data.success && data.status === 'CONNECTED') {
            setWsStatus({
              status: 'CONNECTED',
              exchangeName: data.exchangeName || 'Universal Connector',
              reconnectAttempt: 0
            });
            // Standard heart check every 4 seconds
            timeoutId = setTimeout(() => checkWsConnection(0), 4000);
          } else {
            throw new Error(data.status || 'Disconnected');
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const nextAttempt = attempt + 1;
          // Exponential backoff with jitter: 1s, 2s, 4s, 8s, up to 30s
          const backoff = Math.min(30000, 1000 * Math.pow(1.8, attempt)) + Math.random() * 500;
          setWsStatus({
            status: nextAttempt > 6 ? 'FAILED' : 'RECONNECTING',
            exchangeName: 'Universal API (Reconnecting...)',
            reconnectAttempt: nextAttempt
          });
          timeoutId = setTimeout(() => checkWsConnection(nextAttempt), backoff);
        }
      }
    };

    checkWsConnection(0);
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Periodic Sync with StateDatabase (Durable SQLite/JSON storage)
  useEffect(() => {
    const syncState = async () => {
      try {
        await fetch('/api/quant/state/stats');
      } catch (err) {
        // silent sync
      }
    };
    syncState();
    const interval = setInterval(syncState, 10000);
    return () => clearInterval(interval);
  }, []);

  // State Recovery Handler (Restore last known state upon reload)
  const handleRecoverState = async () => {
    try {
      const res = await fetch('/api/quant/state/recover', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchUniversalState();
        alert('تمت استعادة آخر حالة معروفة للبوت بنجاح من قاعدة الحالة المحفوظة!');
      } else {
        alert(data.message || 'لا توجد نسخة احتياطية سابقة متاحة.');
      }
    } catch (err) {
      console.error('Recover state failed:', err);
    }
  };

  useEffect(() => {
    fetchUniversalState();
    const interval = setInterval(fetchUniversalState, 6000);
    return () => clearInterval(interval);
  }, []);

  // Keep config in sync with wallet balance
  useEffect(() => {
    setConfig(prev => ({ ...prev, walletBalance }));
    fetch('/api/execution/update-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletBalance })
    }).catch(() => {});
  }, [walletBalance]);

  // Fetch real market ticks across multi-coin scanner and execute dynamic trades via Priority Queue (Top 3 Opportunities)
  useEffect(() => {
    const evaluateMultiCoinMarket = async () => {
      try {
        const [ticksRes, futuresRes] = await Promise.all([
          fetch('/api/quant/live-market', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ steps: 35 })
          }),
          fetch('/api/quant/futures-pairs')
        ]);
        const data = await ticksRes.json();
        const futuresData = await futuresRes.json();

        if (data.success && data.ticks && data.ticks.length > 0) {
          setTicks(data.ticks);
          const currentLatest = data.ticks[data.ticks.length - 1];
          setLatestTick(currentLatest);

          // Evaluate trading conditions dynamically across qualified assets from scanner
          const rawPairs = futuresData.success && Array.isArray(futuresData.pairs) ? futuresData.pairs : [];
          
          const evaluatedCoins: Array<{
            symbol: string;
            status: 'PASSED' | 'REJECTED';
            reason: string;
            zScore: number;
            volume: number;
            halfLife: number;
            priorityScore?: number;
          }> = [];

          const passedOpportunities: any[] = [];

          // Instantiate SmartPairSelector for institutional quantitative screening
          const smartSelector = new SmartPairSelector({
            minVolume24h: 30_000_000,
            maxSpreadPct: 0.0020,
            minHalfLife: config.minHalfLife,
            maxHalfLife: config.maxHalfLife,
            allowedCoins: INSTITUTIONAL_ALLOWED_COINS
          });

          for (const p of rawPairs) {
            const symbol = p.symbol;
            const currentPrice = Number(p.price) || 0;
            const volumeUsd = Number(p.volume24hUsd || p.volume24h) || 0;
            const spreadPct = Number(p.spreadPct) || 0.0005;

            // 1. Data Integrity: Strict numeric validity checks
            if (!SanityChecks.isValidNumber(currentPrice, `${symbol} price`, false) || currentPrice <= 0 || !isFinite(currentPrice)) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `🚨 خطأ في سلامة البيانات (السعر غير صالح: ${currentPrice})`,
                zScore: 0,
                volume: volumeUsd,
                halfLife: 0
              });
              continue;
            }

            let rollingZ = 0;
            let halfLife = 0;

            try {
              // 2. Use directly the values provided by the backend API 
              // which are calibrated by Kalman Filter and SmartPairSelector
              if (typeof p.zScore === 'number' && !isNaN(p.zScore) && isFinite(p.zScore)) {
                rollingZ = p.zScore;
              }

              // 3. Compute Ornstein-Uhlenbeck Half-Life using OLS regression
              const serverHalfLife = typeof p.halfLifeSec === 'number' && !isNaN(p.halfLifeSec) && p.halfLifeSec > 0
                ? p.halfLifeSec
                : (typeof p.halfLife === 'number' && !isNaN(p.halfLife) && p.halfLife > 0 ? p.halfLife : 0);

              if (serverHalfLife > 0) {
                halfLife = serverHalfLife;
              }
            } catch (mathErr) {
              console.error(`[App] Mathematical error in Z-Score/Half-Life calculation for ${symbol}:`, mathErr);
              rollingZ = 0;
              halfLife = 0;
            }

            // 5. Hard-Coded Circuit Breaker against Extreme Outliers (|Z| > 10.0 or NaN/Inf)
            if (!SanityChecks.isValidNumber(rollingZ, 'Z-Score', true) || !isFinite(rollingZ) || Math.abs(rollingZ) > 10.0) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `🚨 قاطع الدائرة الإحصائي: مؤشر Z-Score شاذ أو فاسد (|Z|=${Math.abs(rollingZ).toFixed(2)} > 10.0 - Extreme Outlier)`,
                zScore: 0,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 6. Black Swan / Extreme Momentum check (|Z| > 4.0)
            if (Math.abs(rollingZ) > 4.0) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `⚠️ استبعاد بجعة سوداء: انحراف سعري مفرط ومخاطرة تصفية (|Z|=${Math.abs(rollingZ).toFixed(2)} > 4.0)`,
                zScore: parseFloat(rollingZ.toFixed(2)),
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            const zScore = parseFloat(rollingZ.toFixed(2));

            // 6. Whitelist & Non-Stablecoin Verification
            if (smartSelector.isStablecoin(symbol)) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `عملة مستقرة مستبعدة من التداول (${symbol})`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            if (!smartSelector.isWhitelisted(symbol)) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `خارج القائمة البيضاء المعتمدة لمؤسسة الفيوتشرز (${symbol})`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 7. Liquidity & Volume Verification ($30M-$50M+)
            if (volumeUsd < 30_000_000) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `عدم كفاية السيولة ($${(volumeUsd / 1e6).toFixed(1)}M أقل من الحد الأدنى $30M)`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 8. Spread Verification (<= 0.20%)
            const realSpreadPct = spreadPct > 1 ? spreadPct / 100 : spreadPct;
            if (realSpreadPct > 0.0020) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `سبريد مرتفع (${(realSpreadPct * 100).toFixed(3)}% يتجاوز الحد 0.20%)`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 9. Fast Instant Arbitrage Mean-Reversion Half-Life Speed Verification (0.5s - 60s)
            if (!SanityChecks.validateHalfLife(halfLife)) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `سرعة ارتداد غير مستقرة (Half-Life=${Math.round(halfLife)}s خارج نطاق التحكيم اللحظي 0.5s-60s)`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 10. Statistical Entry Threshold Divergence (|Z| >= config.entryZ e.g. 1.8)
            if (Math.abs(zScore) < config.entryZ) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `في منطقة التجميع الآمنة (|Z|=${Math.abs(zScore).toFixed(2)} أقل من حد الدخول ${config.entryZ})`,
                zScore,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // ✅ Passed all institutional filters: Calculate priority score
            const priorityScore = parseFloat((
              Math.abs(zScore) * 2.0 +
              Math.log10(Math.max(1, volumeUsd / 10_000_000)) * 1.5 +
              Math.max(0.1, (1800 - halfLife) / 600)
            ).toFixed(2));

            const passedObj = {
              ...p,
              price: currentPrice,
              zScore,
              volumeUsd,
              halfLife,
              priorityScore
            };

            passedOpportunities.push(passedObj);
            evaluatedCoins.push({
              symbol,
              status: 'PASSED',
              reason: `اجتازت كافة الفحوصات بنجاح ✅ (Z=${zScore > 0 ? '+' : ''}${zScore.toFixed(2)}, السيولة=$${(volumeUsd / 1e6).toFixed(1)}M, نصف العمر=${Math.round(halfLife)}s, النقاط=${priorityScore})`,
              zScore,
              volume: volumeUsd,
              halfLife,
              priorityScore
            });
          }

          // 📊 Print detailed diagnostic console logs for developer inspection
          if (evaluatedCoins.length > 0) {
            console.groupCollapsed(`[MultiCoin Scanner] 🔍 فحص وتقييم شامل لـ ${evaluatedCoins.length} عملة فيوتشرز | مؤهل للدخول: ${passedOpportunities.length}`);
            console.log(`⏱️ وقت الفحص: ${new Date().toLocaleTimeString('ar-SA')}`);
            
            const passed = evaluatedCoins.filter(c => c.status === 'PASSED');
            const rejected = evaluatedCoins.filter(c => c.status === 'REJECTED');

            if (passed.length > 0) {
              console.log('%c🟢 العملات التي اجتازت الفحص وجاهزة للتنفيذ:', 'color: #10b981; font-weight: bold;');
              passed.forEach(c => console.log(`  ✅ ${c.symbol.padEnd(10)} | Z=${c.zScore > 0 ? '+' : ''}${c.zScore.toFixed(2)} | حجم=$${(c.volume / 1e6).toFixed(1)}M | نصف العمر=${c.halfLife}s | Score=${c.priorityScore}`));
            } else {
              console.log('%c⚪ لم تجتز أي عملة حد الدخول الإحصائي Z >= ' + config.entryZ + ' في هذه الدورة.', 'color: #94a3b8;');
            }

            if (rejected.length > 0) {
              console.log('%c🔴 أسباب استبعاد العملات الأخرى في هذه الدورة:', 'color: #f43f5e; font-weight: bold;');
              rejected.forEach(c => console.log(`  ❌ ${c.symbol.padEnd(10)}: ${c.reason}`));
            }
            console.groupEnd();
          }

          // Priority Queue: Sort qualified opportunities descending
          const priorityOpportunities = passedOpportunities
            .sort((a: any, b: any) => b.priorityScore - a.priorityScore)
            .slice(0, 3); // STRICT LIMIT: Top 3 opportunities only

          // If bot is active and has qualified opportunities with room in portfolio
          if (botRunning && priorityOpportunities.length > 0 && positions.length < 3 && walletBalance >= 5) {
            const bestCandidate = priorityOpportunities[0];
            const isMicro = walletBalance < 50;
            const adaptiveLeverage = isMicro ? 4 : config.maxLeverage;
            const adaptiveMargin = isMicro ? Math.min(3.0, walletBalance * 0.15) : (walletBalance * config.maxPositionPct) / 3;
            const sizeUsd = Math.max(config.minExchangeNotionalUsd * 1.2, adaptiveMargin * adaptiveLeverage);

            const tradeRes = await fetch('/api/execution/trade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                position: {
                  id: `POS-${bestCandidate.symbol}-${Date.now()}`,
                  sizeUsd: parseFloat(sizeUsd.toFixed(2)),
                  beta: 1.0,
                  leverage: adaptiveLeverage,
                  symbol: bestCandidate.symbol
                },
                signal: {
                  signal: bestCandidate.zScore < 0 ? 'BUY' : 'SELL',
                  assetA: bestCandidate.symbol,
                  assetB: 'USDT',
                  entryPriceA: bestCandidate.price,
                  entryPriceB: 1.0
                }
              })
            });
            const tradeData = await tradeRes.json();
            if (tradeData.success) {
              // Persist genuine executed trade to StateDatabase
              await fetch('/api/quant/state/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  symbol: bestCandidate.symbol,
                  side: bestCandidate.zScore < 0 ? 'LONG' : 'SHORT',
                  entryPrice: bestCandidate.price,
                  size: parseFloat((sizeUsd / bestCandidate.price).toFixed(4)),
                  stopLoss: parseFloat((bestCandidate.price * (bestCandidate.zScore < 0 ? 0.985 : 1.015)).toFixed(4)),
                  takeProfit: parseFloat((bestCandidate.price * (bestCandidate.zScore < 0 ? 1.025 : 0.975)).toFixed(4))
                })
              }).catch(() => {});

              fetchUniversalState();
            }
          }
        }
      } catch (err) {
        console.error("Multi-coin market evaluation error:", err);
      }
    };

    evaluateMultiCoinMarket();
    const interval = setInterval(evaluateMultiCoinMarket, 5000);
    return () => clearInterval(interval);
  }, [botRunning, config, positions.length, walletBalance]);

  const handleClosePosition = async (id: string) => {
    try {
      const symbol = id.replace(/^EXG-|^POS-/, '');
      await fetch('/api/execution/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      await fetchRealBybitState();
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botRunning={botRunning}
        setBotRunning={handleToggleBotRunning}
        equity={equity}
        dailyPnl={dailyPnl}
        walletBalance={walletBalance}
        isPaperTrading={isPaperTrading}
        onTogglePaperTrading={handleTogglePaperTrading}
        paperBalance={paperBalance}
        wsStatus={wsStatus}
        onRecoverState={handleRecoverState}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            botRunning={botRunning}
            setBotRunning={handleToggleBotRunning}
            equity={equity}
            dailyPnl={dailyPnl}
            latestTick={latestTick}
            positions={positions}
            onClosePosition={handleClosePosition}
            walletBalance={walletBalance}
            setWalletBalance={setWalletBalance}
            onNavigateTab={setActiveTab}
          />
        )}
        {activeTab === 'paper' && (
          <PaperTradingManagerView
            isPaperTrading={isPaperTrading}
            onTogglePaperTrading={(active) => {
              setIsPaperTrading(active);
              fetchUniversalState();
            }}
            botRunning={botRunning}
          />
        )}
        {activeTab === 'vault' && (
          <SecretVaultView onCredentialsUpdated={fetchRealBybitState} />
        )}
        {activeTab === 'alerts' && <AlertsManagerView />}
        {activeTab === 'copilot' && (
          <GeminiQuantCopilot
            botRunning={botRunning}
            walletBalance={walletBalance}
            equity={equity}
            dailyPnl={dailyPnl}
            positionsCount={positions.length}
            creatorEmail="pal.c88@gmail.com"
          />
        )}
      </main>

      <footer className="bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 py-4 text-center font-sans">
        منظومة أوميغا كوانت برين الموحدة v5.5 • عقل كمي موحد ينفذ التكيف واللوامس ومطابقة API والفلترة أوتوماتيكياً بالخلفية
      </footer>
    </div>
  );
}
