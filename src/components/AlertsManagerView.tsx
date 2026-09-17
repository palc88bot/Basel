import React, { useState, useEffect } from 'react';
import { Bell, Send, ShieldAlert, CheckCircle2, AlertTriangle, Info, Terminal, Settings } from 'lucide-react';
import { AlertLog } from '../types';

export const AlertsManagerView: React.FC = () => {
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [telegramToken, setTelegramToken] = useState('7182938491:AAHk...');
  const [telegramChatId, setTelegramChatId] = useState('@omega_quant_signals');
  const [webhookUrl, setWebhookUrl] = useState('https://discord.com/api/webhooks/...');
  const [testMessage, setTestMessage] = useState('🚨 تم تفعيل قاطع الدائرة (Circuit Breaker) - السوق متقلب جداً');
  const [testLevel, setTestLevel] = useState<'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'>('WARNING');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/alerts/history');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTestAlert = async (channel: 'TELEGRAM' | 'WEBHOOK' | 'SYSTEM') => {
    setSending(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: channel === 'TELEGRAM' ? 'إشعار تيليجرام أوميغا' : 'إشعار ويب هوك',
          message: testMessage,
          level: testLevel,
          channel
        })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setStatusMessage(`✅ تم إرسال الإشعار بنجاح عبر قناة ${channel}`);
        setTimeout(() => setStatusMessage(''), 4000);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('❌ فشل في إرسال الإشعار');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 space-x-reverse mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">مركز الإشعارات والتنبيهات المباشرة (Superalgos & Telegram Alerts)</h2>
            <p className="text-xs text-slate-400">بث فوري لأحداث الصفقات، الإشارات، وتحذيرات قواطع الأمان إلى تيليجرام وقنوات الويب هوك.</p>
          </div>
        </div>

        {/* Integration Config Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2 space-x-reverse">
              <Send className="w-4 h-4 text-cyan-400" />
              <span>إعدادات تيليجرام (Telegram Bot)</span>
            </h3>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">رمز توكن البوت (Bot Token)</label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">معرف القناة أو المحادثة (Chat ID)</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
              />
            </div>
          </div>

          <div className="bg-slate-950/70 p-5 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2 space-x-reverse">
              <Settings className="w-4 h-4 text-purple-400" />
              <span>إعدادات رابط الويب هوك (Discord / Slack)</span>
            </h3>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">رابط الويب هوك (Webhook URL)</label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono text-xs"
              />
            </div>
            <div className="pt-2 flex items-center space-x-3 space-x-reverse">
              <button
                onClick={() => handleSendTestAlert('TELEGRAM')}
                disabled={sending}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال تجربة لتيليجرام</span>
              </button>
              <button
                onClick={() => handleSendTestAlert('WEBHOOK')}
                disabled={sending}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center space-x-1.5 space-x-reverse"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال تجربة للويب هوك</span>
              </button>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold text-center">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Live Alert Logs Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-sm flex items-center space-x-2 space-x-reverse">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>سجل التنبيهات المباشر ({logs.length})</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">تحديث فوري لجميع أحداث البوت</span>
        </div>

        <div className="space-y-3">
          {logs.map((log) => {
            const isCritical = log.level === 'CRITICAL' || log.level === 'ERROR';
            const isWarning = log.level === 'WARNING';
            return (
              <div
                key={log.id}
                className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs ${
                  isCritical
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    : isWarning
                    ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center space-x-3 space-x-reverse">
                  {isCritical ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold block text-white font-sans">{log.title}</span>
                    <span className="text-[11px] opacity-90">{log.message}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 space-x-reverse text-[11px] opacity-75">
                  <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{log.channel}</span>
                  <span>{log.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
