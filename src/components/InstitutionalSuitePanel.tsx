import React, { useState, useEffect } from 'react';
import { ShieldAlert, Zap, Bell, Activity, RefreshCw, Play, AlertTriangle, Send, Lock, CheckCircle2, Sliders, DollarSign, Layers } from 'lucide-react';
import { CircuitBreakerGuard } from '../quant/circuitBreakerGuard';
import { InBrowserBacktester, InBrowserBacktestResult } from '../quant/inBrowserBacktester';
import { NotificationService } from '../services/notificationService';
import { LatencySlippageMonitor } from '../monitoring/latencySlippageMonitor';
import { CollateralGuard } from '../quant/collateralGuard';

export const InstitutionalSuitePanel: React.FC = () => {
  // 1. Circuit Breaker State
  const cbGuard = CircuitBreakerGuard.getInstance();
  const [cbStatus, setCbStatus] = useState(cbGuard.getStatus());

  // 2. Backtester State
  const [backtestParams, setBacktestParams] = useState({
    symbolA: 'ETHUSDT',
    symbolB: 'BTCUSDT',
    daysHistory: 3,
    entryZ: 2.0,
    exitZ: 0.2,
    stopZ: 3.0,
    capitalUsd: 10000,
    leverage: 5
  });
  const [backtestResult, setBacktestResult] = useState<InBrowserBacktestResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // 3. Notifications State
  const notifService = NotificationService.getInstance();
  const [notifConfig, setNotifConfig] = useState(notifService.getConfig());
  const [testNotifSent, setTestNotifSent] = useState(false);

  // 4. Latency State
  const latMonitor = LatencySlippageMonitor.getInstance();
  const [avgLatency, setAvgLatency] = useState(latMonitor.getAverageLatencyMs());
  const [avgSlippage, setAvgSlippage] = useState(latMonitor.getAverageSlippageBps());

  // 5. Collateral State
  const collateralGuard = CollateralGuard.getInstance();
  const [collateralData, setCollateralData] = useState(collateralGuard.evaluateCollateralState([
    { name: 'Binance Futures', equity: 5000, usedMargin: 1200 },
    { name: 'Bybit Futures', equity: 5000, usedMargin: 800 }
  ]));

  useEffect(() => {
    const interval = setInterval(() => {
      setCbStatus(cbGuard.getStatus());
      setAvgLatency(latMonitor.getAverageLatencyMs());
      setAvgSlippage(latMonitor.getAverageSlippageBps());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleKillSwitch = () => {
    cbGuard.toggleEmergencyKillSwitch();
    setCbStatus(cbGuard.getStatus());
  };

  const handleRunBacktest = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const res = InBrowserBacktester.runSimulation({
        ...backtestParams,
        halfLifeCapSec: 60
      });
      setBacktestResult(res);
      setIsSimulating(false);
    }, 600);
  };

  const handleSaveNotifConfig = (updated: Partial<typeof notifConfig>) => {
    notifService.updateConfig(updated);
    setNotifConfig(notifService.getConfig());
  };

  const handleSendTestNotif = async () => {
    const ok = await notifService.sendDailySummaryAlert({
      totalTrades: 18,
      winRatePct: 77.8,
      netPnlUsd: 342.50,
      equityUsd: 10342.50
    });
    if (ok) {
      setTestNotifSent(true);
      setTimeout(() => setTestNotifSent(false), 3000);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 space-x-reverse mb-1">
              <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-md text-[11px] font-mono font-bold">
                INSTITUTIONAL INTEGRATION SUITE
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-md text-[11px] font-mono font-bold">
                HIGH-FREQUENCY READY
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-sans">حزمة الحماية والإشعارات والمحاكاة المؤسسية المتكاملة</h2>
            <p className="text-xs text-slate-400 font-sans">إدارة المخاطر الفورية، المحاكاة السريعة، إشعارات تلغرام، ورصد التأخير وتوازن الهامش</p>
          </div>

          {/* KILL SWITCH BUTTON */}
          <button
            onClick={handleToggleKillSwitch}
            className={`px-5 py-3 rounded-xl font-bold font-sans text-sm flex items-center space-x-2 space-x-reverse transition-all shadow-lg ${
              cbStatus.emergencyKillActive || cbStatus.isTripped
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50 animate-pulse'
                : 'bg-slate-800 hover:bg-rose-950/80 border border-rose-500/40 text-rose-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
            <span>
              {cbStatus.emergencyKillActive || cbStatus.isTripped ? '🚨 مفتاح الطوارئ مفعّل (إلغاء القفل)' : '⛔ مفتاح الطوارئ اللحظي (Panic Kill-Switch)'}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SYSTEM 1: CIRCUIT BREAKER & VOLATILITY GUARD */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">1. حارس الطوارئ وقطع الصفقات (Circuit Breaker)</h3>
                <p className="text-[11px] text-slate-400">مراقبة الانهيارات الفجائية وسقف التراجع اليومي</p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
              cbStatus.isTripped 
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              {cbStatus.isTripped ? 'حظر نشط ⛔' : 'حماية نشطة ✅'}
            </span>
          </div>

          <div className="space-y-3 font-sans text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block font-sans">سقف الخسارة اليومية الحالي:</span>
                <span className="text-white font-mono font-bold">{cbStatus.currentDailyDrawdownPct}% / 3.0%</span>
              </div>
              <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${cbStatus.currentDailyDrawdownPct > 2 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, (cbStatus.currentDailyDrawdownPct / 3) * 100)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block font-sans">حالة تقلب البيتكوين (Flash Crash Guard):</span>
                <span className={`font-mono font-bold ${
                  cbStatus.btcVolatilityStatus === 'FLASH_CRASH' ? 'text-rose-400' :
                  cbStatus.btcVolatilityStatus === 'ELEVATED' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {cbStatus.btcVolatilityStatus === 'FLASH_CRASH' ? '🚨 انهيار فجائي مسجل' :
                   cbStatus.btcVolatilityStatus === 'ELEVATED' ? '⚠️ تقلب مرتفع' : '🟢 مستقر تماماً'}
                </span>
              </div>
            </div>

            {cbStatus.isTripped && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                <strong>سبب التفعيل:</strong> {cbStatus.tripReason} ({cbStatus.trippedAt})
              </div>
            )}
          </div>
        </div>

        {/* SYSTEM 3: TELEGRAM & WEBHOOK NOTIFICATIONS */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">2. إشعارات التلغرام والـ Webhook الفورية</h3>
                <p className="text-[11px] text-slate-400">تنبيهات الصفقات اللحظية والتقارير اليومية</p>
              </div>
            </div>
            <button
              onClick={handleSendTestNotif}
              className="px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs rounded-lg font-sans transition-all flex items-center space-x-1 space-x-reverse"
            >
              <Send className="w-3.5 h-3.5" />
              <span>اختبار التنبيه</span>
            </button>
          </div>

          <div className="space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-300 font-sans">تفعيل إشعارات التلغرام</span>
              <input
                type="checkbox"
                checked={notifConfig.telegramEnabled}
                onChange={(e) => handleSaveNotifConfig({ telegramEnabled: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0"
              />
            </div>

            {notifConfig.telegramEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Telegram Bot Token"
                  value={notifConfig.telegramBotToken}
                  onChange={(e) => handleSaveNotifConfig({ telegramBotToken: e.target.value })}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
                <input
                  type="text"
                  placeholder="Telegram Chat ID"
                  value={notifConfig.telegramChatId}
                  onChange={(e) => handleSaveNotifConfig({ telegramChatId: e.target.value })}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            )}

            {testNotifSent && (
              <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs text-center font-sans">
                ✅ تم إرسال إشعار الاختبار بنجاح عبر قناة الإشعارات!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SYSTEM 2: REAL-TIME IN-BROWSER BACKTESTER */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400">
              <Play className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">3. محاكي الاختبار العكسي الفوري (In-Browser Backtester & Monte Carlo)</h3>
              <p className="text-[11px] text-slate-400">اختبار كفاءة المعاملات والـ Z-Score على بيانات السبريد التاريخية</p>
            </div>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={isSimulating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-purple-950/50 flex items-center space-x-2 space-x-reverse disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
            <span>{isSimulating ? 'جاري المحاكاة...' : 'تشغيل المحاكاة الفورية'}</span>
          </button>
        </div>

        {/* PARAMETERS INPUTS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 font-sans">حد الدخول (Entry Z):</label>
            <input
              type="number"
              step="0.1"
              value={backtestParams.entryZ}
              onChange={(e) => setBacktestParams({ ...backtestParams, entryZ: parseFloat(e.target.value) || 2.0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
            />
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 font-sans">أيام التاريخ (Days):</label>
            <input
              type="number"
              value={backtestParams.daysHistory}
              onChange={(e) => setBacktestParams({ ...backtestParams, daysHistory: parseInt(e.target.value) || 3 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
            />
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 font-sans">الرافعة المالية:</label>
            <input
              type="number"
              value={backtestParams.leverage}
              onChange={(e) => setBacktestParams({ ...backtestParams, leverage: parseInt(e.target.value) || 5 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
            />
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <label className="text-slate-400 block mb-1 font-sans">رأس المال (USD):</label>
            <input
              type="number"
              value={backtestParams.capitalUsd}
              onChange={(e) => setBacktestParams({ ...backtestParams, capitalUsd: parseInt(e.target.value) || 10000 })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
            />
          </div>
        </div>

        {/* RESULTS RESULTS */}
        {backtestResult && (
          <div className="p-4 bg-slate-950 rounded-xl border border-purple-500/20 font-sans text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <span className="text-slate-400 block text-[11px]">إجمالي الصفقات</span>
                <span className="text-white font-mono font-bold text-base">{backtestResult.totalTrades}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">نسبة النجاح (Win Rate)</span>
                <span className="text-emerald-400 font-mono font-bold text-base">{backtestResult.winRatePct}%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">معامل شارب (Sharpe)</span>
                <span className="text-purple-400 font-mono font-bold text-base">{backtestResult.sharpeRatio}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">أقصى تراجع (Max DD)</span>
                <span className="text-amber-400 font-mono font-bold text-base">-{backtestResult.maxDrawdownPct}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SYSTEM 4: LATENCY & SLIPPAGE MONITOR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">4. مرقاب التأخير والانزلاق (Latency & Slippage)</h3>
                <p className="text-[11px] text-slate-400">قياس زمن استجابة API والانزلاق السعري بالـ Bps</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
              مباشر
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-sans">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">زمن الاستجابة (API Latency):</span>
              <span className="text-emerald-400 font-mono font-bold text-lg">{avgLatency} ms</span>
              <span className="text-[10px] text-slate-500 block">استجابة فائقة السرعة</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block">الانزلاق السعري (Slippage):</span>
              <span className="text-cyan-400 font-mono font-bold text-lg">{avgSlippage} Bps</span>
              <span className="text-[10px] text-slate-500 block">أقل من الحد الأقصى المسموح</span>
            </div>
          </div>
        </div>

        {/* SYSTEM 5: COLLATERAL GUARD & AUTO-REBALANCER */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">5. مدير الهامش وإعادة التوازن (Collateral Guard)</h3>
                <p className="text-[11px] text-slate-400">تأمين حماية الحساب من مخاطر التصفية بين المنصات</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
              آمن (SAFE)
            </span>
          </div>

          <div className="space-y-2 text-xs font-sans">
            {collateralData.collateralList.map((ex, idx) => (
              <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-white font-bold block">{ex.exchangeName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">الهامش المتاح: ${ex.availableMarginUsd}</span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-emerald-400 font-bold block">مستوى الهامش: {ex.marginLevelPct}%</span>
                  <span className="text-[10px] text-slate-500">مخاطر التصفية: {ex.liquidationRiskScore}/100</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
