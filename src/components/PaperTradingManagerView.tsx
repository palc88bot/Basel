import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  Pause,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Activity,
  Sliders,
  Layers,
  XCircle,
  Download,
  RotateCcw
} from 'lucide-react';
import { PaperTradeRecord, PaperPositionRecord, PaperStatsSummary } from '../types';

interface PaperTradingManagerViewProps {
  isPaperTrading: boolean;
  onTogglePaperTrading: (active: boolean) => void;
  botRunning: boolean;
}

export const PaperTradingManagerView: React.FC<PaperTradingManagerViewProps> = ({
  isPaperTrading,
  onTogglePaperTrading,
  botRunning
}) => {
  const [stats, setStats] = useState<PaperStatsSummary | null>(null);
  const [positions, setPositions] = useState<PaperPositionRecord[]>([]);
  const [trades, setTrades] = useState<PaperTradeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | 'WIN' | 'LOSS' | 'LONG' | 'SHORT'>('ALL');
  const [resetBalanceInput, setResetBalanceInput] = useState<string>('1000');
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [testSymbol, setTestSymbol] = useState<string>('BTCUSDT');
  const [testAmount, setTestAmount] = useState<string>('50');

  const fetchPaperData = async () => {
    try {
      const [statsRes, posRes, tradesRes] = await Promise.all([
        fetch('/api/paper/stats'),
        fetch('/api/paper/positions'),
        fetch('/api/paper/trades?limit=100')
      ]);

      const statsData = await statsRes.json();
      const posData = await posRes.json();
      const tradesData = await tradesRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (posData.success) setPositions(posData.positions || []);
      if (tradesData.success) setTrades(tradesData.trades || []);
    } catch (err) {
      console.error('Failed to fetch paper trading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaperData();
    const interval = setInterval(fetchPaperData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/paper/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !isPaperTrading })
      });
      const data = await res.json();
      if (data.success) {
        onTogglePaperTrading(data.isPaperTrading);
        fetchPaperData();
      }
    } catch (err) {
      console.error('Failed to toggle paper trading:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    const bal = parseFloat(resetBalanceInput) || 1000;
    setActionLoading(true);
    try {
      const res = await fetch('/api/paper/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialBalance: bal })
      });
      const data = await res.json();
      if (data.success) {
        setShowResetModal(false);
        fetchPaperData();
      }
    } catch (err) {
      console.error('Failed to reset paper account:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePosition = async (symbol: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/paper/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      fetchPaperData();
    } catch (err) {
      console.error('Failed to close paper position:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteTestTrade = async (side: 'BUY' | 'SELL') => {
    setActionLoading(true);
    try {
      await fetch('/api/paper/test-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: testSymbol,
          side,
          amountUsd: parseFloat(testAmount) || 50
        })
      });
      fetchPaperData();
    } catch (err) {
      console.error('Failed to execute test paper trade:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTrades = trades.filter((t) => {
    if (filterType === 'WIN') return t.netPnl > 0;
    if (filterType === 'LOSS') return t.netPnl <= 0;
    if (filterType === 'LONG') return t.side === 'LONG';
    if (filterType === 'SHORT') return t.side === 'SHORT';
    return true;
  });

  const exportToCsv = () => {
    if (trades.length === 0) return;
    const headers = 'TradeID,Symbol,Side,EntryPrice,ExitPrice,Quantity,GrossPnl,Fees,Slippage,NetPnl,NetPnlPct,Reason,EntryTime,ExitTime\n';
    const rows = trades
      .map((t) =>
        [
          t.tradeId,
          t.symbol,
          t.side,
          t.entryPrice,
          t.exitPrice || '',
          t.quantity,
          t.grossPnl,
          t.fees,
          t.slippage,
          t.netPnl,
          t.netPnlPct,
          t.reason || '',
          new Date(t.entryTime).toISOString(),
          t.exitTime ? new Date(t.exitTime).toISOString() : ''
        ].join(',')
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `paper_trading_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Main Mode Toggle Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-3 space-x-reverse mb-2">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
                  <span>إعدادات التداول الافتراضي (Paper Trading Mode)</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono border ${
                      isPaperTrading
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {isPaperTrading ? '🧪 الوضع التجريبي مفعل (Testnet)' : '⚡ التداول الحي (Live Exchange)'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  محاكاة دقيقة لدفتر الأوامر، الانزلاق السعري (Slippage)، ورسوم المنصة لاختبار عقل OMEGA الكمي بأمان وبدون أي مخاطرة برأس المال.
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Switch Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggle}
              disabled={actionLoading}
              className={`px-5 py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center space-x-2 space-x-reverse ${
                isPaperTrading
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>{isPaperTrading ? '✅ التداول الافتراضي نشط' : 'تفعيل التداول الافتراضي (Paper)'}</span>
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-3 rounded-xl font-semibold text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all flex items-center space-x-1.5 space-x-reverse"
              title="إعادة ضبط الرصيد الافتراضي وسجل الصفقات"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400" />
              <span>إعادة ضبط الحساب التجريبي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Account Performance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Virtual Balance */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">الرصيد الافتراضي</span>
          <span className="text-lg font-mono font-bold text-white">
            ${stats ? stats.balance.toFixed(2) : '1,000.00'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            الأساس: ${stats ? stats.initialBalance.toFixed(2) : '1,000.00'}
          </span>
        </div>

        {/* Total Virtual PnL */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">إجمالي الربح/الخسارة</span>
          <span
            className={`text-lg font-mono font-bold ${
              stats && stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {stats && stats.totalPnl >= 0 ? '+' : ''}${stats ? stats.totalPnl.toFixed(2) : '0.00'}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              stats && stats.totalPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {stats && stats.totalPnlPct >= 0 ? '+' : ''}{stats ? stats.totalPnlPct.toFixed(2) : '0.00'}%
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">نسبة الفوز (Win Rate)</span>
          <span className="text-lg font-mono font-bold text-cyan-400">
            {stats ? stats.winRate.toFixed(1) : '0.0'}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {stats ? `${stats.winningTrades} رابحة / ${stats.losingTrades} خاسرة` : '0 / 0'}
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">معامل الربحية (Profit Factor)</span>
          <span className="text-lg font-mono font-bold text-indigo-300">
            {stats ? stats.profitFactor.toFixed(2) : '0.00'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            متوسط الربح: ${stats ? stats.avgWin.toFixed(2) : '0'}
          </span>
        </div>

        {/* Total Virtual Fees */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">الرسوم والانزلاق المحاكى</span>
          <span className="text-lg font-mono font-bold text-amber-300">
            ${stats ? (stats.totalFees + stats.totalSlippage).toFixed(3) : '0.000'}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            رسوم: ${stats ? stats.totalFees.toFixed(3) : '0'}
          </span>
        </div>

        {/* Max Drawdown */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-4">
          <span className="text-slate-400 text-xs block mb-1">أقصى تراجع (Max DD)</span>
          <span className="text-lg font-mono font-bold text-rose-300">
            {stats ? stats.maxDrawdown.toFixed(2) : '0.00'}%
          </span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">
            {stats?.openPositions || 0} مراكز مفتوحة
          </span>
        </div>
      </div>

      {/* Manual Quick Paper Order Testing Box */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200">
              تجربة تنفيذ أمر افتراضي فوري (Quick Paper Test Order):
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={testSymbol}
              onChange={(e) => setTestSymbol(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="BTCUSDT">BTCUSDT</option>
              <option value="ETHUSDT">ETHUSDT</option>
              <option value="SOLUSDT">SOLUSDT</option>
              <option value="BNBUSDT">BNBUSDT</option>
              <option value="XRPUSDT">XRPUSDT</option>
              <option value="ADAUSDT">ADAUSDT</option>
              <option value="DOGEUSDT">DOGEUSDT</option>
              <option value="AVAXUSDT">AVAXUSDT</option>
            </select>

            <div className="flex items-center space-x-1 space-x-reverse bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-400">$</span>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-16 bg-transparent text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="50"
              />
            </div>

            <button
              onClick={() => handleExecuteTestTrade('BUY')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all flex items-center space-x-1 space-x-reverse"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>شراء LONG</span>
            </button>

            <button
              onClick={() => handleExecuteTestTrade('SELL')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all flex items-center space-x-1 space-x-reverse"
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              <span>بيع SHORT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Open Paper Positions */}
      {positions.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>المراكز الافتراضية المفتوحة حالياً ({positions.length})</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">رافعة مالية 5x معزولة</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {positions.map((pos) => {
              const isProfit = pos.unrealizedPnl >= 0;
              return (
                <div
                  key={pos.symbol}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="font-bold text-sm text-white font-mono">{pos.symbol}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          pos.side === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </div>

                    <div className="text-left font-mono">
                      <span
                        className={`font-bold text-sm ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                      </span>
                      <span
                        className={`block text-[10px] ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        ({isProfit ? '+' : ''}{pos.unrealizedPnlPct.toFixed(2)}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded-lg">
                    <div>
                      <span>سعر الدخول: </span>
                      <span className="text-slate-200">${pos.entryPrice.toFixed(4)}</span>
                    </div>
                    <div>
                      <span>السعر الحالي: </span>
                      <span className="text-slate-200">${pos.currentPrice.toFixed(4)}</span>
                    </div>
                    <div>
                      <span>الكمية: </span>
                      <span className="text-slate-200">{pos.quantity}</span>
                    </div>
                    <div>
                      <span>الهامش: </span>
                      <span className="text-slate-200">${pos.margin.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClosePosition(pos.symbol)}
                    disabled={actionLoading}
                    className="w-full py-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center justify-center space-x-1 space-x-reverse"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>إغلاق المركز الآن</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dedicated Separate Virtual Results Log (سجل النتائج الافتراضية المنفصل) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2 space-x-reverse">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>سجل نتائج الصفقات الافتراضية المنفصل (Paper Trading Results Log)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تتبع دقيق ومنفصل لكافة الصفقات المنفذة في البيئة الافتراضية مع تفاصيل الربح والانزلاق والرسوم.
            </p>
          </div>

          {/* Filters & Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['ALL', 'WIN', 'LOSS', 'LONG', 'SHORT'] as const).map((ft) => (
                <button
                  key={ft}
                  onClick={() => setFilterType(ft)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    filterType === ft
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ft === 'ALL'
                    ? 'الكل'
                    : ft === 'WIN'
                    ? 'الرابحة'
                    : ft === 'LOSS'
                    ? 'الخاسرة'
                    : ft === 'LONG'
                    ? 'LONG'
                    : 'SHORT'}
                </button>
              ))}
            </div>

            <button
              onClick={exportToCsv}
              disabled={trades.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 space-x-reverse disabled:opacity-50"
              title="تصدير النتائج إلى ملف CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        {/* Results Table */}
        {filteredTrades.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <FlaskConical className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
            <p className="text-sm font-semibold">لا توجد صفقات افتراضية مسجلة حتى الآن</p>
            <p className="text-xs text-slate-500">
              عندما يعمل البوت في وضع Paper Trading، سيتم تسجيل كافة الصفقات وتفاصيل الربح والخسارة هنا تلقائياً.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3">الرمز والنوع</th>
                  <th className="py-2.5 px-3">سعر الدخول</th>
                  <th className="py-2.5 px-3">سعر الخروج</th>
                  <th className="py-2.5 px-3">الكمية</th>
                  <th className="py-2.5 px-3">صافي الربح ($ / %)</th>
                  <th className="py-2.5 px-3">الانزلاق والرسوم</th>
                  <th className="py-2.5 px-3">سبب الخروج</th>
                  <th className="py-2.5 px-3">الوقت والمدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredTrades.map((t) => {
                  const isProfit = t.netPnl > 0;
                  return (
                    <tr key={t.tradeId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-white text-xs">{t.symbol}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              t.side === 'LONG'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {t.side}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">${t.entryPrice.toFixed(4)}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {t.exitPrice ? `$${t.exitPrice.toFixed(4)}` : '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{t.quantity}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-xs">
                          <span className={isProfit ? 'text-emerald-400' : 'text-rose-400'}>
                            {isProfit ? '+' : ''}${t.netPnl.toFixed(2)}
                          </span>
                          <span
                            className={`block text-[10px] ${
                              isProfit ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            ({isProfit ? '+' : ''}{t.netPnlPct.toFixed(2)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400">
                        <span>انزلاق: ${t.slippage.toFixed(3)}</span>
                        <span className="block text-slate-500">رسوم: ${t.fees.toFixed(3)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-sans">
                          {t.reason || 'إشارة كمية'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400">
                        <span>{new Date(t.entryTime).toLocaleTimeString('ar-SA')}</span>
                        {t.duration && (
                          <span className="block text-slate-500">
                            {Math.round(t.duration / 1000)}s
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset Account Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 space-x-reverse text-cyan-400">
              <RotateCcw className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">إعادة ضبط الحساب التجريبي</h3>
            </div>

            <p className="text-xs text-slate-400">
              سيؤدي هذا الإجراء إلى مسح كافة الصفقات الافتراضية والمراكز المفتوحة، وإعادة تعيين الرصيد الافتراضي إلى المبلغ المحدد.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 block">الرصيد الافتراضي الجديد (USDT):</label>
              <input
                type="number"
                value={resetBalanceInput}
                onChange={(e) => setResetBalanceInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                placeholder="1000"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 space-x-reverse pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleReset}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 transition-all shadow-md"
              >
                تأكيد إعادة الضبط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
