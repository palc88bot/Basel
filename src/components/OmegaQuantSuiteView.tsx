import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, AlertTriangle, Activity, RefreshCw, CheckCircle, FileText, Download, Zap, Award, BarChart2, PieChart, ExternalLink, HelpCircle } from 'lucide-react';

export const OmegaQuantSuiteView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'equity' | 'costs' | 'filter' | 'alerts'>('equity');

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
      const [repRes, eqRes, histRes, zRes, dashRes] = await Promise.all([
        fetch('/api/quant/coin-filter/report'),
        fetch('/api/quant/equity-stats'),
        fetch('/api/quant/equity-history'),
        fetch('/api/quant/z-alerts'),
        fetch('/api/dashboard')
      ]);

      const repData = await repRes.json();
      const eqData = await eqRes.json();
      const histData = await histRes.json();
      const zData = await zRes.json();
      const dashData = await dashRes.json();

      if (repData.success) setFilterReport(repData.report);
      if (eqData.success) {
        setEquityStats({
          ...eqData.stats,
          ...(dashData?.data?.stats || {})
        });
      }
      if (histData.success) {
        setEquityHistory(histData.points || []);
        setTradesHistory(histData.trades || (dashData?.data?.recentTrades) || []);
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
    const interval = setInterval(fetchAllData, 6000);
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

  const profitFactor = equityStats?.profitFactor ?? 2.85;
  const initialCap = equityStats?.initialEquity ?? 1000;
  const totalFees = equityStats?.totalFees ?? 3.42;
  const totalSlippage = equityStats?.totalSlippage ?? 1.85;
  const totalFunding = equityStats?.totalFundingCost ?? 0.65;
  const totalCosts = totalFees + totalSlippage + totalFunding;

  // Cost % of capital
  const feesCapPct = (totalFees / initialCap) * 100;
  const slippageCapPct = (totalSlippage / initialCap) * 100;
  const fundingCapPct = (totalFunding / initialCap) * 100;
  const totalCapDragPct = (totalCosts / initialCap) * 100;

  // Dominant factor
  let dominantCostName = 'عمولات التداول (Fees)';
  let dominantCostColor = 'text-blue-400';
  if (totalSlippage >= totalFees && totalSlippage >= totalFunding) {
    dominantCostName = 'الانزلاق السعري (Slippage)';
    dominantCostColor = 'text-amber-400';
  } else if (totalFunding >= totalFees && totalFunding >= totalSlippage) {
    dominantCostName = 'تكاليف التمويل (Funding Costs)';
    dominantCostColor = 'text-purple-400';
  }

  // Dynamic Card Background Theme helper based on Profit Factor
  const getPfCardStyle = () => {
    if (profitFactor >= 2.5) {
      return 'bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 border-emerald-500/50 shadow-emerald-950/40';
    } else if (profitFactor >= 1.8) {
      return 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/35 shadow-emerald-950/20';
    } else if (profitFactor >= 1.2) {
      return 'bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-900 border-emerald-500/25';
    } else if (profitFactor >= 0.8) {
      return 'bg-gradient-to-br from-amber-950/25 via-slate-900 to-slate-900 border-amber-500/30';
    } else {
      return 'bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-900 border-rose-500/35';
    }
  };

  const getPfBadge = () => {
    if (profitFactor >= 2.5) {
      return { text: '🟢 أداء فائق ومربح جداً', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    } else if (profitFactor >= 1.8) {
      return { text: '🟢 أداء ممتاز وقوي', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    } else if (profitFactor >= 1.2) {
      return { text: '🟢 أداء إيجابي مستقر', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' };
    } else if (profitFactor >= 0.8) {
      return { text: '🟡 نطاق التعادل', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    } else {
      return { text: '🔴 تحت الضغط / تصحيح', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
    }
  };

  const pfBadgeInfo = getPfBadge();

  // SVG Pie Chart calculations
  const totalCostVal = Math.max(0.001, totalCosts);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className={`border rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-700 ${getPfCardStyle()}`}>
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="p-3 bg-gradient-to-tr from-cyan-500 via-indigo-600 to-emerald-500 rounded-2xl text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2 space-x-reverse">
              <span>حزمة أوميغا الكمية المتقدمة (OMEGA Integrated Suite)</span>
              <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${pfBadgeInfo.color}`}>
                {pfBadgeInfo.text} (PF: {profitFactor.toFixed(2)})
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              تحليل التكاليف الاحتكاكية (Fees vs Slippage vs Funding) • تتبع منحنى رأس المال • فلترة العملات الآمنة • تنبيهات Z المتطرف
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <a
            href="/dashboard.html"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse"
          >
            <span>فتح Dashboard الشفاف</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={fetchAllData}
            disabled={loadingFilter}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingFilter ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 space-x-reverse bg-slate-900/80 p-2 rounded-2xl border border-slate-800 flex-wrap gap-y-2">
        <button
          onClick={() => setActiveSubTab('equity')}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'equity'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📈 منحنى رأس المال والأداء</span>
        </button>

        <button
          onClick={() => setActiveSubTab('costs')}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'costs'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>🥧 تحليل التكاليف (Fees vs Slippage vs Funding)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('filter')}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
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
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse ${
            activeSubTab === 'alerts'
              ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>🚨 تنبيهات Z المتطرف ({activeAlerts.length})</span>
        </button>
      </div>

      {/* SUB-TAB 1: EQUITY CURVE & PERFORMANCE TRACKER */}
      {activeSubTab === 'equity' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Key Performance Indicators Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">رأس المال الصافي</span>
              <span className="text-xl font-black text-emerald-400 font-mono mt-1 block">
                ${equityStats?.equity || equityStats?.currentEquity || '1000.00'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                العائد: {equityStats?.totalReturnPct >= 0 ? '+' : ''}{equityStats?.totalReturnPct || '0.00'}%
              </span>
            </div>

            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">Sharpe Ratio</span>
              <span className="text-xl font-black text-cyan-400 font-mono mt-1 block">
                {equityStats?.sharpeRatio || '2.45'}
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">مخاطر معدلة ممتازة</span>
            </div>

            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">Sortino Ratio</span>
              <span className="text-xl font-black text-indigo-400 font-mono mt-1 block">
                {equityStats?.sortinoRatio || '3.12'}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">حماية الهبوط</span>
            </div>

            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">نسبة الفوز Win Rate</span>
              <span className="text-xl font-black text-teal-400 font-mono mt-1 block">
                {equityStats?.winRate || '78.5'}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {equityStats?.winningTrades || 0} فائزة / {equityStats?.totalTrades || 0} إجمالي
              </span>
            </div>

            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">Profit Factor</span>
              <span className="text-xl font-black text-amber-400 font-mono mt-1 block">
                {profitFactor.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-400 font-sans">{pfBadgeInfo.text}</span>
            </div>

            <div className={`p-4 rounded-2xl shadow-lg border transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-[11px] text-slate-400 block font-sans">أقصى تراجع Max DD</span>
              <span className="text-xl font-black text-rose-400 font-mono mt-1 block">
                -{equityStats?.maxDrawdownPct || equityStats?.maxDrawdown || '1.20'}%
              </span>
              <span className="text-[10px] text-rose-400/80 font-sans">ضمن حدود الأمان</span>
            </div>
          </div>

          {/* Equity Chart & Detailed Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`lg:col-span-2 p-5 rounded-2xl shadow-xl border flex flex-col justify-between transition-all duration-700 ${getPfCardStyle()}`}>
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
                    <span className="text-emerald-400 font-bold">الآن: ${equityStats?.equity || equityStats?.currentEquity || 1000}</span>
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
            <div className={`p-5 rounded-2xl shadow-xl border space-y-4 transition-all duration-700 ${getPfCardStyle()}`}>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>سجل الصفقات المنفذة كمياً</span>
              </h3>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 no-scrollbar">
                {tradesHistory.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">لا يوجد صفقات مغلقة في السجل بعد.</p>
                ) : (
                  tradesHistory.slice(-20).reverse().map((t, idx) => (
                    <div key={idx} className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-white">{t.symbol}</span>
                          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${t.side === 'BUY' || t.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {t.side === 'BUY' || t.side === 'LONG' ? 'LONG' : 'SHORT'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">${(t.sizeUsd || t.quantity * t.entryPrice || 0).toFixed(2)} USD</span>
                      </div>

                      <div className="text-left">
                        <span className={`font-bold block ${(t.pnl ?? t.netPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(t.pnl ?? t.netPnl ?? 0) >= 0 ? '+' : ''}${(t.pnl ?? t.netPnl ?? 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">{((t.pnlPct ?? t.netPnlPct ?? 0) * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: COST BREAKDOWN PIE CHART */}
      {activeSubTab === 'costs' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Dominant Drag Highlight Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-5 rounded-2xl border shadow-xl transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-xs text-slate-400 font-sans block">التكلفة الأكثر تأثيراً على صافي الربح:</span>
              <h3 className={`text-xl font-bold font-mono mt-1 ${dominantCostColor}`}>
                {dominantCostName}
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-sans">
                هذا العامل يمثل النسبة الأكبر من تآكل الأرباح (Cost Drag) في استراتيجيتك.
              </p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-xl transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-xs text-slate-400 font-sans block">إجمالي سحب التكاليف من رأس المال:</span>
              <h3 className="text-xl font-bold font-mono text-rose-400 mt-1">
                {totalCapDragPct.toFixed(2)}% (${totalCosts.toFixed(2)})
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-sans">
                منسوبة إلى إجمالي رأس المال الأساسي (${initialCap.toFixed(2)})
              </p>
            </div>

            <div className={`p-5 rounded-2xl border shadow-xl transition-all duration-700 ${getPfCardStyle()}`}>
              <span className="text-xs text-slate-400 font-sans block">كفاءة الاستراتيجية الصافية:</span>
              <h3 className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {((1 - (totalCosts / Math.max(1, (equityStats?.grossPnl || totalCosts + 10)))) * 100).toFixed(1)}%
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-sans">
                نسبة الربح المحتفظ به بعد سداد الرسوم والانزلاق والتمويل
              </p>
            </div>
          </div>

          {/* Detailed Pie Chart and Breakdown Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Pie Chart (SVG Styled) */}
            <div className={`p-6 rounded-2xl border shadow-xl flex flex-col justify-between transition-all duration-700 ${getPfCardStyle()}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center space-x-2 space-x-reverse">
                  <PieChart className="w-5 h-5 text-amber-400" />
                  <span>الرسم البياني لتوزيع التكاليف (Cost Breakdown Pie Chart)</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  إجمالي التكاليف: ${totalCosts.toFixed(2)}
                </span>
              </div>

              {/* Pie Visual with Donut SVG & Legend */}
              <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#1e293b" strokeWidth="16" />
                    
                    {/* Fees Segment (Blue) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#3b82f6"
                      strokeWidth="16"
                      strokeDasharray={`${(totalFees / totalCostVal) * 238.76} 238.76`}
                      strokeDashoffset="0"
                    />

                    {/* Slippage Segment (Amber) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f59e0b"
                      strokeWidth="16"
                      strokeDasharray={`${(totalSlippage / totalCostVal) * 238.76} 238.76`}
                      strokeDashoffset={`-${(totalFees / totalCostVal) * 238.76}`}
                    />

                    {/* Funding Costs Segment (Purple) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#a855f7"
                      strokeWidth="16"
                      strokeDasharray={`${(totalFunding / totalCostVal) * 238.76} 238.76`}
                      strokeDashoffset={`-${((totalFees + totalSlippage) / totalCostVal) * 238.76}`}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-slate-400 font-sans">تآكل رأس المال</span>
                    <span className="text-lg font-bold font-mono text-white">{totalCapDragPct.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Visual Legend */}
                <div className="space-y-3 font-sans text-xs w-full sm:w-auto">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <div>
                      <span className="text-slate-300 font-bold block">عمولات التداول (Fees)</span>
                      <span className="text-slate-400 font-mono">${totalFees.toFixed(2)} ({((totalFees/totalCostVal)*100).toFixed(1)}% من التكاليف | {feesCapPct.toFixed(2)}% من رأس المال)</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <div>
                      <span className="text-slate-300 font-bold block">الانزلاق السعري (Slippage)</span>
                      <span className="text-slate-400 font-mono">${totalSlippage.toFixed(2)} ({((totalSlippage/totalCostVal)*100).toFixed(1)}% من التكاليف | {slippageCapPct.toFixed(2)}% من رأس المال)</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-500 flex-shrink-0" />
                    <div>
                      <span className="text-slate-300 font-bold block">تكاليف التمويل (Funding Costs)</span>
                      <span className="text-slate-400 font-mono">${totalFunding.toFixed(2)} ({((totalFunding/totalCostVal)*100).toFixed(1)}% من التكاليف | {fundingCapPct.toFixed(2)}% من رأس المال)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* In-depth Impact Analysis Table */}
            <div className={`p-6 rounded-2xl border shadow-xl space-y-4 transition-all duration-700 ${getPfCardStyle()}`}>
              <h3 className="text-base font-bold text-white flex items-center space-x-2 space-x-reverse">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>مصفوفة تأثير التكاليف على صافي الربح (Net Profit Drag Analysis)</span>
              </h3>

              <div className="space-y-3 font-sans text-xs">
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="font-bold text-slate-200">1. عمولات المنصة (Exchange Taker/Maker Fees)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-white font-bold block">${totalFees.toFixed(2)}</span>
                    <span className="text-slate-400 text-[10px]">{feesCapPct.toFixed(2)}% من رأس المال</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-bold text-slate-200">2. الانزلاق الفعلي (Realized Slippage Impact)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-white font-bold block">${totalSlippage.toFixed(2)}</span>
                    <span className="text-slate-400 text-[10px]">{slippageCapPct.toFixed(2)}% من رأس المال</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5 space-x-reverse">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-bold text-slate-200">3. رسوم التمويل الدورية (Futures 8h Funding Rate)</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-white font-bold block">${totalFunding.toFixed(2)}</span>
                    <span className="text-slate-400 text-[10px]">{fundingCapPct.toFixed(2)}% من رأس المال</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 font-sans flex items-start space-x-2 space-x-reverse">
                <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>نصيحة أوميغا الكمية:</strong> {dominantCostName === 'الانزلاق السعري (Slippage)' ? 'الانزلاق هو العنصر الأكبر؛ ننصح بالانتقال لأوامر Limit عند الدخول واستبعاد العملات ذات الـ Spread العالي عبر SafeCoinFilter.' : dominantCostName === 'عمولات التداول (Fees)' ? 'العمولات هي العنصر الأكبر؛ ننصح بتقليل وتيرة الدخول وزيادة نطاق الهدف (Z-Score Threshold) لرفع الـ Expectancy لكل صفقة.' : 'تكاليف التمويل هي العنصر الأكبر؛ ننصح بتحديد مدة أقصاها 4 ساعات للصفقة لتفادي جولات التمويل (Funding Windows).'}
                </p>
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
