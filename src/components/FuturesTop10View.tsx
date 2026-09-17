import React, { useState, useEffect } from 'react';
import { RefreshCw, Zap, Clock, Search, Filter, Eye, CheckCircle2, AlertTriangle, Activity, ArrowUpRight } from 'lucide-react';
import { FuturesPair } from '../types';

interface FuturesTop10ViewProps {
  onSelectPair?: (symbol: string) => void;
  walletBalance: number;
}

export const FuturesTop10View: React.FC<FuturesTop10ViewProps> = ({ onSelectPair, walletBalance }) => {
  const [pairs, setPairs] = useState<FuturesPair[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [preparedCount, setPreparedCount] = useState(0);
  const [backgroundCount, setBackgroundCount] = useState(0);
  const [exchangeName, setExchangeName] = useState('Binance Futures');

  const [remainingSec, setRemainingSec] = useState(1800);
  const [loading, setLoading] = useState(true);
  const [lastScanTime, setLastScanTime] = useState('');
  
  // Tab selection: READY (Default: show valid entries only), PREPARED, ALL, BACKGROUND
  const [selectedTab, setSelectedTab] = useState<'READY' | 'PREPARED' | 'ALL' | 'BACKGROUND'>('READY');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFutures = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/quant/futures-pairs');
      const data = await res.json();
      if (data.success) {
        setPairs(data.pairs || []);
        setTotalScanned(data.totalScannedCoins || (data.pairs ? data.pairs.length : 0));
        setReadyCount(data.readyCount || 0);
        setPreparedCount(data.preparedCount || 0);
        setBackgroundCount(data.backgroundCount || 0);
        setExchangeName(data.exchangeName || 'Binance Futures');
        setRemainingSec(data.nextScanRemainingSeconds || 1800);
        setLastScanTime(data.lastScanTime || new Date().toLocaleTimeString('ar-SA'));
      }
    } catch (err) {
      console.error('Error fetching futures scanner data:', err);
    } finally {
      setLoading(false);
    }
  };

  const [autoActive, setAutoActive] = useState(true);
  const [triggeringTrade, setTriggeringTrade] = useState(false);
  const [autoStatusMsg, setAutoStatusMsg] = useState('');

  const fetchAutoStatus = async () => {
    try {
      const res = await fetch('/api/execution/auto-engine');
      const data = await res.json();
      if (data.success) {
        setAutoActive(data.active);
      }
    } catch (err) {
      // silent
    }
  };

  const handleToggleAutoEngine = async () => {
    try {
      const res = await fetch('/api/execution/toggle-auto-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !autoActive })
      });
      const data = await res.json();
      if (data.success) {
        setAutoActive(data.active);
        setAutoStatusMsg(data.active ? '🟢 تم تفعيل المحرك الآلي بنجاح!' : '🟡 تم إيقاف المحرك الآلي مؤقتاً.');
        setTimeout(() => setAutoStatusMsg(''), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerInstantTrade = async () => {
    try {
      setTriggeringTrade(true);
      const res = await fetch('/api/execution/trigger-manual-auto-trade', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAutoStatusMsg('🚀 تم فحص كافة العملات الجاهزة وتنفيذ أفضل فرصة متاحة الآن بنجاح!');
        setTimeout(() => setAutoStatusMsg(''), 5000);
        fetchFutures();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringTrade(false);
    }
  };

  useEffect(() => {
    fetchFutures();
    fetchAutoStatus();
    const interval = setInterval(() => {
      setRemainingSec(prev => {
        if (prev <= 1) {
          fetchFutures();
          return 1800;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Filter pairs based on tab and search query
  const filteredPairs = pairs.filter(p => {
    const matchesSearch = searchQuery.trim() === '' ||
      p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.nameAr.includes(searchQuery);

    if (!matchesSearch) return false;

    if (selectedTab === 'READY') {
      return p.statusGroup === 'READY' || p.signal !== 'NEUTRAL';
    }
    if (selectedTab === 'PREPARED') {
      return p.statusGroup === 'PREPARED';
    }
    if (selectedTab === 'BACKGROUND') {
      return p.statusGroup === 'BACKGROUND';
    }
    return true; // ALL
  });

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-cyan-950 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center space-x-3 space-x-reverse">
              <span className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
              <h2 className="text-xl font-bold text-white">
                الماسح الشامل لعملات الفيوتشرز ({exchangeName})
              </h2>
            </div>
            <p className="text-xs text-cyan-200/80">
              يقوم البوت بمسح كافة عملات الفيوتشرز المتاحة على API المنصة، ويفرز تلقائياً الفرص الصالحة للدخول فوراً ويضع بقية العملات تحت الملاحظة بالخلفية للظهور التلقائي فور تحقق الشروط.
            </p>
          </div>

          <div className="flex items-center space-x-3 space-x-reverse bg-slate-950/80 px-4 py-2.5 rounded-xl border border-cyan-500/30 font-mono text-xs">
            <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">الفحص اللحظي القادم:</span>
              <span className="text-cyan-300 font-bold text-sm tracking-wider">{formatTime(remainingSec)}</span>
            </div>
            <button
              onClick={fetchFutures}
              title="تحديث المسح الآن"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors mr-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4 Summary Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-[11px] text-slate-400 block">عملات الفيوتشرز المنسوحة</span>
            <div className="flex items-baseline space-x-2 space-x-reverse mt-1">
              <span className="text-xl font-bold font-mono text-white">{totalScanned}</span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">على المنصة</span>
            </div>
          </div>

          <button
            onClick={() => setSelectedTab('READY')}
            className={`text-right p-3.5 rounded-xl border transition-all ${
              selectedTab === 'READY'
                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-emerald-500/30'
            }`}
          >
            <span className="text-[11px] text-emerald-400 block font-bold">الصالحة للدخول فوراً</span>
            <div className="flex items-baseline space-x-2 space-x-reverse mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{readyCount}</span>
              <span className="text-[10px] text-emerald-300/80 font-mono">طفرة إشارات</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedTab('PREPARED')}
            className={`text-right p-3.5 rounded-xl border transition-all ${
              selectedTab === 'PREPARED'
                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/30'
            }`}
          >
            <span className="text-[11px] text-cyan-300 block font-bold">تحت المراقبة الحثيثة</span>
            <div className="flex items-baseline space-x-2 space-x-reverse mt-1">
              <span className="text-xl font-bold font-mono text-cyan-300">{preparedCount}</span>
              <span className="text-[10px] text-cyan-200/80 font-mono">مُهيأة للدخول</span>
            </div>
          </button>

          <button
            onClick={() => setSelectedTab('BACKGROUND')}
            className={`text-right p-3.5 rounded-xl border transition-all ${
              selectedTab === 'BACKGROUND'
                ? 'bg-slate-900 border-slate-600 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-[11px] text-slate-400 block">ملاحظة بالخلفية</span>
            <div className="flex items-baseline space-x-2 space-x-reverse mt-1">
              <span className="text-xl font-bold font-mono text-slate-300">{backgroundCount}</span>
              <span className="text-[10px] text-slate-400 font-mono">رادار مستمر</span>
            </div>
          </button>
        </div>
      </div>

      {/* Auto Engine Execution Status & Action Control Bar */}
      <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className={`p-2.5 rounded-xl ${autoActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <span className="text-sm font-bold text-white">محرك التنفيذ التلقائي لفرص الفيوتشرز:</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${autoActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                {autoActive ? '🟢 مفعل بالخلفية (مسح وتنفيد مستمر)' : '🟡 متوقف مؤقتاً'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              يتفقد البوت الـ {readyCount} عملة الصالحة للدخول فوراً كل 12 ثانية، وينفذ الصفقات آلياً عبر API المنصة أو المحاكي بمجرد تأكيد إشارة التباعد.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse w-full md:w-auto">
          <button
            onClick={handleTriggerInstantTrade}
            disabled={triggeringTrade}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 space-x-reverse disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${triggeringTrade ? 'animate-bounce' : ''}`} />
            <span>{triggeringTrade ? 'جاري التنفيذ الفوري...' : '🚀 تنفيذ صفقة تلقائية الآن'}</span>
          </button>

          <button
            onClick={handleToggleAutoEngine}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all border flex items-center space-x-2 space-x-reverse ${
              autoActive
                ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                : 'bg-emerald-950 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900'
            }`}
          >
            <span>{autoActive ? '⏸️ إيقاف التداول التلقائي' : '▶️ تشغيل التداول التلقائي'}</span>
          </button>
        </div>
      </div>

      {autoStatusMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-xl text-xs font-bold text-center animate-fade-in">
          {autoStatusMsg}
        </div>
      )}

      {/* Filter Tabs & Search Control */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 shadow-lg">
        {/* Tab Selection */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedTab('READY')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse ${
              selectedTab === 'READY'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>الصالحة للدخول ({readyCount})</span>
          </button>

          <button
            onClick={() => setSelectedTab('PREPARED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse ${
              selectedTab === 'PREPARED'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>تحت المراقبة ومهيأة ({preparedCount})</span>
          </button>

          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse ${
              selectedTab === 'ALL'
                ? 'bg-indigo-500 text-white shadow-lg'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>جميع عملات المنصة ({totalScanned})</span>
          </button>

          <button
            onClick={() => setSelectedTab('BACKGROUND')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 space-x-reverse ${
              selectedTab === 'BACKGROUND'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>في الخلفية ({backgroundCount})</span>
          </button>
        </div>

        {/* Search Input Box */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث حسب رمز العملة..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Empty State Warning */}
      {filteredPairs.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto opacity-80 animate-pulse" />
          <h3 className="text-base font-bold text-white">لا توجد عملات تطابق خيارات التصفية الحالية</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {selectedTab === 'READY'
              ? 'السوق حالياً في حالة استقرار نسبي ولا توجد انحرافات شاذة حادة. البوت يحتفظ بكافة العملات تحت المراقبة بالخلفية وسيقوم بإبراز أي عملة فور اختراق حدود الأمان.'
              : 'جرب البحث برمز عملة آخر أو تغيير التبويب المحدد.'}
          </p>
          <button
            onClick={() => { setSelectedTab('ALL'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
          >
            عرض كافة عملات المنصة
          </button>
        </div>
      )}

      {/* Scanned Coins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPairs.map((pair) => {
          const isBuy = pair.signal === 'BUY' || pair.signal === 'STRONG_BUY';
          const isSell = pair.signal === 'SELL' || pair.signal === 'STRONG_SELL';
          const isReady = pair.statusGroup === 'READY' || isBuy || isSell;
          const isPrepared = pair.statusGroup === 'PREPARED';

          return (
            <div
              key={pair.symbol}
              className={`bg-slate-900/90 border rounded-2xl p-5 shadow-lg transition-all flex flex-col justify-between ${
                isReady
                  ? 'border-emerald-500/40 hover:border-emerald-400 shadow-emerald-500/5'
                  : isPrepared
                  ? 'border-cyan-500/30 hover:border-cyan-400'
                  : 'border-slate-800 hover:border-slate-700 opacity-90'
              }`}
            >
              <div>
                {/* Status Badge & Rank */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
                      #{pair.liquidityRank}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <h3 className="font-bold text-white text-base font-mono">{pair.symbol}</h3>
                        <span className="text-xs text-slate-400 font-sans font-semibold">({pair.nameAr})</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        حجم 24h: {pair.volume24hUsd >= 1e9 ? `$${(pair.volume24hUsd / 1e9).toFixed(2)} مليار` : `$${(pair.volume24hUsd / 1e6).toFixed(1)} مليون`}
                      </span>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-base font-bold font-mono text-white block">
                      ${pair.price >= 1 ? pair.price.toLocaleString() : pair.price}
                    </span>
                    <span className={`text-xs font-mono font-bold ${pair.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pair.change24h >= 0 ? '+' : ''}{pair.change24h}%
                    </span>
                  </div>
                </div>

                {/* Status Indicator Tag */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-sans flex items-center space-x-1.5 space-x-reverse ${
                    isReady
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isPrepared
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {isReady ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>🟢 صالحة للدخول فوراً (إشارة مؤكدة)</span>
                      </>
                    ) : isPrepared ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>🔵 تحت المراقبة ومهيأة للدخول</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        <span>⚪ تحت الملاحظة بالخلفية</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Quantitative Signals Bar */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 mb-3 grid grid-cols-3 gap-2 text-center font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">الانحراف (Z-Score)</span>
                    <span className={`font-bold ${isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-slate-200'}`}>
                      {pair.zScore > 0 ? `+${pair.zScore}` : pair.zScore}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">فترة الارتداد</span>
                    {(() => {
                      let halfLifeText = "";
                      let halfLifeColor = "text-slate-400";

                      if (!pair.halfLifeSec || pair.halfLifeSec === 0) {
                        halfLifeText = pair.isCalibrated === false ? "⏳ معايرة" : "⚠️ غير صالح";
                        halfLifeColor = "text-rose-400 font-bold";
                      } else if (pair.halfLifeSec >= 60 && pair.halfLifeSec <= 1800) {
                        halfLifeText = `${Math.round(pair.halfLifeSec)}s (مستقر)`;
                        halfLifeColor = "text-emerald-400 font-bold";
                      } else {
                        halfLifeText = `${Math.round(pair.halfLifeSec)}s (خارج النطاق)`;
                        halfLifeColor = "text-amber-400 font-bold";
                      }

                      return (
                        <span className={`text-xs ${halfLifeColor} block truncate`}>
                          {halfLifeText}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">السبريد اللحظي</span>
                    <span className="text-amber-300 font-bold">{pair.spreadPct}%</span>
                  </div>
                </div>

                {/* Bot Insight */}
                <div className={`p-3 rounded-xl mb-4 text-xs leading-relaxed border ${
                  isReady
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                    : isPrepared
                    ? 'bg-cyan-950/20 border-cyan-500/20 text-cyan-200'
                    : 'bg-slate-950/50 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center space-x-1.5 space-x-reverse font-bold mb-1">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>توجيه عقل البوت: {pair.activeTentacle}</span>
                  </div>
                  <p>{pair.signalReasonAr}</p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 font-mono text-xs">
                <span className="text-[11px] text-slate-400">
                  أدنى صفقة: ${pair.minNotionalUsd} | رافعة: {pair.recommendedLeverage}x
                </span>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <button
                    onClick={async () => {
                      try {
                        const tradeSizeUsd = Math.max(10, Math.min(50, (walletBalance || 1000) * 0.05));
                        const isBuy = pair.zScore < 0;
                        const res = await fetch('/api/execution/trade', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            position: {
                              id: `MANUAL-${pair.symbol}-${Date.now()}`,
                              sizeUsd: parseFloat(tradeSizeUsd.toFixed(2)),
                              beta: 1.0,
                              leverage: pair.recommendedLeverage
                            },
                            signal: {
                              signal: isBuy ? 'BUY' : 'SELL',
                              assetA: pair.symbol,
                              assetB: 'USDT',
                              entryPriceA: pair.price,
                              entryPriceB: 1.0
                            }
                          })
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert(`🟢 تم تنفيذ صفقة حقيقية/تجريبية على عملة ${pair.symbol} بنجاح!`);
                        } else {
                          alert(`⚠️ فشل التنفيذ: ${data.error || 'تعذر إرسال الأمر'}`);
                        }
                      } catch (e: any) {
                        alert(`خطأ في التنفيذ: ${e.message}`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-sans font-bold text-xs transition-colors flex items-center space-x-1 space-x-reverse"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تنفيذ مباشر</span>
                  </button>

                  {onSelectPair && (
                    <button
                      onClick={() => onSelectPair(pair.symbol)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-sans font-bold text-xs transition-colors flex items-center space-x-1 space-x-reverse"
                    >
                      <span>فتح في المحرك</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
