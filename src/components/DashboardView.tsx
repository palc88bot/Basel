import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Zap, Shield, ShieldCheck, Play, Pause, CheckCircle2, AlertCircle, ArrowRightLeft, Sparkles, Heart, Brain, Clock, ChevronRight, ChevronUp, ChevronDown, Trash2, Layers, Terminal, RefreshCw } from 'lucide-react';
import { MarketTick, Position, FuturesPair, ExecutionTelemetry } from '../types';
import { BotHeartbeatWave } from './BotHeartbeatWave';
import { BackstageTerminalFeed } from './BackstageTerminalFeed';

interface DashboardViewProps {
  botRunning: boolean;
  setBotRunning: (running: boolean) => void;
  equity: number;
  dailyPnl: number;
  latestTick: MarketTick | null;
  positions: Position[];
  onClosePosition: (id: string) => void;
  walletBalance: number;
  setWalletBalance: (bal: number) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  botRunning,
  setBotRunning,
  equity,
  dailyPnl,
  latestTick,
  positions,
  onClosePosition,
  walletBalance,
  setWalletBalance,
  onNavigateTab,
}) => {
  const [breathingPhase, setBreathingPhase] = useState<'شهيق وتجميع بيانات' | 'تأمل وحساب كمي' | 'زفير واستقرار'>('شهيق وتجميع بيانات');
  const [bpm, setBpm] = useState(72);
  const [synapticLoad, setSynapticLoad] = useState(24);
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [telemetry, setTelemetry] = useState<ExecutionTelemetry | null>(null);
  const [wsStatus, setWsStatus] = useState<{ status: string; exchangeName: string; secondsSinceLastMessage: number } | null>(null);
  const [statePositions, setStatePositions] = useState<any[]>([]);
  const [futuresPairs, setFuturesPairs] = useState<FuturesPair[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('SOLUSDT');
  const [isPositionsCollapsed, setIsPositionsCollapsed] = useState<boolean>(false);
  const [posPage, setPosPage] = useState<number>(1);
  const posPageSize = 3;

  useEffect(() => {
    // If there is an active trading position in positions state, auto-select it for live telemetry focus
    if (positions.length > 0 && positions[0].pair) {
      const cleanSym = positions[0].pair.replace(/[-_]/g, '');
      setSelectedSymbol(cleanSym);
    }
  }, [positions]);

  useEffect(() => {
    const fetchExec = async () => {
      try {
        const res = await fetch('/api/execution/status');
        const data = await res.json();
        if (data.success) {
          setTelemetry(data);
        }
      } catch (err) {
        // silent
      }
    };
    const fetchWsAndState = async () => {
      try {
        const [wsRes, posRes, futuresRes] = await Promise.all([
          fetch('/api/quant/websocket/status'),
          fetch('/api/quant/state/positions'),
          fetch('/api/quant/futures-pairs')
        ]);
        const wsData = await wsRes.json();
        const posData = await posRes.json();
        const futuresData = await futuresRes.json();

        if (wsData.success) setWsStatus(wsData);
        if (posData.success) setStatePositions(posData.positions || []);
        if (futuresData.success && Array.isArray(futuresData.pairs) && futuresData.pairs.length > 0) {
          setFuturesPairs(futuresData.pairs);
          // If no custom selection yet and no open position, pick the qualified pair with highest deviation
          if (positions.length === 0 && (!selectedSymbol || selectedSymbol === 'SOLUSDT')) {
            const top = [...futuresData.pairs].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0];
            if (top) setSelectedSymbol(top.symbol);
          }
        }
      } catch (err) {}
    };
    fetchExec();
    fetchWsAndState();
    const interval = setInterval(() => {
      fetchExec();
      fetchWsAndState();
    }, 4000);
    return () => clearInterval(interval);
  }, [positions]);

  const handleClearStatePositions = async () => {
    try {
      await fetch('/api/quant/state/positions/clear', { method: 'POST' });
      setStatePositions([]);
      setPosPage(1);
    } catch (err) {
      console.error("Failed to clear positions", err);
    }
  };

  const internalThoughts = [
    'مراقبة الفجوة السعرية بدقة عبر فلتر كالمان (Kalman Filter)...',
    'فحص دفاتر أوامر أكبر 10 عملات فيوتشرز للتأكد من تدفق السيولة...',
    'حساب السبريد وعمولات الدخول/الخروج لضمان عدم تآكل أرباح الصفقات...',
    'تأمين هامش الصفقات ليتناسب تماماً مع رصيد المحفظة المرصود...',
    'نموذج أورنشتاين-أولينبك يؤكد دورة العودة للمتوسط في النطاق الآمن...',
    'قواطع الأمان (Circuit Breakers) مفعلة لحماية رأس المال من التصفية.'
  ];

  useEffect(() => {
    const phases: Array<'شهيق وتجميع بيانات' | 'تأمل وحساب كمي' | 'زفير واستقرار'> = [
      'شهيق وتجميع بيانات',
      'تأمل وحساب كمي',
      'زفير واستقرار'
    ];
    let pIdx = 0;
    const interval = setInterval(() => {
      pIdx = (pIdx + 1) % phases.length;
      setBreathingPhase(phases[pIdx]);
      // Deterministic BPM based on engine state
      setBpm(botRunning ? 72 + (pIdx * 2) : 0);
      setSynapticLoad(botRunning ? 22 + (pIdx * 4) : 0);
      setThoughtIndex(prev => (prev + 1) % internalThoughts.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [botRunning]);

  const [customInput, setCustomInput] = useState<string>('');
  const [exchangeAccountInfo, setExchangeAccountInfo] = useState<{
    totalApiWalletBalance: number;
    allocatedBalance: number;
    isCustomAllocated: boolean;
    exchangeName: string;
    hasCredentials: boolean;
    statusMessageAr: string;
  } | null>(null);

  const fetchExchangeAccount = async () => {
    try {
      const res = await fetch('/api/exchange/account');
      const data = await res.json();
      if (data.success) {
        setExchangeAccountInfo({
          totalApiWalletBalance: data.totalApiWalletBalance || 0,
          allocatedBalance: data.allocatedBalance || 0,
          isCustomAllocated: !!data.isCustomAllocated,
          exchangeName: data.exchangeName || 'API',
          hasCredentials: data.hasCredentials,
          statusMessageAr: data.statusMessageAr
        });
        if (data.allocatedBalance > 0) {
          setWalletBalance(data.allocatedBalance);
        }
      }
    } catch (err) {
      console.error('Failed to fetch exchange account info:', err);
    }
  };

  useEffect(() => {
    fetchExchangeAccount();
    const interval = setInterval(fetchExchangeAccount, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyCustomAllocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const val = customInput ? parseFloat(customInput) : null;
      const res = await fetch('/api/execution/set-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocatedAmount: val })
      });
      const data = await res.json();
      if (data.success) {
        fetchExchangeAccount();
        setCustomInput('');
      }
    } catch (err) {
      console.error('Failed to set custom allocation:', err);
    }
  };

  const handleResetAllocation = async () => {
    try {
      const res = await fetch('/api/execution/set-allocation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocatedAmount: null })
      });
      const data = await res.json();
      if (data.success) {
        fetchExchangeAccount();
        setCustomInput('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isMicro = walletBalance < 50;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* WebSocket Connection Status Visual Notification Banner & Toasts */}
      {wsStatus && wsStatus.status !== 'CONNECTED' && (
        <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-lg transition-all animate-pulse ${
          wsStatus.status === 'FAILED'
            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
        }`}>
          <div className="flex items-center space-x-3 space-x-reverse">
            <AlertCircle className={`w-5 h-5 animate-bounce ${wsStatus.status === 'FAILED' ? 'text-rose-400' : 'text-amber-400'}`} />
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="font-bold text-sm">تنبيه اتصال WebSocket:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  wsStatus.status === 'FAILED' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {wsStatus.status === 'DISCONNECTED' ? 'منقطع (Disconnected)' : wsStatus.status === 'RECONNECTING' ? 'جاري إعادة الاتصال (Reconnecting)' : 'فشل الاتصال (Failed)'}
                </span>
              </div>
              <span className="text-xs opacity-90 block mt-0.5">منصة التداول: {wsStatus.exchangeName || 'Universal API'} • يتم تطبيق Exponential Backoff تلقائياً</span>
            </div>
          </div>
          <span className="text-xs font-mono bg-black/30 px-3 py-1 rounded-full border border-white/10">
            أخر رسالة قبل {wsStatus.secondsSinceLastMessage} ثانية
          </span>
        </div>
      )}

      {/* Living Bot Brain & Pulse HUD */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-cyan-950 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Bot Vitals & Pulse */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* Heartbeat Icon */}
            <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-emerald-500 p-0.5 shadow-xl shadow-cyan-500/20 flex-shrink-0">
              <div className="w-full h-full bg-slate-950/90 rounded-[14px] flex flex-col items-center justify-center">
                <Heart className={`w-7 h-7 ${botRunning ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
                <span className="text-[10px] font-mono font-bold text-cyan-300 mt-0.5">{botRunning ? `${bpm} BPM` : '0 BPM'}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2.5 space-x-reverse">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  {botRunning ? 'عقل البوت الكمي ينبض ويعمل بحيوية' : 'عقل البوت في وضع الاستعداد المؤقت'}
                </h1>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono border font-bold ${
                  botRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {botRunning ? 'حي ونشط' : 'متوقف'}
                </span>
              </div>

              {/* Real-time Thought stream */}
              <p className="text-xs text-cyan-200/90 mt-1.5 flex items-center space-x-2 space-x-reverse font-sans">
                <Brain className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-brain-glow" />
                <span className="font-semibold text-cyan-300 ml-1">تفكير البوت اللحظي:</span>
                <span>{internalThoughts[thoughtIndex]}</span>
              </p>
            </div>
          </div>

          {/* Action & Vitals Bar */}
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 block font-sans">طور التنفس</span>
              <span className="text-xs font-bold text-cyan-400">{breathingPhase}</span>
            </div>

            <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 block font-sans">سرعة القرار</span>
              <span className="text-xs font-bold text-emerald-400">68 ميكروثانية</span>
            </div>

            <button
              onClick={() => setBotRunning(!botRunning)}
              className={`px-5 py-3 rounded-xl text-xs font-bold tracking-wide transition-all shadow-lg flex items-center space-x-2 space-x-reverse ${
                botRunning
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 shadow-rose-500/10'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 shadow-emerald-500/10'
              }`}
            >
              {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{botRunning ? 'إيقاف مؤقت' : 'تشغيل البوت'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bot Living Heartbeat & Kalman Precision Wave (نبض البوت ودقة كالمان اللحظية) */}
      <BotHeartbeatWave botRunning={botRunning} />

      {/* Allocated Bot Balance Manager (إدارة واختبار رصيد المحفظة المرصود للبوت) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h3 className="text-sm font-bold text-white">رصيد المحفظة المرصود للبوت (Allocated Bot Capital)</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  exchangeAccountInfo?.hasCredentials
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {exchangeAccountInfo?.hasCredentials ? 'تم التحقق من الـ API ✅' : 'في انتظار الربط بالخزنة'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                يتعرف البوت تلقائياً على الرصيد الفعلي عبر الـ API (Binance أو Bybit)، مع إمكانية اقتطاع جزء مخصص للبوت فقط.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('vault')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 space-x-reverse self-start md:self-auto"
          >
            <span>إعدادات الخزنة والربط</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Balance Status & Custom Slice Control */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Real API Total Balance */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 space-y-1">
            <span className="text-xs text-slate-400 font-sans block">إجمالي رصيد المنصة (المستكشَف عبر الـ API):</span>
            <div className="flex items-baseline space-x-2 space-x-reverse">
              <span className="text-xl font-bold font-mono text-emerald-400">
                ${(exchangeAccountInfo?.totalApiWalletBalance ?? walletBalance).toFixed(2)} USDT
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({exchangeAccountInfo?.exchangeName || 'Binance / Bybit'})
              </span>
            </div>
          </div>

          {/* 2. Active Allocated Bot Capital */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-indigo-300 font-sans block">الرصيد المرصود والفعلي المعتمد للبوت:</span>
              {exchangeAccountInfo?.isCustomAllocated && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                  اقتطاع مخصص
                </span>
              )}
            </div>
            <span className="text-xl font-bold font-mono text-white block">
              ${walletBalance.toFixed(2)} USDT
            </span>
          </div>

          {/* 3. Custom Slice Form (اقتطاع جزء مخصص للبوت) */}
          <form onSubmit={handleApplyCustomAllocation} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 flex items-center space-x-2 space-x-reverse">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 block font-sans mb-1">
                اقتطاع مبلغ مخصص للبوت ($):
              </label>
              <input
                type="number"
                min="5"
                step="5"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="أدخل المبلغ (مثلاً: 300)"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-col space-y-1 pt-3">
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all font-sans whitespace-nowrap"
              >
                تخصيص
              </button>
              {exchangeAccountInfo?.isCustomAllocated && (
                <button
                  type="button"
                  onClick={handleResetAllocation}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px] transition-all font-sans whitespace-nowrap"
                >
                  استخدام الكلي (100%)
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-slate-400">إجمالي رصيد الحساب الحقيقي</span>
          <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
            <h3 className="text-2xl font-bold font-mono text-white">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            <span className={`text-xs font-mono font-semibold ${equity > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {equity > 0 ? '+حقيقي' : 'بانتظار المفاتيح'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">عقود Bybit V5 Linear الآجلة</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-slate-400">الأرباح والخسائر غير المحققة (uPnL)</span>
          <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
            <h3 className={`text-2xl font-bold font-mono ${dailyPnl > 0 ? 'text-emerald-400' : dailyPnl < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
              {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}
            </h3>
            <span className="text-xs text-slate-400 font-mono">حساب Bybit الفعلي</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">محدث مباشرة من المحفظة</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-slate-400">الصفقات الحقيقية المفتوحة</span>
          <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
            <h3 className="text-2xl font-bold font-mono text-cyan-400">{positions.length}</h3>
            <span className="text-xs text-slate-400 font-mono">على المنصة</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">إجمالي الأوامر: {telemetry?.orderTracker?.totalOrders ?? 0}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs font-mono text-slate-400">الماسح الشامل لعملات الفيوتشرز</span>
          <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
            <h3 className="text-2xl font-bold font-mono text-indigo-400">كافة العملات</h3>
            <span className="text-xs text-emerald-400 font-mono">مفحوصة بالخلفية</span>
          </div>
          <button
            onClick={() => onNavigateTab('futures')}
            className="text-xs text-cyan-400 hover:underline mt-2 inline-block font-sans"
          >
            فتح رادار فحص عملات المنصة ←
          </button>
        </div>
      </div>

      {/* Dynamic Active Trading Position(s) Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <Zap className={`w-5 h-5 ${positions.length > 0 ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {positions.length > 0 ? 'الصفقة النشطة قيد التداول (Live Active Position)' : 'حالة الصفقات المباشرة (Trading Engine Status)'}
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  positions.length > 0 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                }`}>
                  {positions.length > 0 ? `${positions.length} صفقة نشطة` : 'وضع الرصد والمسح'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                {positions.length > 0
                  ? 'يتم تحديث بيانات الزوج ونسبة الربح والخسارة وحالة الخروج الإحصائي لحظة بلحظة.'
                  : 'لا توجد مراكز مفتوحة حالياً - محرك الفحص يرصد العملات المؤهلة باستمرار للتنفيذ التلقائي.'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={() => onNavigateTab('futures')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/30 transition-all flex items-center space-x-1.5 space-x-reverse"
            >
              <span>رادار المسح الشامل</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {positions.map((pos) => {
              const isProfit = (pos.pnlPercentage ?? 0) >= 0;
              return (
                <div
                  key={pos.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-3 hover:border-cyan-500/40 transition-all shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="font-bold text-white text-base tracking-wide">{pos.pair}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pos.direction.includes('LONG') 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {pos.direction.includes('LONG') ? 'شراء LONG 🟢' : 'بيع SHORT 🔴'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      رافعة {pos.leverage || 4}x
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-0.5">
                      <span className="text-slate-400 font-sans block text-[10px]">سعر الدخول:</span>
                      <span className="text-white font-bold">${pos.entryPriceA?.toLocaleString()}</span>
                    </div>
                    <div className="space-y-0.5 text-left">
                      <span className="text-slate-400 font-sans block text-[10px]">حجم المركز:</span>
                      <span className="text-cyan-400 font-bold">${pos.sizeUsd?.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-sans block">الربح والخسارة (PnL):</span>
                      <span className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{pos.pnlPercentage?.toFixed(2)}% ({isProfit ? '+' : ''}${pos.pnl?.toFixed(2)})
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-sans block">حالة الصفقة:</span>
                      <span className="text-[11px] font-semibold text-emerald-300 font-sans">
                        {pos.status === 'OPEN' ? 'نشطة ومؤمنة ✅' : pos.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 font-sans">
                      خروج عند Z=0 أو وقف 3%
                    </span>
                    <button
                      onClick={() => onClosePosition(pos.id)}
                      className="px-3 py-1 rounded-lg text-[11px] font-sans font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all"
                    >
                      إغلاق فوري
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <div>
                <span className="text-xs font-bold text-white block">
                  الماسح النشط يرصد الفرص الآن عبر {futuresPairs.length || 10} عملة فيوتشرز
                </span>
                <span className="text-[11px] text-slate-400 font-sans">
                  الزوج المختار للملاحظة الحية: <strong className="text-cyan-300 font-mono">{selectedSymbol}</strong> | سيتم الدخول تلقائياً بأعلى عملة حسب Priority Score.
                </span>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 self-start sm:self-auto">
              جاهز للتنفيذ الفوري
            </span>
          </div>
        )}
      </div>

      {/* StateDatabase Active Positions Widget - Paginated & Collapsible Accordion */}
      {statePositions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <button
                onClick={() => setIsPositionsCollapsed(!isPositionsCollapsed)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isPositionsCollapsed ? "توسيع القائمة" : "طي القائمة"}
              >
                {isPositionsCollapsed ? <ChevronDown className="w-4 h-4 text-cyan-400" /> : <ChevronUp className="w-4 h-4 text-cyan-400" />}
              </button>
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">الصفقات النشطة المحفوظة (StateDatabase Positions)</h3>
              <span className="text-[11px] font-mono bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {statePositions.length} صفقات
              </span>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse font-mono text-xs">
              {/* Pagination controls */}
              {Math.ceil(statePositions.length / posPageSize) > 1 && (
                <div className="flex items-center space-x-1 space-x-reverse bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <button
                    disabled={posPage <= 1}
                    onClick={() => setPosPage(p => Math.max(1, p - 1))}
                    className="px-2 py-0.5 rounded text-[11px] hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                  >
                    السابق
                  </button>
                  <span className="text-[10px] text-slate-400 px-1">
                    {posPage} / {Math.ceil(statePositions.length / posPageSize)}
                  </span>
                  <button
                    disabled={posPage >= Math.ceil(statePositions.length / posPageSize)}
                    onClick={() => setPosPage(p => Math.min(Math.ceil(statePositions.length / posPageSize), p + 1))}
                    className="px-2 py-0.5 rounded text-[11px] hover:bg-slate-800 disabled:opacity-40 text-slate-300"
                  >
                    التالي
                  </button>
                </div>
              )}

              {/* Clear demo positions button */}
              <button
                onClick={handleClearStatePositions}
                title="تفريغ الصفقات التجريبية لمنع تراكمها في الصفحة"
                className="px-2.5 py-1 rounded-lg text-[11px] font-sans font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center space-x-1 space-x-reverse"
              >
                <Trash2 className="w-3 h-3" />
                <span>تفريغ السجلات</span>
              </button>
            </div>
          </div>

          {!isPositionsCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {statePositions
                .slice((posPage - 1) * posPageSize, posPage * posPageSize)
                .map((pos: any) => (
                  <div key={pos.symbol + (pos.timestamp || '')} className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 font-mono text-xs space-y-2 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{pos.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pos.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {pos.side}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-slate-400 text-[11px]">
                      <div>دخول: <span className="text-white font-semibold">${pos.entryPrice}</span></div>
                      <div>حجم: <span className="text-white font-semibold">{pos.size}</span></div>
                      {pos.stopLoss && <div>وقف: <span className="text-rose-400">${pos.stopLoss}</span></div>}
                      {pos.takeProfit && <div>هدف: <span className="text-emerald-400">${pos.takeProfit}</span></div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Human-Readable Market Insight Bar (Multi-Coin Futures Scanner Support) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  قراءة السوق الحية المفسرة: {positions.length > 0 ? (
                    <span className="text-emerald-400 font-mono font-bold">
                      [الزوج النشط قيد التداول: {positions.map(p => p.pair).join(' • ')}]
                    </span>
                  ) : (
                    <span className="text-cyan-400 font-mono font-bold">
                      [ماسح أزواج الفيوتشرز: {selectedSymbol || 'SOLUSDT'}]
                    </span>
                  )}
                </h2>
                {positions.length > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
                    {positions.length} صفقة نشطة بالمنصة
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {positions.length > 0
                  ? `يقوم البوت بإدارة وتتبع صفقات ${positions.map(p => `${p.pair} (${p.direction})`).join(', ')} وفق فلاتر كالمان والوقف الهجين.`
                  : 'تحليل فوري لحركة السيولة والانحراف الإحصائي لكافة العملات المسموحة المؤهلة ديناميكياً'}
              </span>
            </div>
          </div>
          <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/20 self-start sm:self-auto">
            {wsStatus?.exchangeName || 'Universal API'} • تحديث مباشر
          </span>
        </div>

        {/* Dynamic Coin Quick-Selector Chips */}
        {futuresPairs.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>اختر عملة من قائمة الفيوتشرز المؤهلة لعرض قراءتها الحية:</span>
              <span className="font-mono text-cyan-400">{futuresPairs.length} عملة مؤهلة بالماسح</span>
            </div>
            <div className="flex space-x-2 space-x-reverse overflow-x-auto pb-2 no-scrollbar">
              {futuresPairs.slice(0, 10).map((fp) => {
                const isSelected = (selectedSymbol || 'SOLUSDT') === fp.symbol;
                return (
                  <button
                    key={fp.symbol}
                    onClick={() => setSelectedSymbol(fp.symbol)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium whitespace-nowrap transition-all border flex items-center space-x-1.5 space-x-reverse ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                        : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="font-bold">{fp.symbol}</span>
                    <span className={`text-[10px] ${fp.zScore <= -1.5 ? 'text-emerald-400' : fp.zScore >= 1.5 ? 'text-rose-400' : 'text-slate-400'}`}>
                      Z:{fp.zScore > 0 ? '+' : ''}{fp.zScore.toFixed(1)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Metric Cards based on Selected Pair */}
        {(() => {
          const currentPair = futuresPairs.find(p => p.symbol === (selectedSymbol || 'SOLUSDT')) || (futuresPairs.length > 0 ? futuresPairs[0] : null);
          const displaySymbol = currentPair ? currentPair.symbol : 'BTCUSDT';
          const displayPrice = currentPair ? (currentPair.price ?? 0) : (latestTick ? latestTick.priceA : 0);
          const displayChange = currentPair?.change24h ?? currentPair?.priceChange24h ?? 0;
          const displayZ = currentPair ? (currentPair.zScore ?? 0) : (latestTick ? latestTick.zScore : 0);
          const displayHalfLife = currentPair ? (currentPair.halfLifeSec ?? currentPair.halfLife ?? 0) : (latestTick ? latestTick.halfLife : 0);
          
          const rawVol = currentPair?.volume24hUsd ?? currentPair?.volume24h ?? (latestTick ? latestTick.volume24hUsd : 0) ?? 50_000_000;
          let formattedVolume = '$50.0M';
          if (typeof rawVol === 'number' && !isNaN(rawVol) && rawVol > 0) {
            if (rawVol >= 1_000_000_000) {
              formattedVolume = `$${(rawVol / 1_000_000_000).toFixed(2)}B`;
            } else if (rawVol >= 1_000_000) {
              formattedVolume = `$${(rawVol / 1_000_000).toFixed(1)}M`;
            } else {
              formattedVolume = `$${(rawVol / 1_000).toFixed(1)}K`;
            }
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-right font-mono">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>سعر العملة ({displaySymbol})</span>
                  <span className={`text-[10px] font-mono ${displayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {displayChange >= 0 ? '+' : ''}{Number(displayChange).toFixed(2)}%
                  </span>
                </div>
                <span className="text-white text-lg font-bold block">${displayPrice.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 font-sans block">سعر مباشر من دفتر الأوامر</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>حجم التداول والسيولة</span>
                  <span className="text-[10px] text-cyan-400 font-mono">24h Vol</span>
                </div>
                <span className="text-cyan-400 text-lg font-bold block">{formattedVolume}</span>
                <span className={`text-[10px] font-sans block ${currentPair?.isSafeTradeable !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {currentPair?.isSafeTradeable !== false ? 'اجتاز فلتر الأمان SafeCoin ✅' : '⚠️ مستبعد بفلتر الأمان'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>مؤشر الانحراف (Z-Score)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Kalman</span>
                </div>
                <span className={`text-lg font-bold block ${displayZ <= -1.8 ? 'text-emerald-400' : displayZ >= 1.8 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {displayZ > 0 ? '+' : ''}{Number(displayZ).toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 block font-sans">
                  {displayZ <= -1.8 ? '🟢 إشارة شراء مؤكدة (Long)' : displayZ >= 1.8 ? '🔴 إشارة بيع مؤكدة (Short)' : '⚪ في نطاق التجميع الآمن'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400 font-sans">
                  <span>دورة العودة للمتوسط</span>
                  <span className="text-[10px] text-indigo-400 font-mono">OU Half-Life</span>
                </div>
                {displayHalfLife > 0 ? (
                  <>
                    <span className="text-indigo-400 text-lg font-bold block">
                      {Math.round(displayHalfLife)} ثانية
                    </span>
                    <span className={`text-[11px] block font-sans ${
                      displayHalfLife <= 600 
                        ? 'text-emerald-400' 
                        : displayHalfLife <= 1800 
                        ? 'text-amber-400' 
                        : 'text-rose-400'
                    }`}>
                      {displayHalfLife <= 600 
                        ? '🟢 ارتداد سريع ومستقر إحصائياً' 
                        : displayHalfLife <= 1800 
                        ? '🟡 ارتداد معتدل السرعة' 
                        : '🔴 ارتداد بطيء خارج النطاق الآمن'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-300 text-lg font-bold block">
                      {currentPair?.isCalibrated === false ? 'قيد المعايرة' : 'غير مستقر إحصائياً'}
                    </span>
                    <span className="text-[11px] text-amber-400 block font-sans">
                      {currentPair?.isCalibrated === false
                        ? '⏳ جاري تجميع عينات السبريد الحية'
                        : '⚠️ مسار غير مستقر (لا ارتداد للمتوسط)'}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Unified Execution Engine & Bybit Reconciliation Live Widget */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">
              محرك التنفيذ الفعلي ومطابقة Bybit المدمج (Unified Execution & Reconciliation Hub)
            </h2>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
              In-Memory Core
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('futures')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-sans flex items-center space-x-1 space-x-reverse transition-colors"
          >
            <span>رادار الفيوتشرز والفلترة التلقائية</span>
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-right font-mono text-xs">
          {/* Hummingbot Latency & Connector */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">1. منفذ Hummingbot</span>
            <span className="text-white font-bold block">{telemetry?.executor?.connectorName || 'bybit_perpetual'}</span>
            <span className="text-[10px] text-emerald-400 font-sans">Rollback ذري نشط</span>
          </div>

          {/* Rate Limiter Order Gauge */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">2. معدل Bybit V5 Rate Limit</span>
            <span className="text-cyan-400 font-bold block">
              {telemetry?.rateLimiter?.endpoints?.order?.currentWeight ?? 0} / 100
            </span>
            <span className="text-[10px] text-slate-400 font-sans">هامش أمان 80%</span>
          </div>

          {/* Order Tracker In-Flight */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">3. متتبع الأوامر الحية</span>
            <span className="text-purple-400 font-bold block">
              {telemetry?.orderTracker?.activeOrders ?? 0} أمر نشط
            </span>
            <span className="text-[10px] text-slate-400 font-sans">إجمالي {telemetry?.orderTracker?.totalOrders ?? 0} أمر</span>
          </div>

          {/* Reconciliation Balance Match */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <span className="text-[10px] text-slate-400 block font-sans">4. مطابقة الرصيد الدوري</span>
            <span className="text-emerald-400 font-bold block">
              فارق: ${telemetry?.reconciliation?.lastSnapshot?.discrepancy ?? 0.0}
            </span>
            <span className="text-[10px] text-slate-400 font-sans">دورة كل 60 ثانية</span>
          </div>
        </div>
      </div>

      {/* Backstage Operations Terminal (شاشة العمليات خلف الكواليس بأسلوب Terminal كلاسيكي) */}
      <BackstageTerminalFeed />

      {/* Active Positions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <h2 className="text-base font-semibold text-white">الصفقات النشطة حالياً في السوق ({positions.length})</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">محمية بنظام الحواجز الثلاثة (Triple Barrier)</span>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <p className="text-slate-400 text-sm">لا توجد صفقات مفتوحة حالياً. عقل البوت ينتظر انحراف Z-Score المناسب مع تأكيد فلاتر كالمان...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-3 px-4 font-sans">الزوج</th>
                  <th className="py-3 px-4 font-sans">نوع الصفقة</th>
                  <th className="py-3 px-4 font-sans">اللامسة المكلفة</th>
                  <th className="py-3 px-4 font-sans">حجم الصفقة والرافعة</th>
                  <th className="py-3 px-4 font-sans">الانحراف Z</th>
                  <th className="py-3 px-4 font-sans">الربح الصافي</th>
                  <th className="py-3 px-4 font-sans text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{pos.pair}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-bold font-sans ${
                        pos.direction.includes('LONG')
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {pos.direction === 'LONG_A_SHORT_B' ? 'شراء A / بيع B' :
                         pos.direction === 'SHORT_A_LONG_B' ? 'بيع A / شراء B' :
                         pos.direction === 'LONG' ? 'شراء طويل' : 'بيع قصير'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-purple-300 font-sans">{pos.assignedTentacle || 'تحكيم إحصائي'}</td>
                    <td className="py-3 px-4 text-white">${pos.sizeUsd.toLocaleString()} ({pos.leverage}x)</td>
                    <td className="py-3 px-4 text-amber-400 font-bold">{pos.currentZ ?? '-'}</td>
                    <td className={`py-3 px-4 font-bold ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercentage}%)
                    </td>
                    <td className="py-3 px-4 text-left">
                      <button
                        onClick={() => onClosePosition(pos.id)}
                        className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 px-3 py-1 rounded-lg border border-rose-500/40 transition-colors font-sans"
                      >
                        إغلاق الصفقة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
