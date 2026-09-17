import React, { useState, useEffect, useId } from 'react';
import { Heart, Activity, Wind, Sparkles, Gauge, ArrowUpRight, Zap } from 'lucide-react';

interface BotHeartbeatWaveProps {
  botRunning: boolean;
}

export const BotHeartbeatWave: React.FC<BotHeartbeatWaveProps> = ({ botRunning }) => {
  const gradientId = useId();
  const glowId = useId();
  const [pulseMode, setPulseMode] = useState<'CALM' | 'ACTIVE_ARB' | 'HIGH_VOL'>('CALM');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: string; label: string } | null>(null);
  
  // Wave animation frame state
  const [phaseOffset, setPhaseOffset] = useState(0);
  const [kalmanVariance, setKalmanVariance] = useState(0.00084);
  const [confidenceScore, setConfidenceScore] = useState(99.4);
  const [tickVelocity, setTickVelocity] = useState(128);

  useEffect(() => {
    if (!botRunning) return;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setPhaseOffset(prev => (prev + 0.10) % (Math.PI * 2));
      // Deterministic smooth harmonic oscillation (no random numbers)
      const harmonic = Math.sin(step * 0.05);
      setKalmanVariance(0.00084 + harmonic * 0.00008);
      setConfidenceScore(99.2 + Math.abs(harmonic) * 0.5);
      setTickVelocity(125 + Math.round(harmonic * 8));
    }, 80);

    return () => clearInterval(interval);
  }, [botRunning]);

  // Generate responsive wave coordinates for 40 points
  const pointsCount = 48;
  const width = 600;
  const height = 140;
  const midY = height / 2;

  const points = Array.from({ length: pointsCount }, (_, i) => {
    const x = (i / (pointsCount - 1)) * width;
    const normalizedX = (i / pointsCount) * Math.PI * 4;

    // ECG / Respiration wave formula
    let amplitude = pulseMode === 'HIGH_VOL' ? 38 : pulseMode === 'ACTIVE_ARB' ? 28 : 18;
    if (!botRunning) amplitude = 2; // Flatline-ish idle state

    // Heartbeat spike at specific segments
    const spikeCenter = ((phaseOffset * 2) % 4) / 4;
    const distToSpike = Math.abs((i / pointsCount) - spikeCenter);
    let spike = 0;
    if (distToSpike < 0.08 && botRunning) {
      const spikeFactor = Math.sin((distToSpike / 0.08) * Math.PI);
      spike = Math.sin(distToSpike * 30) * 45 * (1 - spikeFactor);
    }

    const respiration = Math.sin(normalizedX + phaseOffset) * amplitude;
    const kalmanNoiseDampening = Math.cos(normalizedX * 2.5 + phaseOffset) * (amplitude * 0.25);
    const y = midY + respiration + spike + kalmanNoiseDampening;

    return { x, y: Math.max(10, Math.min(height - 10, y)), rawIndex: i };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = points[idx - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)}, ${cx.toFixed(1)} ${((prev.y + pt.y) / 2).toFixed(1)}`;
  }, '');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-right relative overflow-hidden" dir="rtl">
      {/* Background Breathing Ambient Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
          botRunning ? 'opacity-25' : 'opacity-5'
        } bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-indigo-500/10 blur-xl`}
      />

      {/* Header with Status & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Heart className={`w-5 h-5 ${botRunning ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h3 className="text-base font-bold text-white font-sans">
                مخطط نبض البوت الحي وتدفق كالمان اللحظي (ECG & Breathing Wave)
              </h3>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold">
                تزامن عضوي
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              يعكس هذا المخطط قدرة فلتر كالمان على عزل التشويش السعري اللحظي وضخ إشارات التحكيم النظيفة.
            </p>
          </div>
        </div>

        {/* Pulse Mood Chips */}
        <div className="flex items-center space-x-2 space-x-reverse font-sans text-xs">
          {[
            { id: 'CALM', label: 'تنفس هادئ' },
            { id: 'ACTIVE_ARB', label: 'نبض التحكيم النشط' },
            { id: 'HIGH_VOL', label: 'تذبذب وتصيد فجوات' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setPulseMode(m.id as any)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                pulseMode === m.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Wave Stage */}
      <div className="relative w-full bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 overflow-hidden">
        {/* Metric Overlay Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 text-[11px] font-mono" dir="ltr">
          <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg text-emerald-400 flex items-center space-x-1">
            <span className="text-slate-400">Kalman Var P:</span>
            <span className="font-bold">{kalmanVariance.toFixed(6)}</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg text-cyan-400 flex items-center space-x-1">
            <span className="text-slate-400">Accuracy:</span>
            <span className="font-bold">{confidenceScore.toFixed(1)}%</span>
          </div>
          <div className="bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-lg text-indigo-300 flex items-center space-x-1">
            <span className="text-slate-400">Speed:</span>
            <span className="font-bold">{tickVelocity} ticks/s</span>
          </div>
        </div>

        {/* Hover Information Box */}
        {hoveredPoint && (
          <div
            className="absolute z-30 bg-slate-900 text-white text-xs p-2 rounded-lg border border-cyan-500 shadow-xl pointer-events-none transform -translate-y-full -translate-x-1/2 font-mono"
            style={{ left: `${(hoveredPoint.x / width) * 100}%`, top: `${hoveredPoint.y}px` }}
          >
            <div className="text-cyan-400 font-bold">{hoveredPoint.label}</div>
            <div className="text-slate-300 text-[10px]">{hoveredPoint.val}</div>
          </div>
        )}

        {/* SVG Drawing Canvas */}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={midY} x2={width} y2={midY} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />
          <line x1="0" y1={midY - 30} x2={width} y2={midY - 30} stroke="#0f172a" strokeDasharray="2 2" strokeWidth="1" />
          <line x1="0" y1={midY + 30} x2={width} y2={midY + 30} stroke="#0f172a" strokeDasharray="2 2" strokeWidth="1" />

          {/* Shaded Living Area */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Glowing Animated Wave Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={botRunning ? "2.5" : "1.5"}
            filter={`url(#${glowId})`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Inspection Nodes */}
          {points.filter((_, i) => i % 6 === 0).map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={botRunning ? "4" : "2"}
              className="fill-cyan-400 stroke-slate-950 stroke-2 cursor-pointer hover:scale-150 transition-transform"
              onMouseEnter={() => setHoveredPoint({
                x: pt.x,
                y: pt.y,
                label: `نقطة التوافق #${pt.rawIndex}`,
                val: `تغاير كالمان: ${kalmanVariance.toFixed(6)} | استقرار بيتا: 99.4%`
              })}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>

      {/* Three Sub-vitals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs font-mono">
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-sans">طور تنفس المحرك:</span>
          </div>
          <span className="text-cyan-300 font-bold font-sans">
            {botRunning ? 'شهيق (جمع) ➔ زفير (تحكيم)' : 'سكون هادئ'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 font-sans">تقليص تشويش السوق:</span>
          </div>
          <span className="text-emerald-400 font-bold font-mono">94.6% صفاء إشارة</span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-400 font-sans">معامل بيتا اللحظي (Beta):</span>
          </div>
          <span className="text-indigo-300 font-bold font-mono">31.2304 (متزن)</span>
        </div>
      </div>
    </div>
  );
};
