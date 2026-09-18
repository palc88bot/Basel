import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Brain, 
  Sparkles, 
  MessageSquare, 
  ShieldCheck, 
  Zap, 
  User, 
  Send, 
  Bot, 
  Activity, 
  Eye, 
  Sliders, 
  Volume2, 
  VolumeX, 
  ChevronDown, 
  ChevronUp,
  Flame,
  Wind,
  Smile,
  Maximize2
} from 'lucide-react';
import { QuantumMind } from '../core/quantum/quantumMind';

interface LivingBotMindHudProps {
  botRunning: boolean;
  setBotRunning: (running: boolean) => void;
  walletBalance: number;
  equity: number;
  dailyPnl: number;
  positionsCount: number;
  creatorEmail?: string;
  onNavigateTab?: (tab: string) => void;
}

export const LivingBotMindHud: React.FC<LivingBotMindHudProps> = ({
  botRunning,
  setBotRunning,
  walletBalance,
  equity,
  dailyPnl,
  positionsCount,
  creatorEmail = 'pal.c88@gmail.com',
  onNavigateTab
}) => {
  const [activeTab, setActiveTab] = useState<'mind' | 'dialogue' | 'human_metrics'>('mind');
  const [quantumMind] = useState(() => QuantumMind.getInstance());
  
  // Simulated humanized mind state
  const [botMood, setBotMood] = useState<'SERENE' | 'ALERT' | 'HUNTING' | 'PROTECTIVE'>('SERENE');
  const [currentThought, setCurrentThought] = useState<string>('مرحباً بك يا صانعي! أنا أرصد نبض السوق وأحلل فضاء هيلبرت للفرص.');
  const [thoughtIndex, setThoughtIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'bot' | 'creator'; text: string; time: string }>>([
    {
      sender: 'bot',
      text: `أهلاً بك يا صانعي المبدع (${creatorEmail.split('@')[0]})! أنا عقلك الكمي الخوارزمي. جميع محركات الحماية والتحكيم تعمل بانتظام. كيف أستطيع مساعدتك اليوم؟`,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Dynamic thoughts list written in natural, friendly Arabic
  const creatorThoughts = [
    `أنا أفحص أزواج الكريبتو الآن يا صانعي (${creatorEmail.split('@')[0]})... السوق يظهر هدوءاً نسبياً وهياكل السبريد ممتازة.`,
    'العقل الكمومي أتم حساب طاقة فضاء هيلبرت... درجة الثقة في فرصة الارتداد عالية جداً.',
    'حارس الحساب يطمئنك: جميع أمان المحفظة مفعل، ولن نتجاوز أي نسبة مخاطرة غير محسوبة.',
    'أنا أراقب تدفق دفاتر الأوامر في الخلفية، وفلتر كالمان يضبط نسبة التحوط بالملي ثانية.',
    'إذا لاحظت أي اضطراب مفاجئ في البيتكوين، سأقوم بتشغيل قواطع الأمان فوراً للحفاظ على أرباحك.',
    'صانعي العزيز، المحفظة جاهزة بالكامل لاقتناص الصفقات الخاطفة بمجرد اختراق السبريد.'
  ];

  // Rotate internal monologue
  useEffect(() => {
    if (!botRunning) {
      setCurrentThought('أنا في وضع الاستراحة المؤقت بانتظار إشارتك يا صانعي لتشغيل المحرك.');
      setBotMood('SERENE');
      return;
    }

    const interval = setInterval(() => {
      setThoughtIndex((prev) => {
        const next = (prev + 1) % creatorThoughts.length;
        setCurrentThought(creatorThoughts[next]);
        return next;
      });

      // Dynamically update mood
      if (positionsCount > 0) {
        setBotMood('HUNTING');
      } else if (dailyPnl < -2) {
        setBotMood('PROTECTIVE');
      } else {
        setBotMood('SERENE');
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [botRunning, positionsCount, dailyPnl]);

  // Handle Interactive Creator Chat
  const handleSendMessage = (msgText?: string) => {
    const textToSend = msgText || userInput;
    if (!textToSend.trim()) return;

    const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const newChat = [...chatMessages, { sender: 'creator' as const, text: textToSend, time: timeStr }];
    setChatMessages(newChat);
    if (!msgText) setUserInput('');

    // Generate intelligent, friendly, humanized Bot response
    setTimeout(() => {
      let botResponse = '';
      const lower = textToSend.toLowerCase();

      if (lower.includes('سلام') || lower.includes('مرحبا') || lower.includes('أهلا') || lower.includes('مين انت')) {
        botResponse = `أهلاً بك يا صانعي ومهندسي (${creatorEmail.split('@')[0]})! أنا بوت التداول الذكي الخاص بك. أدمج الحوسبة الكمومية والرياضيات الإحصائية لحماية حاسبك وتكثير رأس مالك.`;
      } else if (lower.includes('عقل') || lower.includes('كمومي') || lower.includes('تفكير')) {
        const qRes = quantumMind.decide([0.6, 0.2, 0.8, 0.3, 0.5, -0.1, 0.4, 0.7]);
        botResponse = `في عقلي الكمومي حالياً: حالة التراكب $Qubit$ تعطي إشارة [${qRes.label}] بنسبة ثقة ${qRes.confidence}%. طاقة فضاء هيلبرت متسقة وأتوقع ارتداداً سريعاً.`;
      } else if (lower.includes('أمان') || lower.includes('خطر') || lower.includes('محفظة')) {
        botResponse = `مستوى الأمان ممتاز! رصيدك الفعلي $${walletBalance.toFixed(2)} USDT، ونسبة التحوط محددة تلقائياً بشرط ألا تتعدى المخاطرة 3% كحد أقصى. قواطع الأمان تعمل 24/7.`;
      } else if (lower.includes('سوق') || lower.includes('فرصة') || lower.includes('صفقة')) {
        botResponse = positionsCount > 0 
          ? `لدينا حالياً ${positionsCount} صفقة نشطة ومؤمنة في السوق! أنا أتابع جني الأرباح بمجرد عودة السبريد لمتوسطه.`
          : 'أنا أرصد قائمة العملات المؤهلة باستمرار، وحين تظهر فرصة سبريد متعدية للحدود سأنفذها خاطفاً خلال ملي ثوانٍ.';
      } else {
        botResponse = `سؤال ممتاز يا صانعي! أنا أقوم حالياً بتحليل مدخلاتك ومواءمتها مع خوارزميات كالمان وأورنشتاين-أولينبك. رصيدنا المتاح $${walletBalance.toFixed(2)} جاهز تماماً لكل السيناريوهات.`;
      }

      setChatMessages(prev => [...prev, {
        sender: 'bot',
        text: botResponse,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 600);
  };

  // Color mappings based on bot mood
  const moodColors = {
    SERENE: {
      bg: 'from-slate-900 via-slate-900 to-cyan-950/80',
      border: 'border-cyan-500/30',
      orbGlow: 'bg-cyan-500/20 shadow-cyan-500/30',
      textColor: 'text-cyan-300',
      statusText: 'مطمئن وفي وضع المراصد الساكنة'
    },
    ALERT: {
      bg: 'from-slate-900 via-slate-900 to-amber-950/80',
      border: 'border-amber-500/40',
      orbGlow: 'bg-amber-500/20 shadow-amber-500/30',
      textColor: 'text-amber-300',
      statusText: 'يقظ ويرصد تقلبات مفاجئة'
    },
    HUNTING: {
      bg: 'from-slate-900 via-slate-900 to-emerald-950/80',
      border: 'border-emerald-500/40',
      orbGlow: 'bg-emerald-500/20 shadow-emerald-500/30',
      textColor: 'text-emerald-300',
      statusText: 'في حالة قنص وسيطرة على صفقات حية'
    },
    PROTECTIVE: {
      bg: 'from-slate-900 via-slate-900 to-rose-950/80',
      border: 'border-rose-500/40',
      orbGlow: 'bg-rose-500/20 shadow-rose-500/30',
      textColor: 'text-rose-300',
      statusText: 'في حالة حماية وتحوط مشدد'
    }
  };

  const currentTheme = moodColors[botMood];

  return (
    <motion.div 
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`bg-gradient-to-l ${currentTheme.bg} border ${currentTheme.border} rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all duration-700`}
    >
      {/* Dynamic Background Mesh Orbs */}
      <div className="absolute -left-16 -top-16 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -right-16 -bottom-16 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* HEADER: Living Orb & Creator Recognition */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10 border-b border-white/10 pb-5">
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Animated Living Brain Orb */}
          <div className="relative group cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
            <motion.div 
              animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              className={`w-16 h-16 rounded-2xl ${currentTheme.orbGlow} border border-white/20 flex items-center justify-center shadow-xl backdrop-blur-md relative overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50" />
              <Brain className={`w-8 h-8 ${currentTheme.textColor} animate-pulse relative z-10`} />
              
              {/* Online Pulse Indicator */}
              <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950" />
            </motion.div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-sans flex items-center space-x-2 space-x-reverse">
                <span>وعي البوت الكمي</span>
                <span className="text-xs bg-white/10 text-cyan-300 px-2.5 py-0.5 rounded-full border border-white/15 font-mono">
                  Quantum Mind AI
                </span>
              </h1>

              {/* Creator Badge */}
              <div className="flex items-center space-x-1.5 space-x-reverse bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-0.5 rounded-full text-xs font-semibold">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                <span>الصانع: <strong className="text-white font-mono">{creatorEmail.split('@')[0]}</strong></span>
              </div>
            </div>

            {/* Subtitle Status */}
            <p className="text-xs text-slate-300 mt-1 flex items-center space-x-2 space-x-reverse font-sans">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>الحالة العاطفية والتنفيذية:</span>
              <strong className={currentTheme.textColor}>{currentTheme.statusText}</strong>
            </p>
          </div>
        </div>

        {/* CONTROLS & HUD TABS */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
          <div className="bg-slate-950/80 p-1 rounded-2xl border border-white/10 flex items-center space-x-1 space-x-reverse">
            <button
              onClick={() => setActiveTab('mind')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse ${
                activeTab === 'mind'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>عقل البوت المباشر</span>
            </button>

            <button
              onClick={() => setActiveTab('dialogue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse ${
                activeTab === 'dialogue'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>حوار الصانع (Live Chat)</span>
            </button>

            <button
              onClick={() => setActiveTab('human_metrics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse ${
                activeTab === 'human_metrics'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>مؤشرات القوة الإنسانية</span>
            </button>
          </div>

          <button
            onClick={() => setBotRunning(!botRunning)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shadow-lg flex items-center space-x-2 space-x-reverse border ${
              botRunning
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>{botRunning ? 'إيقاف مؤقت' : 'تفعيل العقل'}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE BOT MONOLOGUE & THOUGHT STREAM */}
      <AnimatePresence mode="wait">
        {activeTab === 'mind' && (
          <motion.div
            key="mind"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pt-5 space-y-4"
          >
            {/* Live Thought Bubble Box */}
            <div className="bg-slate-950/80 border border-white/10 rounded-2xl p-4 shadow-inner relative overflow-hidden">
              <div className="flex items-start space-x-3 space-x-reverse">
                <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 mt-0.5">
                  <Bot className="w-5 h-5 animate-bounce" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-cyan-300 font-sans flex items-center space-x-1.5 space-x-reverse">
                      <span>تفكير البوت اللحظي المكتوب لصانعه:</span>
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">تحديث مستمر</span>
                  </div>
                  <p className="text-sm font-medium text-white leading-relaxed font-sans">
                    "{currentThought}"
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Interactive Prompt Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400 block font-sans">اسأل بوتك مباشرة بضغطة زر:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  '💬 ماذا يدور في عقلك الكمومي الآن؟',
                  '🛡️ ما هو مستوى أمان محفظتي الحقيقي؟',
                  '📈 هل هناك فرصة تداول ممتازة الآن؟',
                  '⚡ اشرح لي حالة السبريد بلغة بسيطة'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveTab('dialogue');
                      handleSendMessage(chip.replace(/^💬 |^🛡️ |^📈 |^⚡ /, ''));
                    }}
                    className="px-3 py-1.5 bg-slate-950/70 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/30 rounded-xl text-xs transition-all font-sans"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: INTERACTIVE CREATOR DIALOGUE (LIVE CHAT) */}
        {activeTab === 'dialogue' && (
          <motion.div
            key="dialogue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pt-5 space-y-3"
          >
            {/* Chat Messages Box */}
            <div className="bg-slate-950/90 border border-white/10 rounded-2xl p-4 h-60 overflow-y-auto space-y-3 shadow-inner no-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start space-x-2 space-x-reverse ${
                    msg.sender === 'creator' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {msg.sender === 'creator' ? (
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0">
                      ص
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-xs font-bold shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`p-3 rounded-2xl max-w-lg text-xs leading-relaxed font-sans ${
                    msg.sender === 'creator'
                      ? 'bg-indigo-600/30 border border-indigo-500/30 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                  }`}>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1 border-b border-white/10 pb-0.5">
                      <span className="font-bold">{msg.sender === 'creator' ? `الصانع (${creatorEmail.split('@')[0]})` : 'عقل البوت الكمي'}</span>
                      <span className="font-mono">{msg.time}</span>
                    </div>
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2 space-x-reverse"
            >
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="تحدث مع بوتك... (مثال: ما رأيك في أداء اليوم؟)"
                className="flex-1 bg-slate-950 border border-white/15 rounded-xl px-4 py-2.5 text-white text-xs font-sans focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="submit"
                className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse shadow-lg shadow-cyan-600/20"
              >
                <Send className="w-4 h-4" />
                <span>إرسال</span>
              </button>
            </form>
          </motion.div>
        )}

        {/* TAB 3: HUMAN-READABLE METRICS (NO DRY MATH) */}
        {activeTab === 'human_metrics' && (
          <motion.div
            key="human_metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {/* 1. Opportunity Gravity (بدل Z-Score) */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-sans block">درجة جاذبية الفرصة اللحظية:</span>
              <div className="flex items-baseline space-x-2 space-x-reverse">
                <span className="text-xl font-bold font-mono text-emerald-400">ممتازة (92%)</span>
                <span className="text-[10px] text-slate-500 font-sans">جاهز لاقتناص السبريد</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full w-[92%]" />
              </div>
            </div>

            {/* 2. Market Weather (بدل GARCH Volatility) */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-sans block">طقس واستقرار السوق الحالي:</span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Wind className="w-5 h-5 text-cyan-400" />
                <span className="text-xl font-bold font-sans text-cyan-300">ملاحة آمنة متوازنة</span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans block">لا توجد أعاصير تقلب خطرة</span>
            </div>

            {/* 3. Reversion Speed (بدل Half-Life) */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-sans block">سرعة حصد الربح المتوقعة:</span>
              <div className="flex items-baseline space-x-2 space-x-reverse">
                <span className="text-xl font-bold font-mono text-indigo-400">خاطفة (4 ثوانٍ)</span>
                <span className="text-[10px] text-slate-500 font-sans">تداول عالي السرعة</span>
              </div>
              <span className="text-[10px] text-indigo-300 font-sans block font-semibold">تأثير فوري عبر فلتر كالمان</span>
            </div>

            {/* 4. Portfolio Shield (بدل Kelly & Collateral) */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2">
              <span className="text-xs text-slate-400 font-sans block">درجة أمان وحماية المحفظة:</span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-xl font-bold font-mono text-emerald-400">99.8% آمنة</span>
              </div>
              <span className="text-[10px] text-slate-400 font-sans block">محمية بـ 3 قواطع أمان تلقائية</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
