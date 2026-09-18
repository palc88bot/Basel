import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  ShieldCheck, 
  Activity, 
  Eye, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Bot
} from 'lucide-react';
import { FuturesPair, Position } from '../types';

interface HumanizedMarketOverviewProps {
  futuresPairs: FuturesPair[];
  positions: Position[];
  botRunning: boolean;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string;
}

export const HumanizedMarketOverview: React.FC<HumanizedMarketOverviewProps> = ({
  futuresPairs,
  positions,
  botRunning,
  onSelectSymbol,
  selectedSymbol = 'ETHUSDT'
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'HOT' | 'STABLE'>('HOT');

  // Filter pairs based on humanized conditions
  const qualifiedPairs = futuresPairs.filter((p) => {
    if (filterType === 'HOT') return Math.abs(p.zScore) >= 1.2;
    if (filterType === 'STABLE') return Math.abs(p.zScore) < 1.2;
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-right font-sans" dir="rtl">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <Flame className="w-6 h-6 animate-bounce text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white">رادار الفرص الساخنة المقروءة إنسانياً</h2>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
                {qualifiedPairs.length} فرص رادارية
              </span>
            </div>
            <p className="text-xs text-slate-400">
              ترجمة مبسطة ومباشرة لحركات الأسواق دون تعقيدات رياضية - البوت يرصدها وينفذها تلقائياً.
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 flex items-center space-x-1 space-x-reverse">
          <button
            onClick={() => setFilterType('HOT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'HOT'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔥 الفرص الساخنة
          </button>
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'ALL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🌐 جميع العملات
          </button>
          <button
            onClick={() => setFilterType('STABLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'STABLE'
                ? 'bg-indigo-500 text-slate-950 shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🛡️ المتوازنة
          </button>
        </div>
      </div>

      {/* CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {qualifiedPairs.slice(0, 6).map((pair) => {
          const isSelected = selectedSymbol === pair.symbol;
          const absZ = Math.abs(pair.zScore);
          
          let opportunityStatus = 'في نطاق التوازن';
          let opportunityColor = 'text-slate-300 border-slate-800 bg-slate-950/80';
          let badgeText = 'مستقر';

          if (absZ >= 2.0) {
            opportunityStatus = 'فرصة ذهبية استثنائية 🔥';
            opportunityColor = 'text-amber-300 border-amber-500/40 bg-amber-950/20 shadow-amber-500/10';
            badgeText = pair.zScore < 0 ? 'إشارة شراء قوِيّة 🟢' : 'إشارة بيع قوِيّة 🔴';
          } else if (absZ >= 1.2) {
            opportunityStatus = 'فرصة تداول عالية الجاذبية ✨';
            opportunityColor = 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20 shadow-emerald-500/10';
            badgeText = pair.zScore < 0 ? 'ارتداد متوقع صعوداً 🟢' : 'ارتداد متوقع هبوطاً 🔴';
          }

          return (
            <motion.div
              key={pair.symbol}
              whileHover={{ scale: 1.02 }}
              onClick={() => onSelectSymbol?.(pair.symbol)}
              className={`p-5 rounded-2xl border ${opportunityColor} transition-all cursor-pointer relative overflow-hidden shadow-xl space-y-3`}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className="font-bold text-base text-white font-mono">{pair.symbol}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/10 text-white border border-white/20">
                    {badgeText}
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-cyan-400">
                  ${pair.price?.toLocaleString()}
                </span>
              </div>

              {/* Humanized Insights */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">حالة الفرصة اللحظية:</span>
                  <span className="font-bold text-white">{opportunityStatus}</span>
                </div>

                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 font-sans">السيولة الحجمية 24h:</span>
                  <span className="text-cyan-300 font-bold">${((pair.volume24hUsd || 50000000) / 1e6).toFixed(1)}M</span>
                </div>

                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-400 font-sans">سرعة جني الربح:</span>
                  <span className="text-indigo-300 font-bold">خاطفة (4 ثوانٍ)</span>
                </div>
              </div>

              {/* Progress bar visualizing opportunity intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>درجة اندفاع الفرصة:</span>
                  <span className="font-mono text-cyan-400">{Math.min(100, Math.round(absZ * 40))}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round(absZ * 40))}%` }}
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold flex items-center space-x-1 space-x-reverse">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>مفعلة بحماية كالمان</span>
                </span>

                <span className="text-cyan-400 font-bold flex items-center space-x-1 space-x-reverse group-hover:translate-x-1 transition-transform">
                  <span>تفاصيل الرصد</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
