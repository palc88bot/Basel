import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BotConfig } from '../types';

interface RiskManagementViewProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const RiskManagementView: React.FC<RiskManagementViewProps> = ({ config, setConfig }) => {
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <h2 className="text-base font-semibold text-white">Risk Management Layer & Triple Barrier Protection</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">Configure automated stop-losses, take-profits, time limits, Kelly position sizers, and circuit breakers.</p>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Position Sizing */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <span>Position Sizing</span>
              </h3>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Max Position % of Equity</label>
                <input
                  type="number"
                  step="0.01"
                  value={config.maxPositionPct}
                  onChange={(e) => setConfig({ ...config, maxPositionPct: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Max Leverage (x)</label>
                <input
                  type="number"
                  value={config.maxLeverage}
                  onChange={(e) => setConfig({ ...config, maxLeverage: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="kelly"
                  checked={config.useKelly}
                  onChange={(e) => setConfig({ ...config, useKelly: e.target.checked })}
                  className="w-4 h-4 accent-cyan-500 rounded bg-slate-900 border-slate-700"
                />
                <label htmlFor="kelly" className="text-xs text-slate-300 font-medium">Use Half-Kelly Criterion Sizing</label>
              </div>
            </div>

            {/* Triple Barriers */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Triple Barriers</span>
              </h3>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Entry Z-Score Threshold</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.entryZ}
                  onChange={(e) => setConfig({ ...config, entryZ: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Stop Loss Z-Score</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.stopZ}
                  onChange={(e) => setConfig({ ...config, stopZ: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Time Limit (Seconds)</label>
                <input
                  type="number"
                  value={config.timeLimitSeconds}
                  onChange={(e) => setConfig({ ...config, timeLimitSeconds: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm"
                />
              </div>
            </div>

            {/* Circuit Breakers */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Circuit Breakers</span>
              </h3>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300 space-y-1">
                <p className="font-bold">Active Safety Interlocks:</p>
                <p>• Max Daily Loss: 5.0%</p>
                <p>• Max Drawdown: 10.0%</p>
                <p>• Max Consecutive Losses: 3</p>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 text-xs"
                >
                  Save Risk Parameters
                </button>
                {saved && (
                  <p className="text-emerald-400 text-xs text-center mt-2 flex items-center justify-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Parameters successfully updated!</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
