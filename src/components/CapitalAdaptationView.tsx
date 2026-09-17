import React, { useState, useEffect } from 'react';
import { DollarSign, ShieldAlert, Sparkles, ArrowRightLeft, Percent, CheckCircle2, AlertTriangle, Calculator, Sliders } from 'lucide-react';
import { CapitalAdaptationProfile } from '../types';

interface CapitalAdaptationViewProps {
  walletBalance: number;
  setWalletBalance: (balance: number) => void;
}

export const CapitalAdaptationView: React.FC<CapitalAdaptationViewProps> = ({ walletBalance, setWalletBalance }) => {
  const [profile, setProfile] = useState<CapitalAdaptationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [customBalance, setCustomBalance] = useState<string>(walletBalance.toString());

  const fetchProfile = async (balance: number) => {
    try {
      setLoading(true);
      const res = await fetch('/api/quant/adaptive-capital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletBalance: balance })
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile(walletBalance);
  }, [walletBalance]);

  const handleSetBalance = (val: number) => {
    setWalletBalance(val);
    setCustomBalance(val.toString());
  };

  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomBalance(e.target.value);
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num > 0) {
      setWalletBalance(num);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">محرك التكيف الرأسمالي الذكي (Dynamic Capital Adaptation)</h2>
                <p className="text-xs text-indigo-200/80">
                  مهيأ للمحافظ الصغيرة (&lt; 50$) والكبيرة: يضبط حجم العقد، الرافعة، العمولات، السبريد، والوقف أوتوماتيكياً.
                </p>
              </div>
            </div>
          </div>

          {profile && (
            <div className="bg-slate-950/80 px-4 py-2.5 rounded-xl border border-indigo-500/30 font-mono text-xs text-right">
              <span className="text-[10px] text-slate-400 block">فئة تصنيف المحفظة</span>
              <span className={`font-bold text-sm ${profile.tier === 'MICRO' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {profile.tierNameAr}
              </span>
            </div>
          )}
        </div>

        {/* Real Balance Info & Scenario Calculator */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-xs text-slate-300 font-semibold">رصيد المحفظة الفعلي المستكشَف عبر الـ API:</span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ${walletBalance.toFixed(2)} USDT
            </span>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 font-mono">تخصيص يدوي للمحرك ($):</span>
            <input
              type="number"
              min="5"
              step="5"
              value={customBalance}
              onChange={handleCustomInput}
              placeholder="أدخل المبلغ..."
              className="bg-transparent text-white font-mono font-bold text-sm w-28 focus:outline-none text-left border-b border-slate-700"
            />
          </div>
        </div>
      </div>

      {/* Profile Details Cards */}
      {profile && (
        <div className="space-y-6">
          {/* Bot Brain Plain-Arabic Guidance Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start space-x-3 space-x-reverse">
              <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-white text-sm mb-1">قرار عقل البوت لحماية وتنمية محفظتك</h3>
                <p className="text-xs text-cyan-100 leading-relaxed font-sans">{profile.adaptiveAdviceAr}</p>
              </div>
            </div>
          </div>

          {/* Key Calculated Operational Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-[11px] font-mono text-slate-400 block">الهامش المخصص للصفقة (Margin)</span>
              <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
                <h4 className="text-2xl font-bold font-mono text-emerald-400">${profile.usableMargin}</h4>
                <span className="text-xs text-slate-400 font-mono">من ${profile.walletBalance}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                احتياطي الأمان: ${(profile.walletBalance - profile.usableMargin).toFixed(2)} محفوظ
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-[11px] font-mono text-slate-400 block">الرافعة المتكيفة (Leverage)</span>
              <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
                <h4 className="text-2xl font-bold font-mono text-cyan-400">{profile.recommendedLeverage}x</h4>
                <span className="text-xs text-cyan-300 font-mono">فيوتشرز</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                حجم العقد الإجمالي: ${profile.positionSizeUsd} (يتجاوز الحد الأدنى {profile.minOrderNotional}$)
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-[11px] font-mono text-slate-400 block">إجمالي العمولات والسبريد</span>
              <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
                <h4 className="text-2xl font-bold font-mono text-amber-400">${profile.totalRoundtripFeeUsd}</h4>
                <span className="text-xs text-slate-400 font-mono">دخول + خروج</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                نقطة التعادل (Break-even): +{profile.breakEvenTargetPct}%
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-[11px] font-mono text-slate-400 block">حاجز الأمان من التصفية</span>
              <div className="flex items-baseline space-x-2 space-x-reverse mt-2">
                <h4 className="text-2xl font-bold font-mono text-indigo-400">+{profile.liquidationSafetyBufferPct}%</h4>
                <span className="text-xs text-slate-400 font-mono">مسافة أمان</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">مستحيل ملامسة سعر التصفية</p>
            </div>
          </div>

          {/* Exact Barrier Targets (Stop Loss & Take Profit with Fees factored in) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center space-x-2 space-x-reverse">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>نظام الحواجز الموزونة (وقف الخسارة وجني الأرباح المحسوبين بالعمولة الصافية)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Take Profit Box */}
              <div className="bg-slate-950/70 p-5 rounded-xl border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 font-sans">🎯 هدف جني الأرباح الصافي (Take Profit)</span>
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    نسبة العائد للمخاطرة 2.5 : 1
                  </span>
                </div>
                <div className="flex items-baseline space-x-3 space-x-reverse">
                  <span className="text-3xl font-bold font-mono text-white">+{profile.takeProfitPct}%</span>
                  <span className="text-sm font-mono text-emerald-400 font-bold">(ربح صافٍ: +${profile.takeProfitUsd})</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  تم خصم عمولة صانع السوق (Maker) والآخذ (Taker) والسبريد مسبقاً، بحيث تكون النتيجة النهائية ربحاً حقيقياً في رصيد محفظتك.
                </p>
              </div>

              {/* Stop Loss Box */}
              <div className="bg-slate-950/70 p-5 rounded-xl border border-rose-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 font-sans">🛡️ وقف الخسارة الصارم (Stop Loss)</span>
                  <span className="text-xs font-mono bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20">
                    محمية بنسبة {profile.maxRiskPerTradePct}% من المحفظة
                  </span>
                </div>
                <div className="flex items-baseline space-x-3 space-x-reverse">
                  <span className="text-3xl font-bold font-mono text-white">-{profile.stopLossPct}%</span>
                  <span className="text-sm font-mono text-rose-400 font-bold">(أقصى خسارة: -${profile.stopLossUsd})</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  حتى لو ارتد السوق بشكل مفاجئ، لن تفقد المحفظة أكثر من ${profile.maxRiskPerTradeUsd}، مما يضمن بقاءك في السوق لمئات الصفقات.
                </p>
              </div>
            </div>

            {/* Fee Transparency breakdown table */}
            <div className="mt-6 pt-4 border-t border-slate-800/80">
              <span className="text-xs font-bold text-slate-300 block mb-3 font-sans">شفافية احتساب الرسوم والعمولات المنصية:</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">عمولة الدخول (Taker 0.055%)</span>
                  <span className="text-slate-200 font-bold">${profile.estimatedTakerFeeUsd}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">عمولة الخروج (Maker 0.020%)</span>
                  <span className="text-slate-200 font-bold">${profile.estimatedMakerFeeUsd}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">تكلفة السبريد المتوقعة</span>
                  <span className="text-slate-200 font-bold">${profile.estimatedSpreadCostUsd}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">حركة السعر لتغطية الرسوم</span>
                  <span className="text-cyan-400 font-bold">+{profile.breakEvenTargetPct}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
