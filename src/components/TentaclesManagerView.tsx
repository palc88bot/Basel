import React from 'react';
import { Bot, Sliders, Play, Pause, RefreshCw, Layers, CheckCircle2, ShieldAlert, Zap, ArrowRightLeft } from 'lucide-react';
import { BotConfig } from '../types';

interface TentaclesManagerViewProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const TentaclesManagerView: React.FC<TentaclesManagerViewProps> = ({ config, setConfig }) => {
  const tentacles = [
    {
      id: 'stat_arb',
      name: 'Statistical Arbitrage Tentacle',
      arabicName: 'لامسة التحكيم الإحصائي (الرئيسية)',
      enabled: config.enableStatArb,
      toggle: () => setConfig(prev => ({ ...prev, enableStatArb: !prev.enableStatArb })),
      type: 'TRADING_MODE',
      description: 'تعمل مع عقل كالمان (Kalman Filter) و O-U لاصطياد الفجوات السعرية وتداول الأزواج المتزامنة.',
      metrics: 'الأصول: BTC / ETH | الهدف Z: 0.0 | الثقة: 70%+',
      badge: 'الأساسية'
    },
    {
      id: 'dca',
      name: 'Dollar Cost Averaging (DCA) Tentacle',
      arabicName: 'لامسة متوسط التكلفة التراكمي (DCA)',
      enabled: config.enableDCA,
      toggle: () => setConfig(prev => ({ ...prev, enableDCA: !prev.enableDCA })),
      type: 'TRADING_MODE',
      description: 'شراء تراكمي ذكي عند انخفاض السعر بنسبة محددة لتعزيز متوسط سعر الدخول في الاتجاهات القوية.',
      metrics: `الحجم: $${config.dcaAmountUsd} | عتبة الهبوط: ${(config.dcaDropThreshold * 100).toFixed(1)}%`,
      badge: 'تكميلية'
    },
    {
      id: 'grid',
      name: 'Dynamic Grid Trading Tentacle',
      arabicName: 'لامسة الشبكة السعرية الديناميكية (Grid)',
      enabled: config.enableGrid,
      toggle: () => setConfig(prev => ({ ...prev, enableGrid: !prev.enableGrid })),
      type: 'TRADING_MODE',
      description: 'نشر شبكة أوامر شراء وبيع تلقائية في أوقات التذبذب العرضي مع استبدال الأوامر المنفذة فوراً.',
      metrics: `المستويات: ${config.gridLevels} | التباعد: ${(config.gridSpacingPct * 100).toFixed(1)}%`,
      badge: 'تكميلية'
    }
  ];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">إدارة اللوامس المتعددة (OctoBot Tentacles System)</h2>
              <p className="text-xs text-slate-400">بنية برمجية مدمجة لإدارة أنماط التداول المتزامنة مع إعادة التوازن الدوري كل 15 دقيقة.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30 flex items-center space-x-1.5 space-x-reverse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>إعادة التوازن: كل 15 دقيقة</span>
            </span>
          </div>
        </div>

        {/* Tentacles Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {tentacles.map((t) => (
            <div
              key={t.id}
              className={`bg-slate-950/80 border rounded-2xl p-5 relative overflow-hidden transition-all ${
                t.enabled
                  ? 'border-purple-500/40 shadow-lg shadow-purple-500/10'
                  : 'border-slate-800 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                  t.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {t.enabled ? 'نشطة ومتزامنة' : 'معطلة'}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                  {t.badge}
                </span>
              </div>

              <h3 className="font-bold text-white text-base mb-1">{t.arabicName}</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">{t.description}</p>

              <div className="bg-slate-900/90 p-3 rounded-xl font-mono text-[11px] text-purple-200 border border-slate-800 mb-4">
                {t.metrics}
              </div>

              <button
                onClick={t.toggle}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 space-x-reverse shadow-md ${
                  t.enabled
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                }`}
              >
                <span>{t.enabled ? 'إيقاف اللامسة' : 'تفعيل اللامسة'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tentacles Detailed Configurations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2 space-x-reverse">
          <Sliders className="w-4 h-4 text-purple-400" />
          <span>تخصيص معايير اللوامس المدمجة</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* DCA Settings */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-sm text-cyan-300">معايير لامسة DCA (Dollar Cost Averaging)</h4>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">قيمة الشراء في كل تعزيز ($)</label>
              <input
                type="number"
                value={config.dcaAmountUsd}
                onChange={(e) => setConfig({ ...config, dcaAmountUsd: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">عتبة الانخفاض لتفعيل الشراء (-%)</label>
              <input
                type="number"
                step="0.005"
                value={config.dcaDropThreshold}
                onChange={(e) => setConfig({ ...config, dcaDropThreshold: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
              />
            </div>
          </div>

          {/* Grid Settings */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-sm text-purple-300">معايير لامسة الشبكة السعرية (Grid)</h4>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">عدد مستويات الشبكة (Levels)</label>
              <input
                type="number"
                value={config.gridLevels}
                onChange={(e) => setConfig({ ...config, gridLevels: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">نسبة التباعد بين المستويات (%)</label>
              <input
                type="number"
                step="0.005"
                value={config.gridSpacingPct}
                onChange={(e) => setConfig({ ...config, gridSpacingPct: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
