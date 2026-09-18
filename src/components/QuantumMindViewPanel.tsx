import React, { useState } from 'react';
import { 
  Atom, 
  Sparkles, 
  Sliders, 
  Play, 
  Flame, 
  ShieldCheck, 
  Activity, 
  BarChart2, 
  Zap, 
  Cpu, 
  RefreshCw,
  TrendingUp,
  Percent,
  Compass,
  ArrowUpRight
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { QuantumMind } from '../core/quantum/quantumMind';
import { QuantumTrainer, TrainingMetricsResult } from '../core/quantum/trainer';
import { QuantumBacktestEngine, QuantumWalkForwardEngine, QuantumBacktestMetrics, QuantumTradeRecord } from '../core/quantum/backtestEngine';
import { Kline } from '../core/quantum/binanceWs';

export const QuantumMindViewPanel: React.FC = () => {
  const quantumMind = QuantumMind.getInstance();

  const [activeTab, setActiveTab] = useState<'INFERENCE' | 'TRAINING' | 'BACKTEST' | 'WALK_FORWARD'>('INFERENCE');

  // 8-dim features
  const [marketFeatures, setMarketFeatures] = useState<number[]>([
    0.65,  // RSI
    0.12,  // MACD
    0.78,  // Bollinger
    0.34,  // ATR Volatility
    0.55,  // Volume Delta
    -0.22, // Order Book Imbalance
    0.41,  // Momentum
    0.67   // Price Action
  ]);

  const [result, setResult] = useState(quantumMind.decide(marketFeatures));
  const [scenarios, setScenarios] = useState<Array<{ id: number; data: number[]; res: any }>>([]);

  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainEpochs, setTrainEpochs] = useState(15);
  const [trainResult, setTrainResult] = useState<TrainingMetricsResult | null>(null);

  // Backtest & Walk-Forward State
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestMetrics, setBacktestMetrics] = useState<QuantumBacktestMetrics | null>(null);
  const [backtestTrades, setBacktestTrades] = useState<QuantumTradeRecord[]>([]);
  const [equityCurveData, setEquityCurveData] = useState<Array<{ step: number; equity: number }>>([]);
  const [slippageSetting, setSlippageSetting] = useState(0.025); // 0.025%
  const [dynamicSizing, setDynamicSizing] = useState(true);

  // Walk-forward output
  const [wfResult, setWfResult] = useState<any | null>(null);

  // Helper: Synthesize realistic historic candle stream for validation
  const generateMarketKlines = (count: number = 300, basePrice: number = 64200): Kline[] => {
    const klines: Kline[] = [];
    let price = basePrice;
    let now = Date.now() - count * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const delta = (Math.random() - 0.49) * (price * 0.0035);
      const open = price;
      price = Math.max(100, price + delta);
      const high = Math.max(open, price) + Math.random() * (price * 0.0015);
      const low = Math.min(open, price) - Math.random() * (price * 0.0015);
      const close = price;
      const volume = 45 + Math.random() * 80;

      klines.push({
        timestamp: now + i * 60000,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: parseFloat(volume.toFixed(2)),
        closeTime: now + (i + 1) * 60000 - 1,
        quoteVolume: parseFloat((volume * close).toFixed(2)),
        trades: Math.floor(120 + Math.random() * 150)
      });
    }
    return klines;
  };

  const handleRandomizeAndTest = () => {
    const newFeatures = Array(8).fill(0).map(() => parseFloat((Math.random() * 2 - 1).toFixed(2)));
    setMarketFeatures(newFeatures);
    const res = quantumMind.decide(newFeatures);
    setResult(res);

    const list = [];
    for (let i = 0; i < 5; i++) {
      const data = Array(8).fill(0).map(() => parseFloat((Math.random() * 2 - 1).toFixed(2)));
      const scRes = quantumMind.decide(data);
      list.push({ id: i + 1, data, res: scRes });
    }
    setScenarios(list);
  };

  const handleRunTraining = async () => {
    setIsTraining(true);
    try {
      const klines = generateMarketKlines(250);
      const trainer = new QuantumTrainer(quantumMind, {
        epochs: trainEpochs,
        batchSize: 16,
        learningRate: 0.04,
        validationSplit: 0.2
      });

      const res = await trainer.train(klines);
      setTrainResult(res);
      setResult(quantumMind.decide(marketFeatures));
    } catch (e) {
      console.error(e);
    } finally {
      setIsTraining(false);
    }
  };

  const handleRunBacktest = () => {
    setIsBacktesting(true);
    setTimeout(() => {
      try {
        const klines = generateMarketKlines(350);
        const engine = new QuantumBacktestEngine(quantumMind, {
          initialCapital: 10000,
          basePositionSizePercent: 0.02,
          leverage: 5,
          slippagePercent: slippageSetting / 100,
          confidenceThreshold: 12,
          dynamicPositionSizing: dynamicSizing
        });

        const trades = engine.run(klines);
        const metrics = engine.getMetrics();
        const curve = engine.getEquityCurve().map((eq, idx) => ({ step: idx, equity: Math.round(eq) }));

        setBacktestTrades(trades);
        setBacktestMetrics(metrics);
        setEquityCurveData(curve);
      } catch (err) {
        console.error(err);
      } finally {
        setIsBacktesting(false);
      }
    }, 150);
  };

  const handleRunWalkForward = async () => {
    setIsBacktesting(true);
    try {
      const klines = generateMarketKlines(400);
      const wf = await QuantumWalkForwardEngine.run(klines, quantumMind, {
        trainWindow: 160,
        testWindow: 50,
        step: 50
      });
      setWfResult(wf);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBacktesting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Atom className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h2 className="text-lg font-bold text-white font-sans">العقل الكمومي الحي (Quantum Living Mind)</h2>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-mono font-bold">
                8-QUBIT VQC ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              شبكة عصبية كمومية بارامترية (VQC) متكاملة مع التحسين التحليلي (Parameter-Shift) والباك تيست المؤسسي الواقعي.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('INFERENCE')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'INFERENCE' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            الاستدلال اللحظي
          </button>
          <button
            onClick={() => setActiveTab('TRAINING')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'TRAINING' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            التدريب الذاتي (Training)
          </button>
          <button
            onClick={() => setActiveTab('BACKTEST')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'BACKTEST' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            الباك تيست مع الانزلاق
          </button>
          <button
            onClick={() => setActiveTab('WALK_FORWARD')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'WALK_FORWARD' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Walk-Forward (منع Overfitting)
          </button>
        </div>
      </div>

      {/* TAB 1: INFERENCE & SENSORY INPUTS */}
      {activeTab === 'INFERENCE' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-300 font-sans flex items-center space-x-2 space-x-reverse">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>مدخلات الحواس الكمومية (Quantum Feature Vector [-1, +1]):</span>
            </h3>
            <button
              onClick={handleRandomizeAndTest}
              className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5 space-x-reverse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>عشوائية وتوليد سناريوهات</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
            {['RSI Momentum', 'MACD Hist', 'Bollinger %B', 'ATR Volatility', 'Volume Delta', 'OFI Depth', 'Momentum', 'Price Action'].map((label, idx) => (
              <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{label} (Q{idx}):</span>
                  <span className="text-indigo-400 font-mono font-bold">{marketFeatures[idx]}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={marketFeatures[idx]}
                  onChange={(e) => {
                    const copy = [...marketFeatures];
                    copy[idx] = parseFloat(e.target.value);
                    setMarketFeatures(copy);
                    setResult(quantumMind.decide(copy));
                  }}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* DECISION DISPLAY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
              <span className="text-slate-400 text-xs">القرار الكمومي الصافي:</span>
              <span className="text-lg font-bold text-white font-mono mt-1">{result.label}</span>
              <span className="text-[10px] text-slate-500 mt-2">مُستنتج عبر زوايا الدوران في فضاء هيلبرت</span>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
              <span className="text-slate-400 text-xs">ثقة التشابك الكمومي:</span>
              <span className="text-lg font-bold text-indigo-400 font-mono mt-1">{result.confidence}%</span>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-indigo-500 h-full transition-all" style={{ width: `${result.confidence}%` }} />
              </div>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col justify-between">
              <span className="text-slate-400 text-xs">طاقة هيلبرت (Hilbert Energy):</span>
              <span className="text-lg font-bold text-cyan-400 font-mono mt-1">{result.HilbertEnergy} eV</span>
              <span className="text-[10px] text-slate-500 mt-2">Parameter-Shift Rule Optimized</span>
            </div>
          </div>

          {scenarios.length > 0 && (
            <div className="space-y-2 text-xs font-sans">
              <h4 className="font-bold text-slate-300">سيناريوهات التحقق الفوري:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {scenarios.map((sc) => (
                  <div key={sc.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800/80 flex justify-between items-center font-mono">
                    <span className="text-slate-400">سيناريو #{sc.id}:</span>
                    <span className="text-white font-bold">{sc.res.label}</span>
                    <span className="text-indigo-400">{sc.res.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAINING LOOP WITH PARAMETER-SHIFT */}
      {activeTab === 'TRAINING' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>تدريب الدائرة الكمومية (Parameter-Shift Analytical Optimizer)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تحديث معاملات بوابات الدوران (Rot/Rz) عبر التفاضل الكمومي التحليلي الدقيق والتوقف المبكر (Early Stopping).
              </p>
            </div>

            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="flex items-center space-x-2 space-x-reverse text-xs">
                <span className="text-slate-400">عدد الحلقات (Epochs):</span>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={trainEpochs}
                  onChange={(e) => setTrainEpochs(Number(e.target.value))}
                  className="w-16 bg-slate-900 border border-slate-800 px-2 py-1 rounded text-white font-mono"
                />
              </div>

              <button
                disabled={isTraining}
                onClick={handleRunTraining}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-lg flex items-center space-x-2 space-x-reverse"
              >
                {isTraining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{isTraining ? 'جاري التدريب الكمومي...' : 'بدء حلقة التدريب'}</span>
              </button>
            </div>
          </div>

          {trainResult && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">دقة التدريب (Train Acc):</span>
                <span className="text-xl font-bold text-emerald-400">{(trainResult.trainAccuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">دقة التحقق (Validation Acc):</span>
                <span className="text-xl font-bold text-cyan-400">{(trainResult.valAccuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">الخسارة النهائية (Loss):</span>
                <span className="text-xl font-bold text-indigo-400">{trainResult.finalLoss.toFixed(4)}</span>
              </div>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                <span className="text-slate-400 block mb-1">الحلقات المنجزة:</span>
                <span className="text-xl font-bold text-white">{trainResult.totalEpochs} / {trainEpochs}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REALISTIC BACKTEST WITH SLIPPAGE & DYNAMIC SIZING */}
      {activeTab === 'BACKTEST' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 p-4 border border-slate-800 rounded-xl text-xs">
            <div>
              <label className="text-slate-400 block mb-1">نمذجة الانزلاق السعري (Slippage %):</label>
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="number"
                  step="0.005"
                  min="0"
                  max="0.2"
                  value={slippageSetting}
                  onChange={(e) => setSlippageSetting(parseFloat(e.target.value))}
                  className="w-24 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-white font-mono"
                />
                <span className="text-slate-500 font-mono">% (موصى: 0.025%)</span>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">إدارة الحجم التكيفية (Dynamic Sizing):</label>
              <button
                onClick={() => setDynamicSizing(!dynamicSizing)}
                className={`px-3 py-1.5 rounded-lg border font-mono font-bold transition-all ${
                  dynamicSizing 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                {dynamicSizing ? 'مُفعّل (بناءً على الثقة وATR)' : 'ثابت (2% فقط)'}
              </button>
            </div>

            <div className="flex items-end justify-end">
              <button
                disabled={isBacktesting}
                onClick={handleRunBacktest}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2 space-x-reverse"
              >
                {isBacktesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>تنفيذ الباك تيست الكمومي</span>
              </button>
            </div>
          </div>

          {backtestMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 font-mono text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">معدل الفوز (Win Rate):</span>
                  <span className="text-lg font-bold text-emerald-400">{backtestMetrics.winRate}%</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">إجمالي الربح الصافي:</span>
                  <span className={`text-lg font-bold ${backtestMetrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${backtestMetrics.totalPnl}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">نسبة شارب (Sharpe):</span>
                  <span className="text-lg font-bold text-indigo-400">{backtestMetrics.sharpeRatio}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">أقصى هبوط (Max DD):</span>
                  <span className="text-lg font-bold text-amber-400">{backtestMetrics.maxDrawdownPercent}%</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">معامل الربح (Profit Factor):</span>
                  <span className="text-lg font-bold text-cyan-400">{backtestMetrics.profitFactor}</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1 text-[11px]">ضريبة الانزلاق المقتطعة:</span>
                  <span className="text-lg font-bold text-rose-400 font-mono">${backtestMetrics.totalSlippagePaid}</span>
                </div>
              </div>

              {/* Equity Chart */}
              {equityCurveData.length > 0 && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center space-x-2 space-x-reverse">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>منحنى رأس المال مع الانزلاق السعري (Realistic Equity Curve):</span>
                  </h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={equityCurveData}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis dataKey="step" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                        <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WALK-FORWARD OUT-OF-SAMPLE VALIDATION */}
      {activeTab === 'WALK_FORWARD' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 space-x-reverse">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>تحليل النوافذ المتحركة (Walk-Forward Analysis) لمنع الملاءمة الزائدة</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تدريب النموذج على نافذة تاريخية واختباره حصراً على بيانات لاحقة غير مرئية (Out-Of-Sample) لمحاكاة صمود البوت في العالم الحقيقي.
              </p>
            </div>

            <button
              disabled={isBacktesting}
              onClick={handleRunWalkForward}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg flex items-center space-x-2 space-x-reverse"
            >
              {isBacktesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              <span>تشغيل فحص Walk-Forward</span>
            </button>
          </div>

          {wfResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1">إجمالي نوافذ التحقق:</span>
                  <span className="text-xl font-bold text-white">{wfResult.windowsCount} نوافذ اختبارية</span>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1">معدل الفوز التراكمي (OOS):</span>
                  <span className="text-xl font-bold text-emerald-400">{wfResult.aggregateMetrics.winRate}%</span>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1">الربح التراكمي:</span>
                  <span className="text-xl font-bold text-cyan-400">${wfResult.aggregateMetrics.totalPnl}</span>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-slate-400 block mb-1">نسبة شارب الإجمالية:</span>
                  <span className="text-xl font-bold text-indigo-400">{wfResult.aggregateMetrics.sharpeRatio}</span>
                </div>
              </div>

              {/* Windows breakdown */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs">
                <h4 className="font-bold text-slate-300 mb-3 font-sans">تفصيل نتائج النوافذ غير المرئية (Out-of-Sample Performance):</h4>
                <div className="space-y-2">
                  {wfResult.windowResults.map((w: any) => (
                    <div key={w.window} className="flex flex-wrap justify-between items-center p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="text-slate-400">نافذة #{w.window} (الشموع {w.testRange[0]} - {w.testRange[1]}):</span>
                      <span className="text-emerald-400 font-bold">Win Rate: {w.metrics.winRate}%</span>
                      <span className="text-cyan-400">PnL: ${w.metrics.totalPnl}</span>
                      <span className="text-indigo-400">Sharpe: {w.metrics.sharpeRatio}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
