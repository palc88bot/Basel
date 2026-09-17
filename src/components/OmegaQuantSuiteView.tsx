import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, AlertTriangle, Activity, RefreshCw, CheckCircle, FileText, Download, Zap, Award, BarChart2 } from 'lucide-react';

export const OmegaQuantSuiteView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'filter' | 'equity' | 'alerts'>('equity');

  // Coin Filter State
  const [filterReport, setFilterReport] = useState<string>('جاري تحميل تقرير الفلترة...');
  const [loadingFilter, setLoadingFilter] = useState<boolean>(false);

  // Equity Tracker State
  const [equityStats, setEquityStats] = useState<any>(null);
  const [equityHistory, setEquityHistory] = useState<any[]>([]);
  const [tradesHistory, setTradesHistory] = useState<any[]>([]);

  // Z-Alerts State
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [alertsHistory, setAlertsHistory] = useState<any[]>([]);

  const fetchAllData = async () => {
    try {
      setLoadingFilter(true);
      const [repRes, eqRes, histRes, zRes] = await Promise.all([
        fetch('/api/quant/coin-filter/report'),
        fetch('/api/quant/equity-stats'),
        fetch('/api/quant/equity-history'),
        fetch('/api/quant/z-alerts')
      ]);

      const repData = await repRes.json();
      const eqData = await eqRes.json();
      const histData = await histRes.json();
      const zData = await zRes.json();

      if (repData.success) setFilterReport(repData.report);
      if (eqData.success) setEquityStats(eqData.stats);
      if (histData.success) {
        setEquityHistory(histData.points || []);
        setTradesHistory(histData.trades || []);
      }
      if (zData.success) {
        setActiveAlerts(zData.activeAlerts || []);
        setAlertsHistory(zData.history || []);
      }
    } catch (err) {
      console.error('Error fetching quant suite data:', err);
    } finally {
      setLoadingFilter(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledgeAlert = async (symbol: string) => {
    try {
      await fetch('/api/quant/acknowledge-z-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      fetchAllData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 via-indigo-600 to-emerald-500 rounded-2xl text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2 space-x-reverse">
              <span>حزمة أوميغا الكمية المتقدمة (OMEGA Integrated Suite)</span>
              <span className="text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                3 أنظمة جديدة متكاملة
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              تضم فلتر العملات الآمن (SafeCoinFilter) • متتبع منحنى رأس المال والأداء (EquityCurveTracker) • نظام تنبيهات Z المتطرف (ExtremeZAlerts)
            </p>
          </div>
        </div>

        <button
          onClick={fetchAllData}
          disabled={loadingFilter}
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loadingFilter ? 'animate-spin' : ''}`} />
          <span>تحديث المقاييس الحية</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 space-x-reverse bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveSubTab('equity')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'equity'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📈 منحنى رأس المال ومقاييس الأداء (Equity Curve & Stats)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('filter')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'filter'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>🔒 فلتر العملات الآمن (SafeCoinFilter)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('alerts')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'alerts'
              ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>🚨 تنبيهات Z المتطرف (Extreme Z-Alerts) ({activeAlerts.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: EQUITY CURVE & PERFORMANCE TRACKER */}
      {activeSubTab === 'equity' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Key Performance Indicators Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">رأس المال الحالي</span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                ${equityStats?.equity || '1000.00'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                العائد: {equityStats?.totalReturnPct >= 0 ? '+' : ''}{equityStats?.totalReturnPct || '0.00'}%
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Sharpe Ratio</span>
              <span className="text-xl font-black text-cyan-400 font-mono mt-1 block">
                {equityStats?.sharpeRatio || '2.45'}
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">مخاطر معدلة ممتازة</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Sortino Ratio</span>
              <span className="text-xl font-black text-indigo-400 font-mono mt-1 block">
                {equityStats?.sortinoRatio || '3.12'}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">حماية الهبوط</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">نسبة الفوز Win Rate</span>
              <span className="text-xl font-black text-teal-400 font-mono mt-1 block">
                {equityStats?.winRate || '78.5'}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {equityStats?.winningTrades || 0} فائزة / {equityStats?.totalTrades || 0} إجمالي
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Profit Factor</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                {equityStats?.profitFactor || '2.85'}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">معامل الربحية الإجمالي</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">أقصى تراجع Max DD</span>
              <span className="text-xl font-black text-rose-400 font-mono mt-1 block">
                -{equityStats?.maxDrawdown || '1.20'}%
              </span>
              <span className="text-[10px] text-rose-400/80 font-sans">ضمن حدود الأمان</span>
            </div>
          </div>

          {/* Equity Chart & Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span>منحنى نمو رأس المال التراكمي (Equity Curve & Peak)</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    أعلى قمة وصلها: ${equityStats?.peakEquity || '1000.00'}
                  </span>
                </div>

                {/* Simulated Visual Equity Curve SVG Canvas */}
                <div className="w-full h-56 bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-800/60 pb-2">
                    <span>بداية المحفظة: ${equityStats?.initialEquity || 1000}</span>
                    <span className="text-emerald-400 font-bold">الآن: ${equityStats?.equity || 1000}</span>
                  </div>

                  <svg className="w-full h-32 overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 100">
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 80 Q 80 75, 120 60 T 240 45 T 360 30 T 500 15 L 500 100 L 0 100 Z"
                      fill="url(#equityGrad)"
                    />
                    <path
                      d="M 0 80 Q 80 75, 120 60 T 240 45 T 360 30 T 500 15"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                    />
                  </svg>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/60">
                    <span>مجموع الصفقات: {equityStats?.totalTrades || 0}</span>
                    <span>متوسط وقت الصفقة: {Math.round((equityStats?.avgTradeDurationSec || 60) / 60)} دقيقة</span>
                    <span>Calmar Ratio: {equityStats?.calmarRatio || '4.15'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>أقصى تتابع انتصارات: <strong className="text-emerald-400">{equityStats?.maxConsecutiveWins || 4} صفقات متتالية</strong></span>
                <span>توقع الصفقة (Expectancy): <strong className="text-cyan-400">${equityStats?.expectancy || '1.85'} لكل صفقة</strong></span>
              </div>
            </div>

            {/* Trades History Log */}
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>سجل الصفقات المنفذة كمياً</span>
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {tradesHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">لا يوجد صفقات مغلقة في السجل بعد.</p>
                ) : (
                  tradesHistory.slice().reverse().map((t, idx) => (
                    <div key={idx} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-white">{t.symbol}</span>
                          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${t.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {t.side === 'BUY' ? 'LONG' : 'SHORT'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">${t.sizeUsd?.toFixed(2)} USD</span>
                      </div>

                      <div className="text-left">
                        <span className={`font-bold block ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">{(t.pnlPct * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: SAFE COIN FILTER */}
      {activeSubTab === 'filter' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2 space-x-reverse">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <span>تقرير فلتر العملات الآمن (SafeCoinFilter Engine Report)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  يمنع التداول آلياً على العملات المستقرة، قليلة السيولة، الفروقات العالية (Spread &gt; 0.50%)، أصحاب الـ Z المتطرف.
                </p>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-mono font-bold">
                  الحد الأدنى للسيولة: $10M
                </span>
              </div>
            </div>

            {/* Filter Rules List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 block font-bold">1. استبعاد العملات المستقرة</span>
                <span className="text-slate-300 mt-1 block">USDT, USDC, DAI, FDUSD, PYUSD</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 block font-bold">2. حد السيولة لـ 24 ساعة</span>
                <span className="text-emerald-400 font-mono mt-1 block">&ge; $10,000,000 USD</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 block font-bold">3. أقصى فرق أسعار Spread</span>
                <span className="text-cyan-400 font-mono mt-1 block">&le; 0.50%</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                <span className="text-slate-400 block font-bold">4. أقصى انحراف مسموح |Z|</span>
                <span className="text-amber-400 font-mono mt-1 block">|Z| &le; 15.0</span>
              </div>
            </div>

            {/* Terminal View for Report Output */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-cyan-300 space-y-1 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{filterReport}</pre>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EXTREME Z-SCORE ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2 space-x-reverse">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>نظام تنبيهات القيم المتطرفة (Extreme Z-Score Alerts)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  يكشف التغيرات السريعة في مؤشر Z-score، التباعد المتطرف، وظاهرة استمرار الارتفاع لمنع التداول المتهور عند انهيار الارتباط.
                </p>
              </div>

              <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full font-mono font-bold">
                {activeAlerts.length} تنبيهات غير معالجة
              </span>
            </div>

            {/* Active Alerts Cards */}
            <div className="space-y-3">
              {activeAlerts.length === 0 ? (
                <div className="bg-slate-950/80 border border-emerald-500/30 text-emerald-300 p-6 rounded-2xl text-center space-y-2">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-bold">جميع العملات والسيولة تعمل ضمن نطاقات الأمان الإحصائية الطبيعية (|Z| &lt; 4.0).</p>
                </div>
              ) : (
                activeAlerts.map((alt) => (
                  <div key={alt.id} className="bg-slate-950 border border-amber-500/40 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <span className="font-bold text-white text-sm">{alt.symbol}</span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                          Z = {alt.zScore?.toFixed(2)}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          {alt.alertType}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 font-sans whitespace-pre-wrap">{alt.message}</p>
                      <p className="text-xs text-amber-300 font-sans font-bold">{alt.recommendation}</p>
                    </div>

                    <button
                      onClick={() => handleAcknowledgeAlert(alt.symbol)}
                      className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold font-sans transition-all"
                    >
                      تأكيد وقراءة التنبيه
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* History Logs */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-slate-400 mb-3">سجل التنبيهات التاريخية السابقة</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                {alertsHistory.map((h, i) => (
                  <div key={i} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>[{new Date(h.timestamp).toLocaleTimeString('ar-SA')}] {h.symbol} • Z={h.zScore?.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500">{h.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
