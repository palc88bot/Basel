import React from 'react';
import { Layers, Brain, Cpu, Bot, Sliders, ShieldAlert, Zap, CheckCircle2 } from 'lucide-react';

export const OmegaPipelineView: React.FC = () => {
  const pipelineStages = [
    {
      layer: "المرحلة الأولى: النواة الرياضية والهندسة التحليلية",
      source: "خوارزميات بوتك الأصلي",
      description: "فلتر كالمان لتحديد معامل التحوط المتغير (Beta) لحظياً + نموذج أورنشتاين-أولينبك لقياس سرعة العودة للمتوسط + تنبؤ LSTM فائق السرعة (68 ميكروثانية).",
      status: "نشط ويتنفس",
      metrics: "Z-Score: -1.92 | Half-Life: 345s | Beta: 31.30",
      icon: Brain,
      color: "from-cyan-500 to-blue-600"
    },
    {
      layer: "المرحلة الثانية: طبقة الذكاء الاصطناعي والتعلم الآلي",
      source: "تكامل FreqAI",
      description: "عميل التعلم التعزيزي (Reinforcement Learning) لتحسين دقة القرار بناءً على نسبة شارب وانخفاض رأس المال، مع الضبط التلقائي (Hyperopt).",
      status: "مُحسّن",
      metrics: "مكافأة RL: +1.42 | التجارب: 500",
      icon: Cpu,
      color: "from-indigo-500 to-purple-600"
    },
    {
      layer: "المرحلة الثالثة: طبقة التنسيق وإدارة الأنماط",
      source: "هندسة أوكتوبوت الموديلية",
      description: "تنسيق متعدد الأصول والأنماط (Arbitrage, DCA, Grid) مع إعادة توازن ديناميكية للمحفظة كل 15 دقيقة لضمان أعلى كفاءة تشغيلية.",
      status: "متزامن",
      metrics: "الأنماط: تحكيم إحصائي + DCA",
      icon: Sliders,
      color: "from-purple-500 to-pink-600"
    },
    {
      layer: "المرحلة الرابعة: طبقة التنفيذ السريع",
      source: "موصّلات هامنغبوت V2",
      description: "الاتصال المباشر بأكثر من 50 منصة تداول مع تنظيم تدفق الطلبات (Rate Limiting) وتتبع الأوامر المنفذة بدقة تامة في وضع المحاكاة أو الحقيقي.",
      status: "متصل",
      metrics: "المنصات: Bybit / Binance | الحالة: مستقر",
      icon: Bot,
      color: "from-emerald-500 to-teal-600"
    },
    {
      layer: "المرحلة الخامسة: طبقة إدارة المخاطر وقواطع الأمان",
      source: "نظام الحواجز الثلاثة و Kelly",
      description: "إدارة الحجم (Kelly Criterion)، نظام الحواجز الثلاثة (Triple Barrier: جني أرباح، وقف خسارة، حد زمني)، وقواطع الأمان للطوارئ (Circuit Breakers).",
      status: "محمي بالكامل",
      metrics: "الحد الأقصى للخسارة: 5% | الانخفاض: 10%",
      icon: ShieldAlert,
      color: "from-amber-500 to-rose-600"
    },
    {
      layer: "المرحلة السادسة: طبقة المراقبة والواجهة الحية",
      source: "محرك Superalgos البصري",
      description: "لوحة تحكم بصرية حية تنبض بالبيانات، مع بث مباشر للتنبيهات والتقارير عبر تطبيق تيليجرام والواجهة الأمامية.",
      status: "يبث لحظياً",
      metrics: "معدل التحديث: 100ms | الويب هوك: يعمل",
      icon: Layers,
      color: "from-blue-500 to-emerald-600"
    }
  ];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center shadow-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">هندسة الكتلة الموحدة والمتتابعة للبوت الخارق (OMEGA Pipeline)</h2>
            <p className="text-xs text-slate-400">كتلة تشغيلية واحدة متتالية تدمج مخرجات كافة المستودعات ومحركك الرياضي بسلاسة تامة دون فواصل.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {pipelineStages.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div
                key={idx}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-cyan-500/50"
              >
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-cyan-500 to-emerald-500" />
                
                <div className="flex items-start space-x-4 space-x-reverse pr-2">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stage.color} flex items-center justify-center flex-shrink-0 text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <h3 className="font-bold text-white text-sm">{stage.layer}</h3>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20 font-mono">
                        {stage.source}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{stage.description}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start space-y-1 bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-800 font-mono text-xs flex-shrink-0">
                  <div className="flex items-center space-x-1.5 space-x-reverse text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="font-bold">{stage.status}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{stage.metrics}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
