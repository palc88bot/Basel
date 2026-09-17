import React, { useState } from 'react';
import { Cpu, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage } from '../types';

export const GeminiQuantCopilot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'omega',
      text: "Hello! I am OMEGA QuantBrain AI, your elite quantitative trading bot architect and analytical geometry expert. Ask me anything about Kalman filters, Ornstein-Uhlenbeck stationarity, FreqAI ML models, or risk management strategies.",
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentInput, context: { engine: 'OMEGA v4.2', activePairs: ['BTC-USDT', 'ETH-USDT'] } })
      });
      const data = await res.json();

      const omegaMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: data.reply || "No response received from Gemini API.",
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages(prev => [...prev, omegaMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'omega',
        text: "⚠️ Error connecting to Gemini AI Copilot. Please check your API key and network connection.",
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md">
          <Cpu className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <span>OMEGA AI Quant Expert Copilot</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </h2>
          <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash Server-Side API</p>
        </div>
      </div>

      {/* Messages Box */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              msg.sender === 'user' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-indigo-600 text-white'
            }`}>
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.sender === 'user'
                ? 'bg-cyan-500/10 text-cyan-100 border border-cyan-500/30'
                : 'bg-slate-950 text-slate-200 border border-slate-800'
            }`}>
              <div className="text-[10px] text-slate-400 mb-1 font-mono">{msg.timestamp}</div>
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-400 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>OMEGA is formulating quantitative analysis...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="pt-4 border-t border-slate-800 flex items-center space-x-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Kalman filter parameters, Z-score thresholds, or FreqAI strategies..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 font-sans"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-3 rounded-xl transition-all flex items-center space-x-2 shadow-lg shadow-cyan-500/20"
        >
          <Send className="w-4 h-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
