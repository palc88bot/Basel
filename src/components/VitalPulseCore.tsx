import React from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Shield, Sparkles } from 'lucide-react';

interface VitalPulseCoreProps {
  volatility?: number; // Market volatility index (0.01 to 0.50+)
  botRunning: boolean;
  activePositionsCount: number;
  hoveredNearOpportunity?: boolean;
}

export const VitalPulseCore: React.FC<VitalPulseCoreProps> = ({
  volatility = 0.08,
  botRunning,
  activePositionsCount,
  hoveredNearOpportunity = false
}) => {
  // Calculate dynamic pulse duration based on volatility (higher volatility = faster pulse)
  // Volatility range: 0.02 (slow 3.5s cycle) to 0.30+ (fast 0.8s cycle)
  const clampedVol = Math.max(0.02, Math.min(0.35, volatility));
  const pulseDuration = Math.max(0.8, 3.5 - clampedVol * 8.0);

  // Dynamic status color & mood
  let moodColor = 'from-emerald-500 via-teal-400 to-cyan-500';
  let auraGlow = 'shadow-emerald-500/30';
  let statusText = 'نبض مطمئن وتدفق مستقر';

  if (!botRunning) {
    moodColor = 'from-slate-600 via-slate-500 to-slate-700';
    auraGlow = 'shadow-slate-500/10';
    statusText = 'في حالة سكون وسكون حذر';
  } else if (hoveredNearOpportunity) {
    moodColor = 'from-amber-400 via-yellow-300 to-emerald-400';
    auraGlow = 'shadow-yellow-400/50';
    statusText = 'انجازاب حيوي نحو فرصة ذهبية!';
  } else if (clampedVol > 0.20) {
    moodColor = 'from-purple-500 via-pink-500 to-rose-500';
    auraGlow = 'shadow-rose-500/40';
    statusText = 'نبض مرتفع - استشعار تقلبات عالية';
  } else if (activePositionsCount > 0) {
    moodColor = 'from-cyan-400 via-blue-500 to-indigo-500';
    auraGlow = 'shadow-cyan-400/40';
    statusText = 'نبض نشط - حراسة مراكز مفتوحة';
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      {/* Outer Bio-Rhythmic Aura Rings */}
      <div className="relative flex items-center justify-center w-36 h-36">
        {/* Layer 1: Continuous Fluid Morphing Ring */}
        <motion.div
          animate={
            botRunning
              ? {
                  scale: [1, 1.25, 1],
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
          className={`absolute inset-0 bg-gradient-to-tr ${moodColor} opacity-20 blur-xl rounded-full`}
        />

        {/* Layer 2: Rapid Shockwave Ripple on Volatility */}
        {botRunning && (
          <motion.div
            animate={{
              scale: [0.9, 1.4, 0.9],
              opacity: [0.6, 0, 0.6]
            }}
            transition={{
              duration: pulseDuration,
              repeat: Infinity,
              ease: 'easeOut'
            }}
            className={`absolute inset-0 rounded-full border-2 border-cyan-400/40 ${auraGlow}`}
          />
        )}

        {/* Layer 3: Rotating Orbit Ring */}
        <motion.div
          animate={botRunning ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-2 rounded-full border border-dashed border-cyan-500/30"
        />

        {/* Center Vital Nucleus (الجوهر الحيوي) */}
        <motion.div
          animate={
            hoveredNearOpportunity
              ? { scale: [1, 1.25, 1.1] }
              : botRunning
              ? { scale: [0.95, 1.08, 0.95] }
              : { scale: 1 }
          }
          transition={{
            duration: pulseDuration,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className={`relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr ${moodColor} p-0.5 shadow-2xl ${auraGlow} flex items-center justify-center cursor-pointer`}
        >
          <div className="w-full h-full bg-slate-950/90 backdrop-blur-md rounded-full flex flex-col items-center justify-center p-2 text-center border border-white/10">
            {hoveredNearOpportunity ? (
              <Zap className="w-7 h-7 text-amber-300 animate-bounce" />
            ) : activePositionsCount > 0 ? (
              <Shield className="w-7 h-7 text-cyan-400 animate-pulse" />
            ) : botRunning ? (
              <Activity className="w-7 h-7 text-emerald-400" />
            ) : (
              <Sparkles className="w-7 h-7 text-slate-500" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Vital Pulse Label */}
      <div className="mt-2 text-center">
        <span className="text-[11px] font-bold text-slate-200 block font-sans">
          {statusText}
        </span>
        <span className="text-[9px] text-slate-400 font-mono">
          سرعة النبض: {pulseDuration.toFixed(2)} ثانية | سرعة تقلبات السوق الحية
        </span>
      </div>
    </div>
  );
};
