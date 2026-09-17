import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { FuturesTop10View } from './components/FuturesTop10View';
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
import { MarketTick, Position, BotConfig } from './types';
import {
  SmartPairSelector,
  SanityChecks,
  SafeCoinFilter,
  INSTITUTIONAL_ALLOWED_COINS
} from './quant';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [botRunning, setBotRunning] = useState(true);
  
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
    minHalfLife: 60,
    maxHalfLife: 1800,
    entryZ: 1.8,
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

  // Fetch Platform Config & Universal Account State
  const fetchUniversalState = async () => {
    try {
      const [configRes, accRes, posRes, futuresRes, engineRes] = await Promise.all([
        fetch('/api/exchange/platform-config'),
        fetch('/api/exchange/account'),
        fetch('/api/exchange/positions'),
        fetch('/api/quant/futures-pairs'),
        fetch('/api/execution/auto-engine')
      ]);
      const configData = await configRes.json();
      const accData = await accRes.json();
      const posData = await posRes.json();
      const futuresData = await futuresRes.json();
      const engineData = await engineRes.json().catch(() => ({ success: false }));

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
            const halfLife = typeof p.halfLifeSec === 'number' && !isNaN(p.halfLifeSec)
              ? p.halfLifeSec
              : (typeof p.halfLife === 'number' && !isNaN(p.halfLife) ? p.halfLife : 0);
            const spreadPct = Number(p.spreadPct) || 0.0005;

            // 1. Data Integrity: Strict numeric validity checks
            if (!SanityChecks.isValidNumber(currentPrice, `${symbol} price`, false) || currentPrice <= 0) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `🚨 خطأ في سلامة البيانات (السعر غير صالح: ${currentPrice})`,
                zScore: 0,
                volume: volumeUsd,
                halfLife
              });
              continue;
            }

            // 2. Maintain Dynamic Rolling Window Price History (Last 100 Periods)
            const hist = rollingPriceHistoryRef.current.get(symbol) || [];
            hist.push(currentPrice);
            if (hist.length > 100) {
              hist.shift();
            }
            rollingPriceHistoryRef.current.set(symbol, hist);

            // 3. Compute Rolling Z-Score derived from the last 100 periods
            let rollingZ = typeof p.zScore === 'number' && !isNaN(p.zScore) ? p.zScore : 0.0;
            if (hist.length >= 8) {
              const mean = hist.reduce((acc, val) => acc + val, 0) / hist.length;
              const variance = hist.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (hist.length - 1);
              const stdDev = Math.sqrt(variance);
              if (stdDev > 1e-6) {
                rollingZ = (currentPrice - mean) / stdDev;
              }
            }

            // 4. Hard-Coded Circuit Breaker against Extreme Outliers (|Z| > 10.0 or NaN/Inf)
            if (!SanityChecks.isValidNumber(rollingZ, 'Z-Score', true) || Math.abs(rollingZ) > 10.0) {
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

            // 5. Black Swan / Extreme Momentum check (|Z| > 4.0)
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

            // 9. Mean-Reversion Half-Life Speed Verification (60s - 1800s)
            if (!SanityChecks.validateHalfLife(halfLife)) {
              evaluatedCoins.push({
                symbol,
                status: 'REJECTED',
                reason: `سرعة ارتداد غير مستقرة (Half-Life=${Math.round(halfLife)}s خارج النطاق 60-1800s)`,
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
        {activeTab === 'futures' && (
          <FuturesTop10View walletBalance={walletBalance} />
        )}
        {activeTab === 'vault' && (
          <SecretVaultView onCredentialsUpdated={fetchRealBybitState} />
        )}
        {activeTab === 'alerts' && <AlertsManagerView />}
        {activeTab === 'copilot' && <GeminiQuantCopilot />}
      </main>

      <footer className="bg-slate-900/90 border-t border-slate-800 text-xs text-slate-400 py-4 text-center font-sans">
        منظومة أوميغا كوانت برين الموحدة v5.5 • عقل كمي موحد ينفذ التكيف واللوامس ومطابقة API والفلترة أوتوماتيكياً بالخلفية
      </footer>
    </div>
  );
}
