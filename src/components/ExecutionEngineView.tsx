import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  ShieldCheck,
  RefreshCw,
  Trash2,
  Clock,
  TrendingUp,
  AlertTriangle,
  Server,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  Sliders,
  Send
} from 'lucide-react';
import { ExecutionTelemetry } from '../types';

interface ExecutionEngineViewProps {
  walletBalance: number;
}

export const ExecutionEngineView: React.FC<ExecutionEngineViewProps> = ({ walletBalance }) => {
  const [telemetry, setTelemetry] = useState<ExecutionTelemetry | null>(null);
  const [hybridExits, setHybridExits] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/execution/status');
      const data = await res.json();
      if (data.success) {
        setTelemetry(data);
      }
      const exitRes = await fetch('/api/execution/hybrid-exits');
      const exitData = await exitRes.json();
      if (exitData.success) {
        setHybridExits(exitData.activeExits || {});
      }
    } catch (err) {
      console.error('Error fetching execution telemetry:', err);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReconcileNow = async () => {
    setReconciling(true);
    try {
      const res = await fetch('/api/execution/reconcile-now', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionNotice('✅ تمت دورة مطابقة الأرصدة والتحقق منها عبر الـ API بنجاح!');
        fetchTelemetry();
      }
    } catch (err) {
      setActionNotice('❌ فشل استدعاء دورة المطابقة.');
    } finally {
      setReconciling(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleTestPairTrade = async () => {
    setExecutingTrade(true);
    try {
      const res = await fetch('/api/execution/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: {
            id: `POS-TEST-${Date.now()}`,
            sizeUsd: Math.max(10, walletBalance < 50 ? 10 : walletBalance * 0.1),
            beta: 31.25,
            leverage: 4
          },
          signal: {
            signal: 'BUY',
            assetA: 'BTCUSDT',
            assetB: 'ETHUSDT',
            entryPriceA: 75420,
            entryPriceB: 2415
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`✅ تم تنفيذ صفقة الزوج (Leg A + Leg B) بنجاح عبر المحرك بزمن استجابة ${data.latencyUs}µs`);
        fetchTelemetry();
      } else {
        setActionNotice(`⚠️ تنبيه التنفيذ: ${data.error}`);
      }
    } catch (err: any) {
      setActionNotice(`❌ خطأ تنفيذ: ${err.message}`);
    } finally {
      setExecutingTrade(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleCancelOrder = async (orderId: string, tradingPair: string) => {
    try {
      const res = await fetch('/api/execution/cancel-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, tradingPair })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`🗑️ تم إلغاء الأمر ${orderId} بنجاح.`);
        fetchTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelAll = async () => {
    try {
      const res = await fetch('/api/execution/cancel-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`🗑️ تم إلغاء ${data.cancelledCount} أمر نشط بنجاح.`);
        fetchTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCleanupStale = async () => {
    try {
      const res = await fetch('/api/execution/cleanup-stale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAgeSeconds: 300 })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`🧹 تم تنظيف وإلغاء ${data.cleanedCount} أمر قديم تجاوز مهلة 5 دقائق.`);
        fetchTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseHybridExit = async (symbol: string) => {
    try {
      const res = await fetch('/api/execution/hybrid-exits/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`🛡️ ${data.message}`);
        fetchTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className="bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 px-5 py-3 rounded-xl shadow-lg flex items-center justify-between text-xs font-sans animate-fade-in">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header Hub */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 space-x-reverse mb-1">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h1 className="text-lg font-bold text-white">
                محرك التنفيذ الفعلي والمطابقة المدمج (Hummingbot & Reconciliation Core)
              </h1>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                Direct In-Memory Core
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              تم دمج الملفات الأربعة الحرجة ككتلة واحدة في قلب البوت: منفذ الصفقات الفعلي (Hummingbot Executor)، متتبع دورة حياة الأوامر (Order Tracker)، مطابقة الأرصدة الذكية (Reconciliation)، ومحدد المعدلات المتكيف (Adaptive Rate Limiter).
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleReconcileNow}
              disabled={reconciling}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin' : ''}`} />
              <span>{reconciling ? 'جاري المطابقة...' : 'مطابقة الأرصدة الآن'}</span>
            </button>

            <button
              onClick={handleTestPairTrade}
              disabled={executingTrade}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{executingTrade ? 'جاري التنفيذ...' : 'تنفيذ صفقة زوجية تجريبية (A+B)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Pillars Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Hummingbot Executor */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-sans">1. المنفذ الفعلي (Executor)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="text-white font-bold text-sm font-mono">
            {(telemetry?.reconciliation?.lastSnapshot as any)?.exchangeName || telemetry?.executor?.connectorName || 'Binance / Bybit'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>الشبكة: {telemetry?.executor?.testnet ? 'Testnet آمن' : 'إنتاج حي'}</span>
            <span className="text-emerald-400 font-mono">Rollback ذري مفعل</span>
          </div>
        </div>

        {/* 2. Adaptive Rate Limiter */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-sans">2. حماية الـ Rate Limit</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-mono">
              {(telemetry?.reconciliation?.lastSnapshot as any)?.exchangeName || 'API Limiter'}
            </span>
          </div>
          <div className="text-white font-bold text-sm font-mono">
            هامش أمان: {telemetry?.adaptiveMetrics?.safetyMarginPct ?? 80}%
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>نسبة النجاح: {telemetry?.adaptiveMetrics?.successRatePct ?? 100}%</span>
            <span className={telemetry?.rateLimiter?.backoffActive ? 'text-rose-400' : 'text-emerald-400'}>
              {telemetry?.rateLimiter?.backoffActive ? `توقف ${telemetry?.rateLimiter?.backoffRemainingSec}s` : 'سلس وطبيعي'}
            </span>
          </div>
        </div>

        {/* 3. Order Tracker */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-sans">3. متتبع الأوامر (Tracker)</span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-mono">
              {telemetry?.orderTracker?.activeOrders ?? 0} في السوق
            </span>
          </div>
          <div className="text-white font-bold text-sm font-mono">
            إجمالي: {telemetry?.orderTracker?.totalOrders ?? 0} أمر
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>التنفيذ الناجح: {telemetry?.orderTracker?.successfulOrders ?? 0}</span>
            <span className="text-slate-400">فحص الأوامر المعلقة</span>
          </div>
        </div>

        {/* 4. Reconciliation Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-sans">4. مطابقة الأرصدة (Reconcile)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              telemetry?.reconciliation?.lastSnapshot?.matched !== false
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
            }`}>
              {telemetry?.reconciliation?.lastSnapshot?.matched !== false ? 'متطابق' : 'فارق مرصود'}
            </span>
          </div>
          <div className="text-white font-bold text-sm font-mono">
            الفارق: ${telemetry?.reconciliation?.lastSnapshot?.discrepancy ?? 0.0}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
            <span>كل 60 ثانية آلياً</span>
            <span className="text-cyan-400 font-mono">حد الأمان $10</span>
          </div>
        </div>
      </div>

      {/* Rate Limiter Gauges & Endpoint Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">سعة نقاط اتصال المنصة والحدود المتكيفة (Rate Limits)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">محمي من حظر الـ IP أو رفض الأوامر</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Order Endpoint */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold">أوامر التداول (/order)</span>
              <span className="text-cyan-400">
                {telemetry?.rateLimiter?.endpoints?.order?.currentWeight ?? 0} / 100
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{
                  width: `${Math.min(100, (telemetry?.rateLimiter?.endpoints?.order?.utilization ?? 0) * 100)}%`
                }}
              />
              <div className="absolute right-[80%] top-0 bottom-0 w-0.5 bg-amber-400/70" title="حد الأمان 80%" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>نافذة زمنية: 10 ثوانٍ</span>
              <span>المتبقي: {telemetry?.rateLimiter?.endpoints?.order?.remaining ?? 100}</span>
            </div>
          </div>

          {/* Query Endpoint */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold">استعلام الأرصدة (/query)</span>
              <span className="text-indigo-400">
                {telemetry?.rateLimiter?.endpoints?.query?.currentWeight ?? 0} / 600
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-indigo-400 transition-all duration-300"
                style={{
                  width: `${Math.min(100, (telemetry?.rateLimiter?.endpoints?.query?.utilization ?? 0) * 100)}%`
                }}
              />
              <div className="absolute right-[80%] top-0 bottom-0 w-0.5 bg-amber-400/70" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>نافذة زمنية: 60 ثانية</span>
              <span>المتبقي: {telemetry?.rateLimiter?.endpoints?.query?.remaining ?? 600}</span>
            </div>
          </div>

          {/* Ticker Endpoint */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 font-bold">بيانات الأسعار (/ticker)</span>
              <span className="text-emerald-400">
                {telemetry?.rateLimiter?.endpoints?.ticker?.currentWeight ?? 0} / 1200
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{
                  width: `${Math.min(100, (telemetry?.rateLimiter?.endpoints?.ticker?.utilization ?? 0) * 100)}%`
                }}
              />
              <div className="absolute right-[80%] top-0 bottom-0 w-0.5 bg-amber-400/70" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-sans">
              <span>نافذة زمنية: 60 ثانية</span>
              <span>المتبقي: {telemetry?.rateLimiter?.endpoints?.ticker?.remaining ?? 1200}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Reconciliation Drift & History */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">مطابقة الأرصدة الشاملة للـ APIs الربط (Multi-API Balance Audit)</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            المنصة النشطة: <span className="text-amber-400 font-bold">{(telemetry?.reconciliation?.lastSnapshot as any)?.exchangeName || 'Binance / Bybit'}</span>
          </span>
        </div>

        {/* Verification & Guard Notice */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 space-x-reverse text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              <strong>شرط التداول الآلي:</strong> البوت يبدأ التداول فقط بعد التعرف على أرصدة حقيقية ومطابقتها وتأكيدها عبر الـ API.
            </span>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">
            {(telemetry?.reconciliation?.lastSnapshot as any)?.verified ? 'تم التحقق والمطابقة ✅' : 'في انتظار ربط API ورصيد'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-right font-mono">
          <div className="space-y-1">
            <span className="text-xs text-slate-400 block font-sans">رصيد البوت المستهدف</span>
            <span className="text-white text-lg font-bold">${walletBalance.toFixed(2)}</span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 block font-sans">رصيد الـ API الفعلي والمطابق</span>
            <span className="text-cyan-400 text-lg font-bold">
              ${(telemetry?.reconciliation?.lastSnapshot?.exchangeBalance ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 block font-sans">فارق الانحراف (Discrepancy)</span>
            <span className="text-emerald-400 text-lg font-bold">
              ${telemetry?.reconciliation?.lastSnapshot?.discrepancy?.toFixed(2) ?? '0.00'}
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-400 block font-sans">جاهزية التداول الآلي</span>
            <span className={`text-xs font-bold font-sans flex items-center space-x-1 space-x-reverse ${
              (telemetry?.reconciliation?.lastSnapshot?.exchangeBalance ?? 0) > 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {(telemetry?.reconciliation?.lastSnapshot?.exchangeBalance ?? 0) > 0
                  ? 'الرصيد محقق وتصلح لفتح صفقات'
                  : 'توقف مؤقت بانتظار الرصيد المطابق'}
              </span>
            </span>
          </div>
        </div>

        {/* Snapshot Sparkline History */}
        {telemetry?.balanceHistory && telemetry.balanceHistory.length > 0 && (
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-sans block">سجل آخر عمليات المطابقة الدورية:</span>
            <div className="flex items-end space-x-1 space-x-reverse h-14 pt-2">
              {telemetry.balanceHistory.slice(-25).map((snap, idx) => {
                const heightPct = Math.max(15, Math.min(100, (snap.discrepancy / 2.0) * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-cyan-500/40 to-emerald-400/80 rounded-t hover:bg-cyan-300 transition-all cursor-pointer group relative"
                    style={{ height: `${heightPct}%` }}
                    title={`وقت: ${new Date(snap.timestamp * 1000).toLocaleTimeString('ar-SA')} | فارق: $${snap.discrepancy}`}
                  >
                    <div className="hidden group-hover:block absolute -top-8 right-0 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded border border-slate-700 whitespace-nowrap z-20 font-mono">
                      ${snap.discrepancy}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-sans">
              <span>قبل 25 دقيقة</span>
              <span>الآن</span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Hybrid Exit Protection System (Catastrophic SL + Z-Score Dynamic Mean Reversion) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Zap className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              شبكة الخروج الهجينة والحماية الكارثية (Hybrid Exit System)
            </h2>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono">
              {Object.keys(hybridExits).length} صفقات مؤمنة
            </span>
          </div>
          <div className="text-xs text-slate-400 font-sans">
            وقف كارثي 3% على المنصة + خروج ذكي ديناميكي عند عودة Z للصفر وتأكيد Hysteresis 3s
          </div>
        </div>

        {Object.keys(hybridExits).length === 0 ? (
          <div className="text-center py-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs font-sans">
            لا توجد صفقات مفتوحة تحتاج لحماية هجينة حالياً. يقوم البوت بتسليح الوقف تلقائياً فور فتح أي مركز تداول.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(hybridExits).map(([symbol, exit]: [string, any]) => (
              <div key={symbol} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="font-bold text-sm text-white font-mono">{symbol}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      exit.side === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {exit.side === 'BUY' ? 'LONG (شراء)' : 'SHORT (بيع)'}
                    </span>
                  </div>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                    حجم: {exit.size}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block font-sans">سعر الدخول:</span>
                    <span className="text-slate-200 font-bold">${exit.entryPrice?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">وقف كارثي (3%):</span>
                    <span className="text-rose-400 font-bold">${exit.slPrice?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">هدف المنصة (TP):</span>
                    <span className="text-emerald-400 font-bold">${exit.tpPrice?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-sans">انحراف الدخول (Z):</span>
                    <span className="text-amber-300 font-bold">{exit.entryZScore?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans pt-1">
                  <div className="flex items-center space-x-1.5 space-x-reverse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>خروج Z-Score: {exit.side === 'BUY' ? 'Z >= 0.0' : 'Z <= 0.0'}</span>
                  </div>
                  <button
                    onClick={() => handleCloseHybridExit(symbol)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] underline font-sans"
                  >
                    إلغاء وفك الحماية
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Tracker Table & Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Layers className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-white">
              الأوامر المفتوحة والمنفذة مؤخراً ({telemetry?.recentOrders?.length ?? 0})
            </h2>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handleCleanupStale}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-sans flex items-center space-x-1 space-x-reverse"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>تنظيف الأوامر المعلقة (أكثر من 5 دقائق)</span>
            </button>
            <button
              onClick={handleCancelAll}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs px-3 py-1.5 rounded-lg border border-rose-500/40 font-sans flex items-center space-x-1 space-x-reverse"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إلغاء الكل (Panic)</span>
            </button>
          </div>
        </div>

        {(!telemetry?.recentOrders || telemetry.recentOrders.length === 0) ? (
          <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-400 text-xs font-sans">
            لا توجد أوامر قيد التنفيذ حالياً. محرك Hummingbot في وضع الاستعداد بانتظار إشارات التحكيم الكمي.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-sans">رقم الأمر</th>
                  <th className="py-2.5 px-3 font-sans">الزوج</th>
                  <th className="py-2.5 px-3 font-sans">النوع</th>
                  <th className="py-2.5 px-3 font-sans">الكمية والسعر</th>
                  <th className="py-2.5 px-3 font-sans">الحالة</th>
                  <th className="py-2.5 px-3 font-sans">التنفيذ</th>
                  <th className="py-2.5 px-3 font-sans text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {telemetry.recentOrders.map((ord: any) => (
                  <tr key={ord.orderId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white">{ord.orderId}</td>
                    <td className="py-2.5 px-3 text-cyan-400">{ord.tradingPair}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.side === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {ord.side === 'BUY' ? 'شراء' : 'بيع'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {ord.amount} @ ${ord.price?.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans ${
                        ord.state === 'filled'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : ord.state === 'cancelled'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ord.state === 'filled' ? 'منفذ بالكامل' :
                         ord.state === 'submitted' ? 'مقدم للمنصة' :
                         ord.state === 'open' ? 'مفتوح في الدفتر' :
                         ord.state === 'cancelled' ? 'ملغي' : ord.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {ord.filledAmount ?? 0} / {ord.amount}
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      {(ord.state === 'open' || ord.state === 'submitted') && (
                        <button
                          onClick={() => handleCancelOrder(ord.orderId, ord.tradingPair)}
                          className="text-rose-400 hover:text-rose-300 text-[11px] font-sans underline"
                        >
                          إلغاء
                        </button>
                      )}
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
