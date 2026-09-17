import React from 'react';
import { Layers, Brain, Cpu, Bot, Sliders, ShieldAlert, ArrowLeft, ArrowDown, CheckCircle2, Zap } from 'lucide-react';
import { BotConfig } from '../types';

interface VisualStrategyDesignerViewProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const VisualStrategyDesignerView: React.FC<VisualStrategyDesignerViewProps> = ({ config, setConfig }) => {
  const nodes = [
    {
      id: 'node-market',
      title: '1. مصادر البيانات والبث الحي',
      subtitle: 'Binance / Bybit L2 OrderBook + Trades',
      icon: Zap,
      color: 'from-amber-500 to-yellow-600',
      active: true,
      details: 'تحديث الأسعار وتدفق السيولة (Order Flow) كل 100ms'
    },
    {
      id: 'node-alpha',
      title: '2. النواة الرياضية (Alpha Core)',
      subtitle: 'Kalman Dynamic Beta + O-U Mean Reversion',
      icon: Brain,
      color: 'from-cyan-500 to-blue-600',
      active: true,
      details: `Z-Score Entry: ±${config.entryZ} | Half-Life: ${config.minHalfLife}-${config.maxHalfLife}s`
    },
    {
      id: 'node-freqai',
      title: '3. طبقة الذكاء الاصطناعي (FreqAI + Hyperopt)',
      subtitle: 'LSTM Direction Confidence + Bayesian Search',
      icon: Cpu,
      color: 'from-indigo-500 to-purple-600',
      active: true,
      details: `أدنى ثقة: ${(config.minConfidence * 100).toFixed(0)}% | تحسين المعايير: مفعل`
    },
    {
      id: 'node-tentacles',
      title: '4. منسق اللوامس (OctoBot Tentacles)',
      subtitle: 'StatArb + DCA + Grid Modes',
      icon: Sliders,
      color: 'from-purple-500 to-pink-600',
      active: config.enableStatArb || config.enableDCA || config.enableGrid,
      details: `StatArb: ${config.enableStatArb ? 'مفعل' : 'معطل'} | DCA: ${config.enableDCA ? 'مفعل' : 'معطل'} | Grid: ${config.enableGrid ? 'مفعل' : 'معطل'}`
    },
    {
      id: 'node-risk',
      title: '5. الحواجز الثلاثة وإدارة المخاطر',
      subtitle: 'Triple Barrier + Kelly Sizing + Circuit Breakers',
      icon: ShieldAlert,
      color: 'from-rose-500 to-red-600',
      active: true,
      details: `حجم المركز: ${(config.maxPositionPct * 100).toFixed(1)}% | الرافعة: ${config.maxLeverage}x | وقف Z: ${config.stopZ}`
    },
    {
      id: 'node-executor',
      title: '6. محرك التنفيذ اللحظي (Hummingbot V2)',
      subtitle: 'Smart Order Router + Rate Limiter',
      icon: Bot,
      color: 'from-emerald-500 to-teal-600',
      active: true,
      details: 'تنفيذ الأوامر المزدوجة (Two-Legged Execution) في 68 ميكروثانية'
    }
  ];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center shadow-lg">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">المصمم البصري الموحد للاستراتيجية (Superalgos Visual Flow)</h2>
            <p className="text-xs text-slate-400">رسم بياني تفاعلي متصل يوضح تدفق الإشارة من مصادر البيانات عبر الفلاتر واللوامس وحتى التنفيذ النهائي.</p>
          </div>
        </div>

        {/* Visual Pipeline Nodes Flow */}
        <div className="mt-8 space-y-4 relative">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            return (
              <React.Fragment key={node.id}>
                <div className="bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-all rounded-2xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                  <div className={`absolute top-0 right-0 w-2 h-full bg-gradient-to-b ${node.color}`} />
                  
                  <div className="flex items-center space-x-4 space-x-reverse pr-2">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${node.color} flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{node.title}</h3>
                      <p className="text-xs text-cyan-300 font-mono mt-0.5">{node.subtitle}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 px-4 py-2.5 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 flex items-center space-x-3 space-x-reverse">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{node.details}</span>
                  </div>
                </div>

                {index < nodes.length - 1 && (
                  <div className="flex justify-center my-1">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 animate-pulse">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
