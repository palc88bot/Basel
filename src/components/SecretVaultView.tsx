import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Key,
  Shield,
  ShieldCheck,
  Server,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Database,
  Terminal,
  Cpu,
  Zap,
  Globe
} from 'lucide-react';
import { VaultPublicStatus } from '../types';

interface SecretVaultViewProps {
  onCredentialsUpdated?: () => void;
}

export const SecretVaultView: React.FC<SecretVaultViewProps> = ({ onCredentialsUpdated }) => {
  const [vaultStatus, setVaultStatus] = useState<VaultPublicStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Active form exchange tab selection
  const [activeFormExchange, setActiveFormExchange] = useState<'BINANCE' | 'BYBIT'>('BINANCE');

  // Form states
  const [masterPassphrase, setMasterPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Bybit secrets editing
  const [bybitApiKey, setBybitApiKey] = useState('');
  const [bybitApiSecret, setBybitApiSecret] = useState('');
  const [bybitIsTestnet, setBybitIsTestnet] = useState(false);

  // Binance secrets editing
  const [binanceApiKey, setBinanceApiKey] = useState('');
  const [binanceApiSecret, setBinanceApiSecret] = useState('');
  const [binanceIsTestnet, setBinanceIsTestnet] = useState(true); // Default to Binance Testnet

  // Telegram
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  // Test connection state
  const [testingExchange, setTestingExchange] = useState<'BINANCE' | 'BYBIT' | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchVaultStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vault/status');
      const data = await res.json();
      if (data.success) {
        setVaultStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch vault status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultStatus();
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassphrase) return;
    try {
      setLoading(true);
      const endpoint = vaultStatus?.isInitialized ? '/api/vault/unlock' : '/api/vault/initialize';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase: masterPassphrase })
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'success', text: data.message || 'تم تهيئة الخزنة وتشفيرها وتحميلها بنجاح!' });
        setVaultStatus(data.status);
        setMasterPassphrase('');
        if (onCredentialsUpdated) onCredentialsUpdated();
      } else {
        setActionNotice({ type: 'error', text: data.error || 'كلمة المرور غير صحيحة.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message || 'خطأ في الاتصال بالخادم.' });
    } finally {
      setLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleLock = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vault/lock', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionNotice({ type: 'info', text: 'تم قفل الخزنة ومسح المفاتيح من ذاكرة الخادم.' });
        setVaultStatus(data.status);
        setTestResult(null);
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: 'فشل قفل الخزنة.' });
    } finally {
      setLoading(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleSaveSecrets = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: any = {
        secrets: {
          ACTIVE_EXCHANGE: activeFormExchange
        }
      };

      if (activeFormExchange === 'BINANCE') {
        if (binanceApiKey) payload.secrets.BINANCE_API_KEY = binanceApiKey.trim();
        if (binanceApiSecret) payload.secrets.BINANCE_API_SECRET = binanceApiSecret.trim();
        payload.secrets.BINANCE_TESTNET = binanceIsTestnet ? 'true' : 'false';
      } else {
        if (bybitApiKey) payload.secrets.BYBIT_API_KEY = bybitApiKey.trim();
        if (bybitApiSecret) payload.secrets.BYBIT_API_SECRET = bybitApiSecret.trim();
        payload.secrets.BYBIT_TESTNET = bybitIsTestnet ? 'true' : 'false';
      }

      if (telegramToken) payload.secrets.TELEGRAM_BOT_TOKEN = telegramToken.trim();
      if (telegramChatId) payload.secrets.TELEGRAM_CHAT_ID = telegramChatId.trim();

      if (!vaultStatus?.isInitialized && !masterPassphrase) {
        setActionNotice({ type: 'error', text: 'يرجى إدخال كلمة المرور الرئيسية في الحقل الأيسر لتهيئة الخزنة وتشفير المفاتيح لأول مرة.' });
        setLoading(false);
        return;
      }

      if (masterPassphrase) {
        payload.passphrase = masterPassphrase;
      }

      const endpoint = vaultStatus?.isInitialized ? '/api/vault/save-secrets' : '/api/vault/initialize';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice({
          type: 'success',
          text: `تم تشفير وحفظ مفاتيح ${activeFormExchange === 'BINANCE' ? 'Binance Futures' : 'Bybit V5'} في الخزنة بنجاح!`
        });
        setVaultStatus(data.status);
        setBinanceApiKey('');
        setBinanceApiSecret('');
        setBybitApiKey('');
        setBybitApiSecret('');
        if (onCredentialsUpdated) onCredentialsUpdated();
      } else {
        setActionNotice({ type: 'error', text: data.error || 'فشل حفظ المفاتيح.' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const handleTestConnection = async (exchangeTarget: 'BINANCE' | 'BYBIT') => {
    try {
      setTestingExchange(exchangeTarget);
      setTestResult(null);
      const res = await fetch('/api/vault/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: exchangeTarget })
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && data.connected) {
        setActionNotice({ type: 'success', text: data.message });
      } else {
        setActionNotice({ type: 'error', text: data.message || `تعذر الاتصال بـ ${exchangeTarget}.` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      setActionNotice({ type: 'error', text: err.message });
    } finally {
      setTestingExchange(null);
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  const isUnlocked = vaultStatus?.isUnlocked ?? false;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Top Banner Notice */}
      {actionNotice && (
        <div className={`px-5 py-3.5 rounded-xl text-xs flex items-center justify-between border shadow-lg animate-fade-in ${
          actionNotice.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
            : actionNotice.type === 'error'
            ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'
        }`}>
          <span>{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Header Hub */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-amber-500/20">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5 space-x-reverse">
                  <h1 className="text-xl font-bold text-white">
                    خزنة الأسرار المشفرة وربط مفاتيح منصات التداول (Exchange API Vault)
                  </h1>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono border font-bold ${
                    isUnlocked
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    {isUnlocked ? 'مفتوحة وجاهزة للتنفيذ' : 'مقفلة ومحمية'}
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1">
                  دعّم كامل للتداول التلقائي الربط المباشر مع أي منصة تداول توفر اتصال API (Binance, Bybit, OKX, KuCoin, وغيرها) بتشفير AES-256-GCM المحمي داخل الخادم بدون طرف ثالث.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleTestConnection('BINANCE')}
              disabled={testingExchange !== null || !isUnlocked}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 space-x-reverse ${
                isUnlocked
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${testingExchange === 'BINANCE' ? 'animate-bounce' : ''}`} />
              <span>{testingExchange === 'BINANCE' ? 'جاري الفحص...' : 'فحص Binance Testnet'}</span>
            </button>

            <button
              onClick={() => handleTestConnection('BYBIT')}
              disabled={testingExchange !== null || !isUnlocked}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5 space-x-reverse ${
                isUnlocked
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${testingExchange === 'BYBIT' ? 'animate-bounce' : ''}`} />
              <span>{testingExchange === 'BYBIT' ? 'جاري الفحص...' : 'فحص Bybit V5'}</span>
            </button>

            {isUnlocked ? (
              <button
                onClick={handleLock}
                disabled={loading}
                className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 space-x-reverse shadow-md"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>قفل الخزنة</span>
              </button>
            ) : null}

            <button
              onClick={fetchVaultStatus}
              title="تحديث الحالة"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Test Connection Output Banner (If Run) */}
      {testResult && (
        <div className={`p-5 rounded-2xl border shadow-xl ${
          testResult.connected
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2 space-x-reverse font-bold text-sm">
              {testResult.connected ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
              <span>
                نتيجة فحص الاتصال الحي مع {testResult.exchange === 'BINANCE' ? 'Binance Futures' : 'Bybit V5'}:
              </span>
            </div>
            <span className="text-xs font-mono">
              {testResult.testnet ? 'Testnet Mode (تجريبي)' : 'Live Production (حقيقي)'}
            </span>
          </div>
          <p className="text-xs leading-relaxed">{testResult.message}</p>
          {testResult.connected && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-emerald-500/20 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">الرصيد الفعلي (USDT):</span>
                <span className="text-white font-bold">${testResult.walletBalance}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">إجمالي القيمة التقديرية:</span>
                <span className="text-emerald-400 font-bold">${testResult.totalEquity}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">نوع الحساب:</span>
                <span className="text-amber-300 font-bold">{testResult.accountType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">حالة المحرك:</span>
                <span className="text-emerald-300 font-bold">جاهز للتداول الآلي</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unlocked Keys Masked Inspection */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Shield className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">
              المفاتيح المحمية حالياً داخل الخزنة (Masked Preview)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {vaultStatus?.storedKeys?.length || 0} مفاتيح مشفرة
          </span>
        </div>

        {isUnlocked ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            {/* Binance Preview */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-amber-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-400 font-bold font-sans">BINANCE_API_KEY</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-sans">
                  {vaultStatus?.maskedPreview?.BINANCE_TESTNET === 'true' ? 'Testnet' : 'Live'}
                </span>
              </div>
              <span className="text-emerald-400 font-bold block">
                {vaultStatus?.maskedPreview?.BINANCE_API_KEY || 'غير معين'}
              </span>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-xl border border-amber-500/30 space-y-1">
              <span className="text-amber-400 font-bold font-sans">BINANCE_API_SECRET</span>
              <span className="text-emerald-400 font-bold block">
                {vaultStatus?.maskedPreview?.BINANCE_API_SECRET || 'غير معين'}
              </span>
            </div>

            {/* Bybit Preview */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 font-bold font-sans">BYBIT_API_KEY</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-sans">
                  {vaultStatus?.maskedPreview?.BYBIT_TESTNET === 'true' ? 'Testnet' : 'Live'}
                </span>
              </div>
              <span className="text-emerald-400 font-bold block">
                {vaultStatus?.maskedPreview?.BYBIT_API_KEY || 'غير معين'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 space-y-3">
            <Lock className="w-8 h-8 text-amber-400/80 mx-auto" />
            <p className="text-sm text-slate-300 font-bold">الخزنة مقفلة حالياً لحماية أموالك ومفاتيحك.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              أدخل كلمة المرور الرئيسية أدناه لفك تشفير مفاتيح Binance Testnet / Bybit وربطها بالمحرك الحي.
            </p>
          </div>
        )}
      </div>

      {/* Unlock / Set Secrets Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unlock Vault Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2 space-x-reverse border-b border-slate-800 pb-3">
            <Unlock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">فك تشفير الخزنة وتحميلها بالذاكرة</h3>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-semibold">
                كلمة المرور الرئيسية للخزنة (Master Passphrase)
              </label>
              <div className="relative">
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={masterPassphrase}
                  onChange={(e) => setMasterPassphrase(e.target.value)}
                  placeholder="أدخل كلمة المرور الرئيسية..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-amber-500 pl-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !masterPassphrase}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center space-x-2 space-x-reverse shadow-lg shadow-amber-500/20"
            >
              <Unlock className="w-4 h-4" />
              <span>{loading ? 'جاري فك التشفير...' : 'فتح الخزنة وتفعيل البوت'}</span>
            </button>
          </form>
        </div>

        {/* Update / Save Encrypted Secrets Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Key className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">إضافة وتشفير مفاتيح جديدة بالخزنة</h3>
            </div>
            {/* Exchange Tabs Selector */}
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveFormExchange('BINANCE')}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeFormExchange === 'BINANCE'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Binance
              </button>
              <button
                type="button"
                onClick={() => setActiveFormExchange('BYBIT')}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeFormExchange === 'BYBIT'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Bybit
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveSecrets} className="space-y-3 text-xs">
            {activeFormExchange === 'BINANCE' ? (
              <>
                <div>
                  <label className="text-amber-300 block mb-1 font-semibold">مفتاح Binance Futures API Key</label>
                  <input
                    type="text"
                    value={binanceApiKey}
                    onChange={(e) => setBinanceApiKey(e.target.value)}
                    placeholder="أدخل مفتاح Binance API Key..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-amber-300 block mb-1 font-semibold">سر Binance Futures API Secret</label>
                  <input
                    type="password"
                    value={binanceApiSecret}
                    onChange={(e) => setBinanceApiSecret(e.target.value)}
                    placeholder="أدخل الـ API Secret..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-amber-300 font-bold block">تفعيل Binance Futures Testnet (تجريبي)</span>
                    <span className="text-[10px] text-slate-400">استخدام https://testnet.binancefuture.com للتجربة الآمنة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={binanceIsTestnet}
                    onChange={(e) => setBinanceIsTestnet(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-cyan-300 block mb-1 font-semibold">مفتاح Bybit V5 API Key</label>
                  <input
                    type="text"
                    value={bybitApiKey}
                    onChange={(e) => setBybitApiKey(e.target.value)}
                    placeholder="أدخل مفتاح Bybit API Key..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-cyan-300 block mb-1 font-semibold">سر Bybit V5 API Secret</label>
                  <input
                    type="password"
                    value={bybitApiSecret}
                    onChange={(e) => setBybitApiSecret(e.target.value)}
                    placeholder="أدخل الـ API Secret..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-cyan-300 font-bold block">تفعيل Bybit Testnet (تجريبي)</span>
                    <span className="text-[10px] text-slate-400">حساب تجريبي لا يمس رصيدك الحقيقي</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={bybitIsTestnet}
                    onChange={(e) => setBybitIsTestnet(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || (activeFormExchange === 'BINANCE' ? (!binanceApiKey && !binanceApiSecret) : (!bybitApiKey && !bybitApiSecret))}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center space-x-2 space-x-reverse shadow-lg shadow-amber-500/20 mt-2"
            >
              <Lock className="w-4 h-4" />
              <span>{loading ? 'جاري التشفير والحفظ...' : `تشفير وحفظ مفاتيح ${activeFormExchange} في الخزنة`}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
