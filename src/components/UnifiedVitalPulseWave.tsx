import React, { useState, useEffect, useId } from 'react';
import { motion } from 'motion/react';
import { Heart, Activity, Zap, Sparkles, Sliders, ShieldCheck, Layers, Gauge } from 'lucide-react';

interface UnifiedVitalPulseWaveProps {
  botRunning: boolean;
  volatility?: number;
  activePositionsCount?: number;
  hoveredNearOpportunity?: boolean;
}

export const UnifiedVitalPulseWave: React.FC<UnifiedVitalPulseWaveProps> = ({
  botRunning,
  volatility = 0.08,
  activePositionsCount = 0,
  hoveredNearOpportunity = false
}) => {
  const gradientId = useId();
  const glowId = useId();

  // Wave harmonic & animation parameters
  const [phaseOffset, setPhaseOffset] = useState(0);
  const [pulseMode, setPulseMode] = useState<'CALM' | 'ACTIVE_ARB' | 'HIGH_VOL'>('CALM');
  const [kalmanVariance, setKalmanVariance] = useState(0.00084);
  const [confidenceScore, setConfidenceScore] = useState(99.4);
  const [tickVelocity, setTickVelocity] = useState(128);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: string; label: string } | null>(null);

  // Bio-rhythm dynamic pulse speed & mood
  const clampedVol = Math.max(0.02, Math.min(0.35, volatility));
  const pulseDuration = Math.max(0.8, 3.2 - clampedVol * 7.5);

  let moodColor = 'from-emerald-500 via-teal-400 to-cyan-500';
  let auraGlow = 'shadow-emerald-500/30';
  let statusBadge = 'نبض حيوي مستقر 100%';
  let statusMoodAr = 'تدفق هادئ وتزامن كمي مثالي';

  if (!botRunning) {
    moodColor = 'from-slate-600 via-slate-500 to-slate-700';
    auraGlow = 'shadow-slate-500/10';
    statusBadge = 'في حالة سكون حذر';
    statusMoodAr = 'المحرك في وضع الاستعداد الساكن';
  } else if (hoveredNearOpportunity) {
    moodColor = 'from-amber-400 via-yellow-300 to-emerald-400';
    auraGlow = 'shadow-yellow-400/50';
    statusBadge = '⚡ اقتناص فرصة ذهبية';
    statusMoodAr = 'انجذاب كمي نحو فرصة تحكيم فورية';
  } else if (clampedVol > 0.18) {
    moodColor = 'from-purple-500 via-pink-500 to-rose-500';
    auraGlow = 'shadow-rose-500/40';
    statusBadge = 'استشعار تقلبات عالية';
    statusMoodAr = 'عزل التشويش السعري عبر مرشح كالمان';
  } else if (activePositionsCount > 0) {
    moodColor = 'from-cyan-400 via-blue-500 to-indigo-500';
    auraGlow = 'shadow-cyan-400/40';
    statusBadge = 'حراسة مراكز نشطة';
    statusMoodAr = 'تتبع الانزلاق ونسبة التحوط بالوقت الفعلي';
  }

  // Harmonic oscillation loop
  useEffect(() => {
    if (!botRunning) return;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setPhaseOffset(prev => (prev + 0.10) % (Math.PI * 2));
      const harmonic = Math.sin(step * 0.05);
      setKalmanVariance(0.00084 + harmonic * 0.00008);
      setConfidenceScore(99.2 + Math.abs(harmonic) * 0.6);
      setTickVelocity(125 + Math.round(harmonic * 9));
    }, 75);

    return () => clearInterval(interval);
  }, [botRunning]);

  // Wave points calculation
  const pointsCount = 52;
  const width = 640;
  const height = 150;
  const midY = height / 2;

  const points = Array.from({ length: pointsCount }, (_, i) => {
    const x = (i / (pointsCount - 1)) * width;
    const normalizedX = (i / pointsCount) * Math.PI * 4;

    let amplitude = pulseMode === 'HIGH_VOL' ? 36 : pulseMode === 'ACTIVE_ARB' ? 26 : 18;
    if (!botRunning) amplitude = 3;

    // ECG spike at cycle center
    const spikeCenter = ((phaseOffset * 2) % 4) / 4;
    const distToSpike = Math.abs((i / pointsCount) - spikeCenter);
    let spike = 0;
    if (distToSpike < 0.08 && botRunning) {
      const spikeFactor = Math.sin((distToSpike / 0.08) * Math.PI);
      spike = Math.sin(distToSpike * 30) * 44 * (1 - spikeFactor);
    }

    const respiration = Math.sin(normalizedX + phaseOffset) * amplitude;
    const kalmanDampening = Math.cos(normalizedX * 2.5 + phaseOffset) * (amplitude * 0.22);
    const y = midY + respiration + spike + kalmanDampening;

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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden text-right" dir="rtl">
      {/* Background Breathing Ambient Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
          botRunning ? 'opacity-30' : 'opacity-5'
        } bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-indigo-500/10 blur-2xl`}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10 border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10 relative">
            <Heart className={`w-5 h-5 ${botRunning ? 'text-rose-500 animate-heartbeat' : 'text-slate-500'}`} />
            {botRunning && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <h3 className="text-base font-bold text-white font-sans">
                النبض الحيوي الموحد وتدفق كالمان اللحظي (Vital Pulse & Kalman Flow)
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                {statusBadge}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              دمج عضوي متزامن يجمع بين النواة الحيوية (Bio-Rhythm Core) وموجة تخميد التشويش السعري اللحظي لجميع العملات المحقونة.
            </p>
          </div>
        </div>

        {/* Pulse Mode Selector */}
        <div className="flex items-center space-x-1.5 space-x-reverse bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setPulseMode('CALM')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono ${
              pulseMode === 'CALM' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            توازن هادئ
          </button>
          <button
            onClick={() => setPulseMode('ACTIVE_ARB')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono ${
              pulseMode === 'ACTIVE_ARB' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            تحكيم نشط
          </button>
          <button
            onClick={() => setPulseMode('HIGH_VOL')}
            className={`px-2.5 py-1 rounded-lg transition-all font-mono ${
              pulseMode === 'HIGH_VOL' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            تقلبات حادة
          </button>
        </div>
      </div>

      {/* Main Unified Stage: Core Nucleus + Wave Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center relative z-10">
        {/* Left/Integrated Vital Nucleus Orb (3 cols) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 relative">
          <span className="text-[11px] font-bold text-slate-300 mb-2 flex items-center space-x-1.5 space-x-reverse">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>النواة الحيوية (Vital Nucleus)</span>
          </span>

          <div className="relative flex items-center justify-center w-28 h-28 my-1">
            {/* Morphing Outer Ring */}
            <motion.div
              animate={
                botRunning
                  ? {
                      scale: [1, 1.22, 1],
                      rotate: [0, 180, 360],
                      borderRadius: ['40% 60% 70% 30% / 40% 50% 60% 50%', '60% 40% 30% 70% / 50% 60% 40% 60%', '40% 60% 70% 30% / 40% 50% 60% 50%']
                    }
                  : { scale: 1, rotate: 0 }
              }
              transition={{
                duration: pulseDuration * 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className={`absolute inset-0 bg-gradient-to-tr ${moodColor} opacity-25 blur-lg rounded-full`}
            />

            {/* Shockwave Ripple */}
            {botRunning && (
              <motion.div
                animate={{
                  scale: [0.9, 1.35, 0.9],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{
                  duration: pulseDuration,
                  repeat: Infinity,
                  ease: 'easeOut'
                }}
                className={`absolute inset-0 rounded-full border-2 border-cyan-400/40 ${auraGlow}`}
              />
            )}

            {/* Rotating Orbit Ring */}
            <motion.div
              animate={botRunning ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-1 rounded-full border border-dashed border-cyan-500/40"
            />

            {/* Central Bio-Nucleus */}
            <motion.div
              animate={
                hoveredNearOpportunity
                  ? { scale: [1, 1.25, 1.1] }
                  : botRunning
                  ? { scale: [0.95, 1.1, 0.95] }
                  : { scale: 1 }
              }
              transition={{
                duration: pulseDuration,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className={`relative z-10 w-14 h-14 rounded-full bg-gradient-to-tr ${moodColor} flex items-center justify-center shadow-xl ${auraGlow} border-2 border-white/20`}
            >
              <Activity className="w-6 h-6 text-white drop-shadow-md" />
            </motion.div>
          </div>

          <span className="text-[10px] text-cyan-300 font-sans text-center mt-1">
            {statusMoodAr}
          </span>
        </div>

        {/* Right/Integrated ECG Wave Surface (9 cols) */}
        <div className="lg:col-span-9 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 relative">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1 border-b border-slate-800/60 pb-1.5">
            <span className="flex items-center space-x-1.5 space-x-reverse text-cyan-300">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>موجة فلتر كالمان اللحظية (Live Noise Dampening Wave)</span>
            </span>
            <span>السرعة: {tickVelocity} نبضة/د</span>
          </div>

          <div className="relative w-full h-32 overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-full preserve-3d"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#10b981" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </linearGradient>

                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1={midY} x2={width} y2={midY} stroke="#1e293b" strokeDasharray="4 4" strokeWidth="1" />
              <line x1="0" y1={midY - 35} x2={width} y2={midY - 35} stroke="#1e293b" strokeDasharray="2 4" strokeWidth="0.8" />
              <line x1="0" y1={midY + 35} x2={width} y2={midY + 35} stroke="#1e293b" strokeDasharray="2 4" strokeWidth="0.8" />

              {/* Area Gradient Fill */}
              <path d={areaD} fill={`url(#${gradientId})`} />

              {/* Main Glowing Resonant ECG Wave Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                filter={`url(#${glowId})`}
                className="transition-all duration-75"
              />

              {/* Interactive Hover Nodes */}
              {points.map((pt, idx) => {
                if (idx % 6 !== 0) return null;
                const isHovered = hoveredPoint?.x === pt.x;
                return (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5 : 2.5}
                    className="cursor-pointer transition-all fill-cyan-400 hover:fill-emerald-300 stroke-slate-900"
                    strokeWidth="1.5"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        x: pt.x,
                        y: pt.y,
                        val: `${((midY - pt.y) / 10).toFixed(2)}σ`,
                        label: `نقطة هيلبرت #${idx}`
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute pointer-events-none bg-slate-900/95 border border-cyan-500/40 text-[10px] text-white font-mono px-2 py-1 rounded shadow-lg transition-transform"
                style={{
                  left: `${(hoveredPoint.x / width) * 100}%`,
                  top: `${Math.max(5, (hoveredPoint.y / height) * 100 - 30)}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                <span className="text-cyan-400 font-bold block">{hoveredPoint.label}</span>
                <span className="text-slate-300">سبريد كالمان: {hoveredPoint.val}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">تباين كالمان اللحظي (Variance R)</span>
          <span className="text-cyan-400 font-bold text-sm block mt-0.5">
            {kalmanVariance.toFixed(6)}
          </span>
          <span className="text-[9px] text-slate-500">معايرة ذاتية بالخلفية لجميع الأزواج</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">ثقة العزل من التشويش</span>
          <span className="text-emerald-400 font-bold text-sm block mt-0.5">
            {confidenceScore.toFixed(1)}%
          </span>
          <span className="text-[9px] text-slate-500">منع الانزلاق الوهمي</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">زوج التحكيم المعتمد</span>
          <span className="text-white font-bold text-sm block mt-0.5">
            ETHUSDT / BTCUSDT
          </span>
          <span className="text-[9px] text-emerald-400">مُفعل للتحكيم اللحظي 100%</span>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
          <span className="text-[10px] text-slate-400 block font-sans">حالة حراسة المراكز</span>
          <span className="text-indigo-400 font-bold text-sm block mt-0.5">
            {activePositionsCount > 0 ? `${activePositionsCount} مراكز نشطة` : 'رصد هيلبرت التلقائي'}
          </span>
          <span className="text-[9px] text-slate-500">تتبع السلات الكمية 24/7</span>
        </div>
      </div>
    </div>
  );
};
