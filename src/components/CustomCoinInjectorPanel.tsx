import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Bot, 
  Zap, 
  Coins, 
  Activity,
  Flame
} from 'lucide-react';
import axios from 'axios';

interface CustomCoinInjectorPanelProps {
  onCoinAdded?: (symbol: string) => void;
}

export const CustomCoinInjectorPanel: React.FC<CustomCoinInjectorPanelProps> = ({ onCoinAdded }) => {
  const [customInput, setCustomInput] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Pre-configured Sector Baskets
  const sectorBaskets = [
    {
      name: '🌐 سلة اللير 1 (Layer-1)',
      desc: 'سولانا، إيثيريوم، أفالانش، أبتوس، سوي',
      coins: ['SOLUSDT', 'AVAXUSDT', 'APTUSDT', 'SUIUSDT', 'NEARUSDT']
    },
    {
      name: '👑 سلة العملات القيادية',
      desc: 'بيتكوين، إيثيريوم، بينانس كوين، ريبل',
      coins: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT']
    },
    {
      name: '🏦 سلة الـ DeFi والخدمات',
      desc: 'تشين لينك، آفي، يونيسواب، إنجيكتيف',
      coins: ['LINKUSDT', 'AAVEUSDT', 'UNIUSDT', 'INJUSDT']
    },
    {
      name: '🤖 سلة الذكاء الاصطناعي والبيانات',
      desc: 'رندر، فيتش، سيليستيا',
      coins: ['RENDERUSDT', 'FETUSDT', 'TIAUSDT']
    }
  ];

  const handleInjectCoin = async (symbolToInject?: string) => {
    const sym = symbolToInject || customInput;
    if (!sym || !sym.trim()) return;

    setIsInjecting(true);
    setFeedbackMessage(null);

    try {
      const res = await axios.post('/api/quant/add-custom-coin', { symbol: sym });
      if (res.data.success) {
        setFeedbackMessage({
          text: `تم حُقن وتأهيل ${res.data.addedSymbol} في عقل البوت الكمي بنجاح!`,
          type: 'success'
        });
        if (!symbolToInject) setCustomInput('');
        onCoinAdded?.(res.data.addedSymbol);
      } else {
        setFeedbackMessage({
          text: res.data.error || 'تعذر إضافة العملة',
          type: 'error'
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        text: err.response?.data?.error || 'حدث خطأ أثناء التواصل مع سيرفر البوت',
        type: 'error'
      });
    } finally {
      setIsInjecting(false);
    }
  };

  const handleInjectBasket = async (coins: string[]) => {
    setIsInjecting(true);
    setFeedbackMessage(null);

    try {
      for (const coin of coins) {
        await axios.post('/api/quant/add-custom-coin', { symbol: coin });
      }
      setFeedbackMessage({
        text: `تم حقن السلة بالكامل (${coins.length} عملات) لعمليات التحكيم الكمي بنجاح!`,
        type: 'success'
      });
      onCoinAdded?.(coins[0]);
    } catch (err: any) {
      setFeedbackMessage({
        text: 'تعذر إضافة بعض عملات السلة',
        type: 'error'
      });
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-right font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Plus className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 space-x-reverse">
              <span>توسيع نطاق العملات وحقن السلات الكمية</span>
              <span className="text-[10px] px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono">
                Dynamic Coin Injection
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              أضف أي عملة فيوتشرز مخصصة أو سلة قطاعية، وسيقوم عقل البوت بحساب فلاتر كالمان والتحكيم الساكن لها فورياً.
            </p>
          </div>
        </div>
      </div>

      {/* Direct Coin Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleInjectCoin();
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800"
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="أدخل رمز أي عملة تريد إضافتها (مثال: SOLUSDT, NEARUSDT, AVAX)..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isInjecting || !customInput.trim()}
          className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 space-x-reverse shadow-lg shadow-indigo-600/20 shrink-0"
        >
          {isInjecting ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>حقن العملة في عقل البوت</span>
        </button>
      </form>

      {/* Feedback Alert */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 space-x-reverse ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sector Baskets Quick Injector */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-slate-300 block font-sans">
          أو اختر سلة قطاعية جاهزة لحقن جميع عملاتها دفعة واحدة:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sectorBaskets.map((basket, idx) => (
            <div
              key={idx}
              className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-white">{basket.name}</span>
                <span className="text-[10px] bg-slate-900 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-slate-800">
                  {basket.coins.length} عملات
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {basket.desc}
              </p>

              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-wrap gap-1">
                  {basket.coins.map((c) => (
                    <span key={c} className="text-[9px] bg-slate-900 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                      {c.replace('USDT', '')}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => handleInjectBasket(basket.coins)}
                  disabled={isInjecting}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 space-x-reverse"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>حقن السلة</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
