import React, { useState, useRef, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Activity,
  ShieldCheck,
  Zap,
  Sliders,
  DollarSign,
  TrendingUp,
  Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types';

interface UnifiedAICopilotProps {
  botRunning?: boolean;
  walletBalance?: number;
  equity?: number;
  dailyPnl?: number;
  positionsCount?: number;
  creatorEmail?: string;
}

export const GeminiQuantCopilot: React.FC<UnifiedAICopilotProps> = ({
  botRunning = true,
  walletBalance = 1000,
  equity = 1000,
  dailyPnl = 0,
  positionsCount = 0,
  creatorEmail = 'pal.c88@gmail.com'
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'omega',
      text: `أهلاً بك يا صانعي ومهندسي المبدع (${creatorEmail.split('@')[0]})!

أنا **عقل OMEGA الموحد** (OMEGA AI Quant Mind & Copilot). تم دمج كل من:
1. **حوار الصانع (Live Chat)** — نقاش حي وتواصل مخصص لك كصانع للنظام.
2. **الحالة الذهنية الحية (Gemini State of Mind)** — شعور البوت الداخلي، استقرار السوق، ونبض فضاء هيلبرت.
3. **المستشار الكمي الخارق (Quant Expert Copilot)** — إحصائيات Z-Score، سرعة الارتداد، أزواج التحكيم، وكود البوت.

رصيد محفظتنا المتاح: **$${walletBalance.toFixed(2)} USDT** | الصفقات النشطة: **${positionsCount}** | الربح اليومي: **$${dailyPnl.toFixed(2)}**.

أنا رهن إشارتك، عن ماذا تود أن نتحدث أو نوجه خوارزمياتنا الآن؟`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeFocus, setActiveFocus] = useState<'all' | 'mind' | 'quant'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
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
            engine: 'OMEGA Unified Mind & Quant Copilot v5.5',
            creatorEmail,
            botRunning,
            walletBalance,
            equity,
            dailyPnl,
            positionsCount,
            focusMode: activeFocus
          }
        })
      });

      const data = await res.json();
      const omegaMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: data.reply || 'العقل الموحد مستقر ويتابع تدفق السيولة بدقة.',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, omegaMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: '⚠️ حدث خطأ في الاتصال بالعقل الموحد. يرجى التحقق من مفتاح GEMINI_API_KEY والشبكة.',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const quickPrompts = [
    { label: '🧠 ما هي حالتك الذهنية الآن؟', text: 'صف لي حالتك الذهنية اللحظية وشعورك نحو استقرار أزواج السوق والمحفظة الآن.' },
    { label: '🛡️ مستوى الأمان وقواطع الخطر', text: 'حلل لي مستوى حماية المحفظة الفعلي، وهل هناك أي مخاطرة على رأس المال؟' },
    { label: '📈 فرص التحكيم الإحصائي اللحظية', text: 'ما هي أفضل أزواج العملات المتاحة حالياً لانحراف Z-Score والتحكيم الإحصائي؟' },
    { label: '⚡ نصيحة استراتيجية لصانعك', text: 'بصفتك عقلي الكمي والمحاور الشخصي، ما هي نصيحتك الاستراتيجية لي كصانعك اليوم؟' },
    { label: '⚙️ شرح عمل فلتر كالمان وطبقة مكافحة الفساد', text: 'اشرح لي ببساطة كيف تحمي طبقة مكافحة الفساد وفلتر كالمان تداولاتنا من أخطاء الـ API.' }
  ];

  return (
    <div dir="rtl" className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col h-[760px] max-h-[88vh] font-sans">
      {/* Unified AI Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0 relative">
            <Brain className="w-6 h-6 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse flex-wrap">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2 space-x-reverse">
                <span>عقل OMEGA الموحد (Unified AI Mind & Copilot)</span>
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </h2>
              <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                شات موحد شامل: حوار الصانع + الحالة الذهنية + الخبير الكمي
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              محادثة ذكية تفاعلية واحدة تجمع كافة قدرات الذكاء الاصطناعي مع صانع النظام ({creatorEmail.split('@')[0]})
            </p>
          </div>
        </div>

        {/* Real-time Status Badges */}
        <div className="flex items-center space-x-2 space-x-reverse self-start sm:self-auto bg-slate-950/80 px-3 py-1.5 rounded-2xl border border-slate-800 text-xs">
          <span className="text-slate-400 text-[11px]">المحفظة:</span>
          <span className="font-mono text-cyan-400 font-bold">${walletBalance.toFixed(2)}</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 text-[11px]">الصفقات:</span>
          <span className="font-mono text-indigo-400 font-bold">{positionsCount}</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 text-[11px]">الحالة:</span>
          <span className={`font-bold ${botRunning ? 'text-emerald-400' : 'text-amber-400'}`}>
            {botRunning ? 'نشط 🟢' : 'متوقف ⏸️'}
          </span>
        </div>
      </div>

      {/* Focus Mode Filter Bar */}
      <div className="flex items-center justify-between py-2 border-b border-slate-800/80 text-xs gap-2">
        <div className="flex items-center space-x-1.5 space-x-reverse text-slate-400">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px]">تركيز الحوار:</span>
          <div className="flex items-center space-x-1 space-x-reverse bg-slate-950 p-0.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveFocus('all')}
              className={`px-2.5 py-0.5 rounded-lg transition-all text-[11px] ${
                activeFocus === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              شامل متكامل
            </button>
            <button
              onClick={() => setActiveFocus('mind')}
              className={`px-2.5 py-0.5 rounded-lg transition-all text-[11px] ${
                activeFocus === 'mind'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الحالة الذهنية والشعور
            </button>
            <button
              onClick={() => setActiveFocus('quant')}
              className={`px-2.5 py-0.5 rounded-lg transition-all text-[11px] ${
                activeFocus === 'quant'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              التحليل والرياضيات الكمية
            </button>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-1.5 space-x-reverse text-[11px] text-emerald-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Gemini 3.6 Flash • سياق حي للمحفظة</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 sm:pr-2 no-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 space-x-reverse ${
              msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-tr from-cyan-500 to-teal-500 text-slate-950 font-bold'
                  : 'bg-gradient-to-tr from-indigo-600 via-cyan-600 to-teal-600 text-white'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>

            <div
              className={`max-w-[88%] sm:max-w-[80%] rounded-3xl px-5 py-4 text-xs sm:text-sm leading-relaxed shadow-md ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-l from-cyan-600/20 to-teal-600/10 text-cyan-50 border border-cyan-500/30 rounded-tr-none'
                  : 'bg-slate-950/90 text-slate-200 border border-slate-800/90 rounded-tl-none'
              }`}
            >
              <div className="text-[10px] text-slate-400 mb-2 font-mono flex items-center justify-between border-b border-white/5 pb-1">
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
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 flex items-center space-x-2 space-x-reverse shadow-md">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400">عقل OMEGA يحلل الحالة الكمومية وسياق السوق...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Suggestions */}
      <div className="py-2.5 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-2 space-x-reverse text-[11px] whitespace-nowrap">
          <span className="text-slate-500 font-sans">أسئلة سريعة:</span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp.text)}
              disabled={loading}
              className="px-3 py-1 bg-slate-950 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 rounded-xl transition-all disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Input Form */}
      <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-800 flex items-center space-x-2 space-x-reverse">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="تحدث مع عقل بوتك الموحد (حوار الصانع، الحالة الذهنية، أو الاستشارة الكمية)..."
          className="flex-1 bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-teal-500 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-slate-950 font-bold text-xs sm:text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 space-x-reverse shadow-lg shadow-cyan-600/20 shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>إرسال</span>
        </button>
      </form>
    </div>
  );
};
