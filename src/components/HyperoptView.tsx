import React, { useState } from 'react';
import { Cpu, Play, Loader2, Sparkles, CheckCircle2, TrendingUp, ShieldAlert, Sliders } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BotConfig, HyperoptResult, HyperoptTrial } from '../types';

interface HyperoptViewProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const HyperoptView: React.FC<HyperoptViewProps> = ({ config, setConfig }) => {
  const [trialsCount, setTrialsCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HyperoptResult | null>(null);
  const [applied, setApplied] = useState(false);

  const runHyperopt = async () => {
    setLoading(true);
    setApplied(false);
    try {
      const res = await fetch('/api/quant/hyperopt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trialsCount, objective: 'sharpe' })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyOptimizedParams = (trial: HyperoptTrial) => {
    setConfig(prev => ({
      ...prev,
      entryZ: Math.abs(trial.params.entryZ),
      exitZ: trial.params.exitZ,
      stopZ: Math.abs(trial.params.stopZ),
      minHalfLife: trial.params.minHalfLife,
      maxHalfLife: trial.params.maxHalfLife,
      maxPositionPct: trial.params.maxPositionPct,
    }));
    setApplied(true);
    setTimeout(() => setApplied(false), 4000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">استوديو تحسين المعاملات التلقائي (Hyperopt & Optuna)</h2>
              <p className="text-xs text-slate-400">محرك FreqAI للبحث البايزي (Bayesian Search) لإيجاد أفضل قيم لـ Z-Score وفلاتر كالمان ونصف العمر.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="flex items-center space-x-2 space-x-reverse bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-mono">عدد المحاولات (Trials):</span>
              <select
                value={trialsCount}
                onChange={(e) => setTrialsCount(Number(e.target.value))}
                className="bg-transparent text-white font-mono text-xs focus:outline-none"
              >
                <option value={25} className="bg-slate-900">25 تجربة</option>
                <option value={50} className="bg-slate-900">50 تجربة</option>
                <option value={100} className="bg-slate-900">100 تجربة</option>
              </select>
            </div>

            <button
              onClick={runHyperopt}
              disabled={loading}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center space-x-2 space-x-reverse shadow-lg shadow-cyan-500/20 text-xs"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{loading ? 'جاري التحسين التلقائي...' : 'تشغيل Hyperopt'}</span>
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs text-slate-300">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">دالة الهدف (Objective)</span>
            <span className="font-bold text-emerald-400 text-sm">تعظيم Sharpe Ratio</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">خوارزمية المعاينة (Sampler)</span>
            <span className="font-bold text-cyan-400 text-sm">TPESampler (Tree Parzen)</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">تقليم التجارب الفاشلة (Pruner)</span>
            <span className="font-bold text-indigo-400 text-sm">MedianPruner (Auto)</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px]">نطاق Z-Score المفحوص</span>
            <span className="font-bold text-purple-400 text-sm">-1.0 إلى -3.0</span>
          </div>
        </div>
      </div>

      {/* Hyperopt Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Best Parameters Card */}
          <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center space-x-3 space-x-reverse">
                <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                <div>
                  <h3 className="font-bold text-white text-base">أفضل تركيبة معايير مُكتشفة (Best Trial #{result.bestTrial.trialNumber})</h3>
                  <p className="text-xs text-slate-400">حققت أعلى معدل شارب مع أقل نسبة انخفاض في المحفظة.</p>
                </div>
              </div>

              <button
                onClick={() => applyOptimizedParams(result.bestTrial)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 text-xs flex items-center space-x-2 space-x-reverse"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تطبيق المعايير على البوت فوراً</span>
              </button>
            </div>

            {applied && (
              <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs font-bold text-center mb-4 flex items-center justify-center space-x-2 space-x-reverse">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم تحديث معايير البوت بنجاح بالقيم المحسنة!</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono text-xs">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">معدل Sharpe</span>
                <span className="text-emerald-400 font-bold text-base">{result.bestTrial.sharpe}</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">نسبة الفوز</span>
                <span className="text-cyan-400 font-bold text-base">{(result.bestTrial.winRate * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">عتبة الدخول (Entry Z)</span>
                <span className="text-purple-400 font-bold text-base">{result.bestTrial.params.entryZ}</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">وقف الخسارة (Stop Z)</span>
                <span className="text-rose-400 font-bold text-base">{result.bestTrial.params.stopZ}</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">أدنى نصف عمر (Half-Life)</span>
                <span className="text-indigo-400 font-bold text-base">{result.bestTrial.params.minHalfLife}s</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px]">حجم المركز الأقصى</span>
                <span className="text-amber-400 font-bold text-base">{(result.bestTrial.params.maxPositionPct * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Top Trials Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-4">أفضل 20 محاولة بالترتيب التنازلي</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4">رقم التجربة</th>
                    <th className="py-3 px-4">معدل Sharpe</th>
                    <th className="py-3 px-4">نسبة الفوز</th>
                    <th className="py-3 px-4">أقصى انخفاض</th>
                    <th className="py-3 px-4">Entry Z</th>
                    <th className="py-3 px-4">Stop Z</th>
                    <th className="py-3 px-4 text-left">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.trials.map((tr) => (
                    <tr key={tr.trialNumber} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">#{tr.trialNumber}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">{tr.sharpe}</td>
                      <td className="py-3 px-4 text-cyan-400">{(tr.winRate * 100).toFixed(1)}%</td>
                      <td className="py-3 px-4 text-rose-400">{(tr.maxDrawdown * 100).toFixed(1)}%</td>
                      <td className="py-3 px-4">{tr.params.entryZ}</td>
                      <td className="py-3 px-4">{tr.params.stopZ}</td>
                      <td className="py-3 px-4 text-left">
                        <button
                          onClick={() => applyOptimizedParams(tr)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg border border-slate-700 transition-colors font-sans text-[11px]"
                        >
                          تطبيق
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
