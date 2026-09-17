import React, { useState } from 'react';
import { Terminal, Play, Loader2, TrendingUp, ShieldAlert, Award } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BacktestResult } from '../types';

export const BacktestView: React.FC = () => {
  const [initialEquity, setInitialEquity] = useState(10000);
  const [entryZ, setEntryZ] = useState(1.8);
  const [stopZ, setStopZ] = useState(2.8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quant/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialEquity, entryZ, stopZ })
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-4">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">OMEGA Challenger Backtest & Historical Simulation Suite</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">Test the statistical arbitrage parameters against historical BTC/ETH 1-hour parquets with realistic slippage and fee models.</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">INITIAL EQUITY ($)</label>
            <input
              type="number"
              value={initialEquity}
              onChange={(e) => setInitialEquity(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">ENTRY Z-SCORE</label>
            <input
              type="number"
              step="0.1"
              value={entryZ}
              onChange={(e) => setEntryZ(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">STOP LOSS Z-SCORE</label>
            <input
              type="number"
              step="0.1"
              value={stopZ}
              onChange={(e) => setStopZ(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{loading ? 'Running Backtest...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backtest Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-mono text-slate-400">TOTAL NET PROFIT</span>
              <h3 className={`text-2xl font-bold font-mono mt-1 ${result.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.totalPnl >= 0 ? '+' : ''}${result.totalPnl.toLocaleString()}
              </h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-mono text-slate-400">WIN RATE</span>
              <h3 className="text-2xl font-bold font-mono text-cyan-400 mt-1">{(result.winRate * 100).toFixed(1)}%</h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-mono text-slate-400">SHARPE RATIO</span>
              <h3 className="text-2xl font-bold font-mono text-emerald-400 mt-1">{result.sharpeRatio}</h3>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-mono text-slate-400">MAX DRAWDOWN</span>
              <h3 className="text-2xl font-bold font-mono text-rose-400 mt-1">{(result.maxDrawdown * 100).toFixed(2)}%</h3>
            </div>
          </div>

          {/* Equity Curve Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-4">Equity Curve Progression (30 Days)</h3>
            <div className="h-[300px] w-full bg-slate-950/60 rounded-xl p-4 border border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} dot={false} name="Equity ($)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-4">Executed Trades ({result.trades.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-3 px-4">TRADE ID</th>
                    <th className="py-3 px-4">DIRECTION</th>
                    <th className="py-3 px-4">ENTRY Z</th>
                    <th className="py-3 px-4">EXIT Z</th>
                    <th className="py-3 px-4">PNL ($)</th>
                    <th className="py-3 px-4">EXIT REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {result.trades.map((trd) => (
                    <tr key={trd.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white">{trd.id}</td>
                      <td className="py-3 px-4 text-cyan-400">{trd.direction}</td>
                      <td className="py-3 px-4">{trd.entryZ}</td>
                      <td className="py-3 px-4">{trd.exitZ}</td>
                      <td className={`py-3 px-4 font-bold ${trd.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trd.pnl >= 0 ? '+' : ''}${trd.pnl}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{trd.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
