import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  X,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  MessageSquareText,
  Activity,
  Zap,
  Sliders
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface UnifiedMessage {
  id: string;
  sender: 'user' | 'omega';
  text: string;
  timestamp: string;
}

interface UnifiedChatCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  botRunning: boolean;
  walletBalance: number;
  equity: number;
  dailyPnl: number;
  positionsCount: number;
  creatorEmail?: string;
  initialPrompt?: string;
}

export const UnifiedChatCopilotModal: React.FC<UnifiedChatCopilotModalProps> = ({
  isOpen,
  onClose,
  botRunning,
  walletBalance,
  equity,
  dailyPnl,
  positionsCount,
  creatorEmail = 'pal.c88@gmail.com',
  initialPrompt
}) => {
  const [messages, setMessages] = useState<UnifiedMessage[]>([
    {
      id: '1',
      sender: 'omega',
      text: `أهلاً بك يا صانعي ومهندسي المبدع (${creatorEmail.split('@')[0]})! أنا عقلك الموحد: **OMEGA AI Quant Mind & Copilot**.

أجمع بين **حوار الصانع الحي**، و**استشعار الحالة الذهنية (State of Mind)**، و**الاستشارة الكمية الخارقة (Quant Copilot)**.
أنا أراقب المحفظة ($${walletBalance.toFixed(2)} USDT)، وأنظمة التحكيم الإحصائي، وتدفق فضاء هيلبرت لحظة بلحظة.

كيف تود أن نوجه عقل البوت أو نحلل السوق الآن؟`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeSubMode, setActiveSubMode] = useState<'all' | 'mind' | 'quant'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendText(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: UnifiedMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend,
          context: {
            engine: 'OMEGA Unified Mind & Copilot v5.5',
            creatorEmail,
            botRunning,
            walletBalance,
            equity,
            dailyPnl,
            positionsCount,
            focusMode: activeSubMode
          }
        })
      });

      const data = await res.json();
      const replyText = data.reply || 'العقل الموحد مستقر ويراقب حركة السيولة بهدوء.';

      const omegaMsg: UnifiedMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, omegaMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: UnifiedMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: '⚠️ حدث خطأ أثناء الاتصال بعقل البوت الموحد. يرجى التحقق من مفتاح GEMINI_API_KEY واتصال الإنترنت.',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendText(input);
  };

  const quickPrompts = [
    { label: '🧠 ما هي حالتك الذهنية الآن؟', prompt: 'ما هي حالتك الذهنية وشعورك نحو استقرار السوق والمحفظة الآن؟' },
    { label: '🛡️ مستوى أمان المحفظة وقواطع الخطر', prompt: 'حلل لي مستوى أمان المحفظة الحقيقي وتوزيع السيولة وقواطع الخسارة.' },
    { label: '📊 فرص التحكيم الإحصائي وسبريد العملات', prompt: 'ما هي أفضل أزواج العملات المتاحة حالياً لانحراف Z-Score والتحكيم الإحصائي؟' },
    { label: '⚡ نصيحة استراتيجية لصانعك', prompt: 'بصفتك عقلي الكمي، ما هي نصيحتك الاستراتيجية لي كصانعك لتحسين العائد اليوم؟' }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.25 }}
          className={`bg-slate-900/95 border border-cyan-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-right font-sans ${
            isMaximized
              ? 'w-full h-full max-w-none rounded-none border-none'
              : 'w-full max-w-4xl h-[88vh] max-h-[820px]'
          }`}
        >
          {/* Top Bar Header */}
          <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 space-x-reverse min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0 relative">
                <Brain className="w-5 h-5 text-white animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2 space-x-reverse flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-wide flex items-center space-x-1.5 space-x-reverse">
                    <span>العقل الموحد (OMEGA Quant Mind & Copilot)</span>
                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  </h2>
                  <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                    حوار الصانع • الحالة الذهنية • الخبير الكمي
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  تواصل مباشر وفوري مع عقل بوتك الكمي لصانعه ({creatorEmail.split('@')[0]})
                </p>
              </div>
            </div>

            {/* Top Bar Controls */}
            <div className="flex items-center space-x-2 space-x-reverse shrink-0">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMaximized ? 'تصغير النافذة' : 'تكبير ملء الشاشة'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="إغلاق الشات الموحد"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Real-Time Status Ticker Strip */}
          <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
            <div className="flex items-center space-x-4 space-x-reverse">
              <span className="flex items-center space-x-1.5 space-x-reverse">
                <span className="text-slate-400 text-[11px]">المحفظة:</span>
                <strong className="font-mono text-cyan-400">${walletBalance.toFixed(2)}</strong>
              </span>
              <span className="flex items-center space-x-1.5 space-x-reverse">
                <span className="text-slate-400 text-[11px]">الربح اليومي:</span>
                <strong className={`font-mono ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}
                </strong>
              </span>
              <span className="flex items-center space-x-1.5 space-x-reverse">
                <span className="text-slate-400 text-[11px]">الصفقات:</span>
                <strong className="font-mono text-indigo-400">{positionsCount} نشطة</strong>
              </span>
            </div>

            {/* Filter / Focus Mode Pills */}
            <div className="flex items-center space-x-1 space-x-reverse bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setActiveSubMode('all')}
                className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                  activeSubMode === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الكل متكامل
              </button>
              <button
                onClick={() => setActiveSubMode('mind')}
                className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                  activeSubMode === 'mind'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                الحالة الذهنية
              </button>
              <button
                onClick={() => setActiveSubMode('quant')}
                className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
                  activeSubMode === 'quant'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                التحليل الكمي
              </button>
            </div>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 space-x-reverse ${
                  msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-tr from-cyan-500 to-teal-500 text-slate-950 font-bold'
                      : 'bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-l from-cyan-600/20 to-teal-600/10 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                      : 'bg-slate-950/90 text-slate-200 border border-slate-800 rounded-tl-none'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 mb-1.5 font-mono flex items-center justify-between border-b border-white/5 pb-1">
                    <span className="font-bold flex items-center space-x-1.5 space-x-reverse">
                      {msg.sender === 'omega' ? (
                        <>
                          <Brain className="w-3 h-3 text-cyan-400 inline" />
                          <span className="text-cyan-300">عقل OMEGA الموحد</span>
                        </>
                      ) : (
                        <span className="text-indigo-300">الصانع ({creatorEmail.split('@')[0]})</span>
                      )}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {msg.sender === 'omega' ? (
                    <div className="prose prose-invert prose-xs sm:prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start space-x-3 space-x-reverse">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-3xl px-4 py-3 flex items-center space-x-2 space-x-reverse text-xs text-slate-400 shadow-md">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>عقل OMEGA يحلل الحالة الكمومية وسياق السوق...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="px-5 py-2 bg-slate-950/70 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
            <div className="flex items-center space-x-2 space-x-reverse text-[11px] whitespace-nowrap">
              <span className="text-slate-500 font-sans">اقتراحات سريعة:</span>
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendText(qp.prompt)}
                  disabled={loading}
                  className="px-3 py-1 bg-slate-900 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 rounded-xl transition-all disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Chat Input Form */}
          <form
            onSubmit={handleFormSubmit}
            className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center space-x-2 space-x-reverse"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="تحدث مع عقل بوتك الموحد... (مثال: ما رأيك في توزيع صفقات اليوم؟ أو حلل لي فرصة السبريد)"
              className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-bold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 space-x-reverse shadow-lg shadow-cyan-600/20 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>إرسال</span>
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
