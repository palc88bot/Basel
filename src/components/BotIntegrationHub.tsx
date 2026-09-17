import React from 'react';
import { Bot, Cpu, Terminal, Share2, CheckCircle2 } from 'lucide-react';

export const BotIntegrationHub: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2 mb-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">Bot Integration & Ecosystem Hub</h2>
        </div>
        <p className="text-xs text-slate-400 mb-6">Connect OMEGA with Hummingbot V2 controllers, FreqAI ML training pipelines, Telegram mini-app dispatchers, and OctoBot tentacles.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hummingbot V2 */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Hummingbot V2 Controller</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">Connected</span>
            </div>
            <p className="text-xs text-slate-400">
              Controller class: <code className="text-cyan-400 font-mono">OmegaStatisticalArbController</code> executing automated pair trades on Bybit Perpetual & Binance USD-M.
            </p>
            <div className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div>Connector: <span className="text-cyan-400">bybit_perpetual_testnet</span></div>
              <div>Trading Pairs: <span className="text-cyan-400">BTC-USDT / ETH-USDT</span></div>
              <div>Execution Mode: <span className="text-emerald-400">Position Executor V2</span></div>
            </div>
          </div>

          {/* FreqAI & LSTM */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>FreqAI ML Pipeline</span>
              </h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono">Trained</span>
            </div>
            <p className="text-xs text-slate-400">
              Lightweight LSTM model for ultra-fast directional inference with 68µs latency, trained on historical crypto parquet datasets.
            </p>
            <div className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div>Model Path: <span className="text-indigo-400">models/lstm_direction.h5</span></div>
              <div>Feature Window: <span className="text-indigo-400">50 ticks</span></div>
              <div>Inference Speed: <span className="text-emerald-400">68 µs / tick</span></div>
            </div>
          </div>

          {/* Telegram Bot Dispatcher */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Telegram Bot Dispatcher</span>
              </h3>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono">Active</span>
            </div>
            <p className="text-xs text-slate-400">
              Real-time alert dispatcher pushing trade signals, PnL updates, and circuit breaker warnings to Telegram mini-app channels.
            </p>
            <div className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div>Webhook URL: <span className="text-slate-400">https://api.telegram.org/bot...</span></div>
              <div>Alert Mode: <span className="text-cyan-400">Instant Push (Signals & Exits)</span></div>
            </div>
          </div>

          {/* Broker Webhooks */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Direct Broker API Webhooks</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">Healthy</span>
            </div>
            <p className="text-xs text-slate-400">
              Encrypted vault storing API keys and secret signatures with automatic reconciliation and ping keep-alive daemons.
            </p>
            <div className="bg-slate-900 p-3 rounded-lg font-mono text-[11px] text-slate-300 space-y-1">
              <div>API Status: <span className="text-emerald-400">Authenticated (Read/Trade)</span></div>
              <div>Reconciliation Interval: <span className="text-slate-400">60 seconds</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
