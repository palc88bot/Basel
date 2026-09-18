import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Sparkles, Send, RefreshCw, MessageSquareText, Shield, Zap } from 'lucide-react';
import axios from 'axios';

interface BotThoughtTickerProps {
  botRunning: boolean;
  marketContext?: any;
}

export const BotThoughtTicker: React.FC<BotThoughtTickerProps> = ({
  botRunning,
  marketContext
}) => {
  const [currentThought, setCurrentThought] = useState<string>(
    'أستشعر الآن توازناً مستقراً في مسار السبريد اللحظي... العقل الكمومي يراقب حركات السيولة بهدوء ويترقب الفرصة الأنسب لفتح صفقة آمنة.'
  );
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchBotStateOfMind = async (query?: string) => {
    setIsLoading(true);
    try {
      const res = await axios.post('/api/quant/state-of-mind', {
        userPrompt: query || '',
        marketContext: marketContext || { botRunning }
      });

      if (res.data.success && res.data.thought) {
        setCurrentThought(res.data.thought);
      }
    } catch (err) {
      console.error('Failed to fetch bot state of mind thought:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Periodically refresh thoughts every 45 seconds when running
    if (botRunning) {
      fetchBotStateOfMind();
      const interval = setInterval(() => {
        fetchBotStateOfMind();
      }, 45000);
      return () => clearInterval(interval);
    }
  }, [botRunning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    fetchBotStateOfMind(userQuery);
    setUserQuery('');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none font-sans" dir="rtl">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-4xl mx-auto bg-slate-900/95 border border-cyan-500/30 rounded-3xl p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto text-right space-y-3 shadow-cyan-500/10"
      >
        {/* Main Thought Ticker Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 space-x-reverse flex-1 min-w-0">
            {/* Animated Brain Core Icon */}
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 rounded-2xl text-cyan-300 shrink-0 relative">
              <Brain className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            </div>

            {/* Mind Thought Statement */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 space-x-reverse mb-0.5">
                <span className="text-[10px] font-bold text-cyan-400 tracking-wider font-mono">
                  عقل البوت المباشر (Gemini State of Mind)
                </span>
                <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  حوار تحليلي حي
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.p
                  key={currentThought}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-slate-200 leading-relaxed font-semibold truncate sm:whitespace-normal"
                >
                  "{currentThought}"
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 space-x-reverse shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isExpanded ? 'إغلاق الحوار' : 'حاور عقل البوت'}</span>
            </button>

            <button
              onClick={() => fetchBotStateOfMind()}
              disabled={isLoading}
              title="تحديث الحالة الذهنية"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded Direct Conversation Box with Gemini Mind */}
        <AnimatePresence>
          {isExpanded && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="pt-2 border-t border-slate-800/80 flex items-center gap-2"
            >
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="اسأل عقل البوت عن شعوره نحو التداول الآن..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              />

              <button
                type="submit"
                disabled={isLoading || !userQuery.trim()}
                className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center space-x-1.5 space-x-reverse shadow-md shadow-cyan-600/20"
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>إرسال</span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
