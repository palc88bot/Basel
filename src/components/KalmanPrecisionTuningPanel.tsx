import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Zap, RefreshCw, Activity, CheckCircle2, Info, ArrowUpRight } from 'lucide-react';

interface KalmanPrecisionTuningPanelProps {
  onClose?: () => void;
}

export const KalmanPrecisionTuningPanel: React.FC<KalmanPrecisionTuningPanelProps> = ({ onClose }) => {
  const [ve, setVe] = useState<number>(0.0005);
  const [vw, setVw] = useState<number>(0.0001);
  const [delta, setDelta] = useState<number>(0.0001);
  const [entryZ, setEntryZ] = useState<number>(2.0);

  const [saving, setSaving] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Live Metrics
  const [metrics, setMetrics] = useState<{
    beta: number;
    currentSpread: number;
    zScore: number;
    spreadStd: number;
    stabilityIndex: number;
    samplesCount: number;
  }>({
    beta: 1.0,
    currentSpread: 0,
    zScore: 0,
    spreadStd: 0,
    stabilityIndex: 95.0,
    samplesCount: 0,
  });

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/quant/kalman/config');
      const data = await res.json();
      if (data.success) {
        if (data.config) {
          setVe(data.config.ve ?? 0.0005);
          setVw(data.config.vw ?? 0.0001);
          setDelta(data.config.delta ?? 0.0001);
          setEntryZ(data.config.entryZThreshold ?? 2.0);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Kalman config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const timer = setInterval(fetchConfig, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleApplyConfig = async (
    customVe = ve,
    customVw = vw,
    customDelta = delta,
    customZ = entryZ
  ) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/quant/kalman/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ve: customVe,
          vw: customVw,
          delta: customDelta,
          entryZThreshold: customZ,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (data.metrics) {
          setMetrics(data.metrics);
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save Kalman config:', err);
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: 'institutional' | 'fast' | 'dampening') => {
    let newVe = 0.0005;
    let newVw = 0.0001;
    let newDelta = 0.0001;
    let newZ = 2.0;

    if (preset === 'institutional') {
      newVe = 0.0005;
      newVw = 0.0001;
      newDelta = 0.0001;
      newZ = 2.0;
    } else if (preset === 'fast') {
      newVe = 0.0001;
      newVw = 0.0005;
      newDelta = 0.0005;
      newZ = 1.8;
    } else if (preset === 'dampening') {
      newVe = 0.0010;
      newVw = 0.00005;
      newDelta = 0.0001;
      newZ = 2.2;
    }

    setVe(newVe);
    setVw(newVw);
    setDelta(newDelta);
    setEntryZ(newZ);
    handleApplyConfig(newVe, newVw, newDelta, newZ);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2 space-x-reverse">
              <span>لوحة الضبط والمعايرة الدقيقة لمرشح كالمان</span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded font-mono">
                Precision Tuning Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تعديل معاملات مرشح كالمان بالوقت الفعلي والتأثير المباشر على استقرار الـ Spread ونسبة التحوط (ETH/BTC)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <button
            onClick={fetchConfig}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="تحديث البيانات المباشرة"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              إغلاق
            </button>
          )}
        </div>
      </div>

      {/* Preset Profiles Bar */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300 block">أوضاع المعايرة الجاهزة (Presets):</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => applyPreset('institutional')}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-cyan-950/30 border border-slate-800 hover:border-cyan-500/40 transition-all text-right group"
          >
            <div>
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white group-hover:text-cyan-300">أوميقا المؤسسي (قياسي)</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Ve: 0.0005 | Vw: 0.0001 | Z: 2.0</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </button>

          <button
            onClick={() => applyPreset('fast')}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 transition-all text-right group"
          >
            <div>
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white group-hover:text-emerald-300">التكيف السريع (Fast Track)</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Ve: 0.0001 | Vw: 0.0005 | Z: 1.8</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </button>

          <button
            onClick={() => applyPreset('dampening')}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 transition-all text-right group"
          >
            <div>
              <div className="flex items-center space-x-1.5 space-x-reverse">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white group-hover:text-indigo-300">تصفية الضوضاء الشديدة</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Ve: 0.0010 | Vw: 0.00005 | Z: 2.2</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* Real-time Metric Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/90 p-4 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-[11px] text-slate-400 block">مؤشر استقرار السبريد</span>
          <div className="flex items-baseline space-x-1.5 space-x-reverse mt-1">
            <span className="text-lg font-bold font-mono text-emerald-400">
              {metrics.stabilityIndex.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              (Std: {metrics.spreadStd.toFixed(4)})
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, metrics.stabilityIndex))}%` }}
            />
          </div>
        </div>

        <div>
          <span className="text-[11px] text-slate-400 block">البيتا الحية ($\beta$)</span>
          <span className="text-lg font-bold font-mono text-cyan-400 mt-1 block">
            {metrics.beta.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1 font-mono">نسبة التحوط الحالية</span>
        </div>

        <div>
          <span className="text-[11px] text-slate-400 block">الـ Spread المتبقي (Residual)</span>
          <span className={`text-lg font-bold font-mono mt-1 block ${metrics.currentSpread >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
            {metrics.currentSpread.toFixed(4)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1 font-mono">الانحراف اللحظي عن كالمان</span>
        </div>

        <div>
          <span className="text-[11px] text-slate-400 block">درجة Z-Score الحالية</span>
          <span className={`text-lg font-bold font-mono mt-1 block ${Math.abs(metrics.zScore) >= entryZ ? 'text-emerald-400 animate-pulse' : 'text-slate-200'}`}>
            {metrics.zScore > 0 ? `+${metrics.zScore.toFixed(2)}` : metrics.zScore.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
            {Math.abs(metrics.zScore) >= entryZ ? '⚡ متجاوز لعتبة الدخول' : `العتبة: |Z| >= ${entryZ}`}
          </span>
        </div>
      </div>

      {/* Interactive Controls & Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sliders Column 1 */}
        <div className="space-y-5 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          {/* Ve Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-white flex items-center space-x-1.5 space-x-reverse">
                <span>ضوضاء الملاحظة القياسية ($V_e$)</span>
                <span className="text-[10px] text-cyan-400 font-mono">Measurement Noise</span>
              </label>
              <span className="font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50 text-xs">
                {ve.toFixed(5)}
              </span>
            </div>
            <input
              type="range"
              min="0.00001"
              max="0.00500"
              step="0.00005"
              value={ve}
              onChange={(e) => setVe(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>التحكم بالاستقرار:</strong> القيمة الأكبر تعني ثقة أعلى بالنموذج وتجاهل الميكرو-تقلبات اللحظية في السعر، مما يمنح استقراراً عالياً لـ Spread.
            </p>
          </div>

          {/* Vw Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-white flex items-center space-x-1.5 space-x-reverse">
                <span>ضوضاء عملية الانتقال ($V_w$)</span>
                <span className="text-[10px] text-indigo-400 font-mono">Process Noise</span>
              </label>
              <span className="font-mono font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/50 text-xs">
                {vw.toFixed(5)}
              </span>
            </div>
            <input
              type="range"
              min="0.00001"
              max="0.00200"
              step="0.00005"
              value={vw}
              onChange={(e) => setVw(parseFloat(e.target.value))}
              className="w-full accent-indigo-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>سرعة التكيف:</strong> القيمة الأكبر تجعل معامل البيتا ($\beta$) يتكيف أسرع مع أي تحول هيكلي في العلاقة بين ETH و BTC.
            </p>
          </div>
        </div>

        {/* Sliders Column 2 */}
        <div className="space-y-5 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
          {/* Delta Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-white flex items-center space-x-1.5 space-x-reverse">
                <span>مقياس التغاير المبدئي ($\delta$)</span>
                <span className="text-[10px] text-emerald-400 font-mono">Initial Covariance</span>
              </label>
              <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50 text-xs">
                {delta.toFixed(5)}
              </span>
            </div>
            <input
              type="range"
              min="0.00001"
              max="0.00200"
              step="0.00005"
              value={delta}
              onChange={(e) => setDelta(parseFloat(e.target.value))}
              className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>سرعة التقارب:</strong> تحدد درجة المرونة الأولية لمصفوفة التغاير عند حساب أولى الخطوات الإحصائية.
            </p>
          </div>

          {/* Entry Z-Score Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-white flex items-center space-x-1.5 space-x-reverse">
                <span>عتبة دخول Z-Score الإحصائية</span>
                <span className="text-[10px] text-amber-400 font-mono">Entry Z-Threshold</span>
              </label>
              <span className="font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/50 text-xs">
                |Z| &gt;= {entryZ.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={entryZ}
              onChange={(e) => setEntryZ(parseFloat(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>حد الثقة:</strong> القيمة 2.0 تعني الاعتماد على فاصل ثقة 95.4% لمنع صفقات الضوضاء.
            </p>
          </div>
        </div>
      </div>

      {/* Real-Time Impact Explanation */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
        <div className="flex items-center space-x-2 space-x-reverse text-cyan-400 font-bold">
          <Info className="w-4 h-4" />
          <span>توضيح التأثير اللحظي على استقرار الـ Spread:</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
          <li>
            <strong>رفع قيم $V_e$ ({ve.toFixed(5)}):</strong> يقلل الحساسية لتقلبات الشموع اللحظية، مما يجعل خط الـ Spread هادئاً ويمنع الإشارات الخاطئة (False Positives).
          </li>
          <li>
            <strong>رفع قيم $V_w$ ({vw.toFixed(5)}):</strong> يزيد حركية معلمة $\beta$ لتتبع اتجاهات زوج ETH/BTC بمرونة، مما يخفض من مخاطر الانفصال الهيكلي.
          </li>
        </ul>
      </div>

      {/* Action Buttons & Feedback */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <div className="flex items-center space-x-2 space-x-reverse">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1.5 space-x-reverse bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم تطبيق المعايرة الجديدة حياً على محرك التداول بالخلفية!</span>
            </span>
          )}
        </div>

        <button
          onClick={() => handleApplyConfig()}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center space-x-2 space-x-reverse disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري المعايرة...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>تطبيق المعايرة اللحظية (Apply Live Tuning)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
