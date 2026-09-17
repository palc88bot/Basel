import React from 'react';
import { Activity, Cpu, ShieldAlert, BarChart3, Bot, Terminal, Zap, Layers, Bell, Sliders, TrendingUp, DollarSign, Heart, ShieldCheck, Key, Award, Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  botRunning: boolean;
  setBotRunning: (running: boolean) => void;
  equity: number;
  dailyPnl: number;
  walletBalance: number;
  wsStatus?: {
    status: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'FAILED';
    exchangeName?: string;
    reconnectAttempt?: number;
  };
  onRecoverState?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  botRunning,
  setBotRunning,
  equity,
  dailyPnl,
  walletBalance,
  wsStatus = { status: 'CONNECTED', exchangeName: 'Universal Multi-Exchange' },
  onRecoverState
}) => {
  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-lg" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 space-x-reverse cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <span className="font-extrabold text-base tracking-wide bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                  أوميغا كوانت برين (OMEGA)
                </span>
                <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-cyan-500/30">
                  الإصدار 5.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                بوت كمي حي • العقود الآجلة • تكيف المحافظ الصغيرة والكبيرة
              </p>
            </div>
          </div>

          {/* WebSocket Status Indicator Badge */}
          <div className="hidden sm:flex items-center space-x-2 space-x-reverse px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all shadow-sm ${
            wsStatus.status === 'CONNECTED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : wsStatus.status === 'RECONNECTING'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300 animate-bounce'
          }">
            {wsStatus.status === 'CONNECTED' ? (
              <span className="flex items-center space-x-1.5 space-x-reverse text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-sans font-semibold">متصل مباشر</span>
              </span>
            ) : wsStatus.status === 'RECONNECTING' ? (
              <span className="flex items-center space-x-1.5 space-x-reverse text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="font-sans font-semibold">إعادة اتصال (Backoff)...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 space-x-reverse text-rose-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="font-sans font-semibold">انقطاع الاتصال</span>
              </span>
            )}
            <span className="text-[10px] text-slate-400 border-r border-slate-700/80 pr-2 mr-2 max-w-[130px] truncate hidden md:inline">
              {wsStatus.exchangeName || 'Universal API'}
            </span>
          </div>

          {/* Quick Metrics & Pulse */}
          <div className="hidden lg:flex items-center space-x-5 space-x-reverse bg-slate-950/70 px-4 py-2 rounded-xl border border-slate-800 font-mono text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-sans">المحفظة المرصودة</span>
              <span className="text-white font-bold text-sm">${walletBalance.toFixed(2)}</span>
            </div>
            <div className="border-r border-slate-800 pr-4">
              <span className="text-slate-400 block text-[10px] font-sans">الربح اليومي المحقق</span>
              <span className={`font-bold text-sm ${dailyPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {dailyPnl >= 0 ? '+' : ''}${dailyPnl.toFixed(2)}
              </span>
            </div>
            <div className="border-r border-slate-800 pr-4">
              <span className="text-slate-400 block text-[10px] font-sans">نبض عقل البوت</span>
              <span className={`flex items-center space-x-1.5 space-x-reverse font-sans font-bold ${botRunning ? 'text-cyan-400' : 'text-amber-400'}`}>
                <Heart className={`w-3.5 h-3.5 ${botRunning ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
                <span>{botRunning ? '72 BPM حي' : 'استعداد'}</span>
              </span>
            </div>
          </div>

          {/* Quick Actions: Recover State & Start/Stop */}
          <div className="flex items-center space-x-2 space-x-reverse">
            {onRecoverState && (
              <button
                onClick={onRecoverState}
                title="استعادة آخر وضع وحالة معروفة للبوت من قاعدة الحالة"
                className="px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 space-x-reverse"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">استعادة الحالة</span>
              </button>
            )}

            <button
              onClick={() => setBotRunning(!botRunning)}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-md flex items-center space-x-1.5 space-x-reverse ${
                botRunning
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              <span>{botRunning ? '⏹ إيقاف مؤقت' : '▶ تشغيل البوت'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex space-x-1 space-x-reverse overflow-x-auto py-2 border-t border-slate-800/80 no-scrollbar">
          {[
            { id: 'dashboard', label: 'لوحة النبض والقيادة', icon: Activity },
            { id: 'futures', label: 'ماسح عملات الفيوتشرز الشامل', icon: TrendingUp },
            { id: 'vault', label: 'خزنة الأسرار وربط الـ API', icon: Key },
            { id: 'alerts', label: 'التنبيهات وتيليجرام', icon: Bell },
            { id: 'copilot', label: 'المستشار الذكي Gemini', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 space-x-reverse px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
