import crypto from 'crypto';
import { precisionManager } from './precisionManager';

/**
 * Fetch helper with timeout to prevent hanging connections
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}

export interface BinanceWalletBalance {
  hasCredentials: boolean;
  totalEquity: number;
  walletBalance: number;
  availableBalance: number;
  unrealisedPnl: number;
  accountType: string;
  asset: string;
}

export interface BinanceLivePosition {
  symbol: string;
  side: 'Buy' | 'Sell' | 'None';
  size: number;
  positionValue: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  unrealisedPnl: number;
  liqPrice: number;
  updateTime: number;
}

export interface BinanceOrderOptions {
  stopPrice?: number;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  reduceOnly?: boolean | 'true' | 'false';
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTX';
}

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;
  private testnet: boolean;
  private baseUrl: string;

  constructor(apiKey?: string, apiSecret?: string, testnet?: boolean) {
    this.apiKey = apiKey || process.env.BINANCE_API_KEY || '';
    this.apiSecret = apiSecret || process.env.BINANCE_API_SECRET || '';
    this.testnet = testnet ?? (process.env.BINANCE_TESTNET !== 'false'); // Default to true (Testnet)
    this.baseUrl = this.testnet
      ? 'https://testnet.binancefuture.com'
      : 'https://fapi.binance.com';
  }

  public hasCredentials(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  public updateCredentials(apiKey: string, apiSecret: string, testnet?: boolean): void {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
    if (testnet !== undefined) {
      this.testnet = testnet;
      this.baseUrl = this.testnet
        ? 'https://testnet.binancefuture.com'
        : 'https://fapi.binance.com';
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isTestnet(): boolean {
    return this.testnet;
  }

  /**
   * جلب مؤشرات الأسعار لجميع أزواج الفيوتشرز مع أسعار العرض والطلب الفعلية ومعدلات التمويل
   */
  public async fetchRealLinearTickers(symbols?: string[]): Promise<Map<string, {
    symbol: string;
    lastPrice: number;
    markPrice: number;
    indexPrice: number;
    prevPrice24h: number;
    price24hPcnt: number;
    highPrice24h: number;
    lowPrice24h: number;
    volume24h: number;
    turnover24h: number;
    fundingRate: number;
    openInterest: number;
    bid1Price: number;
    ask1Price: number;
    spreadPct: number;
  }>> {
    const map = new Map();
    try {
      const [tickerRes, bookRes, premiumRes] = await Promise.allSettled([
        fetchWithTimeout(`${this.baseUrl}/fapi/v1/ticker/24hr`, { headers: { 'Accept': 'application/json' } }),
        fetchWithTimeout(`${this.baseUrl}/fapi/v1/ticker/bookTicker`, { headers: { 'Accept': 'application/json' } }),
        fetchWithTimeout(`${this.baseUrl}/fapi/v1/premiumIndex`, { headers: { 'Accept': 'application/json' } })
      ]);

      const data = tickerRes.status === 'fulfilled' ? await tickerRes.value.json() : [];
      
      const bookMap = new Map<string, { bid: number; ask: number }>();
      if (bookRes.status === 'fulfilled') {
        const bookData = await bookRes.value.json();
        if (Array.isArray(bookData)) {
          for (const b of bookData) {
            bookMap.set(b.symbol, {
              bid: parseFloat(b.bidPrice || '0'),
              ask: parseFloat(b.askPrice || '0')
            });
          }
        }
      }

      const premiumMap = new Map<string, { markPrice: number; indexPrice: number; lastFundingRate: number }>();
      if (premiumRes.status === 'fulfilled') {
        const premData = await premiumRes.value.json();
        if (Array.isArray(premData)) {
          for (const p of premData) {
            premiumMap.set(p.symbol, {
              markPrice: parseFloat(p.markPrice || '0'),
              indexPrice: parseFloat(p.indexPrice || '0'),
              lastFundingRate: parseFloat(p.lastFundingRate || '0.0001')
            });
          }
        }
      }

      if (Array.isArray(data)) {
        const targetSet = symbols && symbols.length > 0 ? new Set(symbols) : null;
        for (const item of data) {
          if (!item.symbol || !item.symbol.endsWith('USDT')) continue;
          if (targetSet && !targetSet.has(item.symbol)) continue;

          const lastPrice = parseFloat(item.lastPrice || '0');
          const prevPrice = parseFloat(item.prevClosePrice || item.openPrice || '0');
          const price24hPcnt = parseFloat(item.priceChangePercent || '0');
          const turnover24h = parseFloat(item.quoteVolume || '0');
          const volume24h = parseFloat(item.volume || '0');
          const highPrice24h = parseFloat(item.highPrice || '0');
          const lowPrice24h = parseFloat(item.lowPrice || '0');

          const book = bookMap.get(item.symbol);
          const bid1 = (book && book.bid > 0) ? book.bid : lastPrice;
          const ask1 = (book && book.ask > 0) ? book.ask : lastPrice;

          const prem = premiumMap.get(item.symbol);
          const markPrice = (prem && prem.markPrice > 0) ? prem.markPrice : lastPrice;
          const indexPrice = (prem && prem.indexPrice > 0) ? prem.indexPrice : lastPrice;
          const fundingRate = prem ? prem.lastFundingRate : 0.0001;

          const spreadPct = (ask1 > 0 && bid1 > 0 && ask1 >= bid1 && lastPrice > 0) 
            ? (ask1 - bid1) / lastPrice 
            : 0.00015;

          map.set(item.symbol, {
            symbol: item.symbol,
            lastPrice,
            markPrice,
            indexPrice,
            prevPrice24h: prevPrice,
            price24hPcnt,
            highPrice24h,
            lowPrice24h,
            volume24h,
            turnover24h,
            fundingRate,
            openInterest: turnover24h * 0.15,
            bid1Price: bid1,
            ask1Price: ask1,
            spreadPct
          });
        }
      }
    } catch (err) {
      console.error('[BinanceClient] Error fetching linear tickers:', err);
    }
    return map;
  }

  private signParams(params: Record<string, any>): string {
    const timestamp = Date.now();
    const queryObj = { ...params, timestamp, recvWindow: 5000 };
    const queryString = Object.keys(queryObj)
      .map(key => `${key}=${encodeURIComponent(queryObj[key])}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');

    return `${queryString}&signature=${signature}`;
  }

  /**
   * جلب رصيد الحساب الفعلي المباشر لـ Binance Futures (Testnet or Mainnet)
   */
  public async getRealWalletBalance(): Promise<BinanceWalletBalance> {
    if (!this.hasCredentials()) {
      return {
        hasCredentials: false,
        totalEquity: 0,
        walletBalance: 0,
        availableBalance: 0,
        unrealisedPnl: 0,
        accountType: 'BINANCE_FUTURES',
        asset: 'USDT'
      };
    }

    try {
      const queryString = this.signParams({});
      const url = `${this.baseUrl}/fapi/v2/account?${queryString}`;
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      if (data && data.totalWalletBalance !== undefined) {
        const totalWalletBalance = parseFloat(data.totalWalletBalance || '0');
        const totalMarginBalance = parseFloat(data.totalMarginBalance || '0');
        const totalUnrealizedProfit = parseFloat(data.totalUnrealizedProfit || '0');
        const availableBalance = parseFloat(data.availableBalance || '0');

        return {
          hasCredentials: true,
          totalEquity: totalMarginBalance,
          walletBalance: totalWalletBalance,
          availableBalance: availableBalance,
          unrealisedPnl: totalUnrealizedProfit,
          accountType: this.testnet ? 'BINANCE_TESTNET_FUTURES' : 'BINANCE_LIVE_FUTURES',
          asset: 'USDT'
        };
      }

      console.warn('[BinanceClient] Account response warning:', data);
      return {
        hasCredentials: true,
        totalEquity: 0,
        walletBalance: 0,
        availableBalance: 0,
        unrealisedPnl: 0,
        accountType: data.msg || 'ERROR',
        asset: 'USDT'
      };
    } catch (err: any) {
      console.error('[BinanceClient] Error fetching balance:', err.message);
      return {
        hasCredentials: true,
        totalEquity: 0,
        walletBalance: 0,
        availableBalance: 0,
        unrealisedPnl: 0,
        accountType: 'CONNECTION_ERROR',
        asset: 'USDT'
      };
    }
  }

  /**
   * جلب الشموع المباشرة الحقيقية لـ Binance Futures
   */
  public async fetchRealKlines(symbol: string = 'BTCUSDT', interval: string = '1m', limit: number = 50): Promise<Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }>> {
    try {
      const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const url = `${this.baseUrl}/fapi/v1/klines?symbol=${cleanSym}&interval=${interval}&limit=${limit}`;
      const res = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();

      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          timestamp: parseInt(item[0]),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: parseFloat(item[5])
        }));
      }
      return [];
    } catch (err: any) {
      console.error('[BinanceClient] Error fetching klines:', err.message);
      return [];
    }
  }

  /**
   * جلب الصفقات المفتوحة لـ Binance Futures Risk Position
   */
  public async fetchLivePositions(): Promise<BinanceLivePosition[]> {
    if (!this.hasCredentials()) return [];

    try {
      const queryString = this.signParams({});
      const url = `${this.baseUrl}/fapi/v2/positionRisk?${queryString}`;
      const res = await fetchWithTimeout(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      if (Array.isArray(data)) {
        return data
          .filter((pos: any) => Math.abs(parseFloat(pos.positionAmt || '0')) > 0)
          .map((pos: any) => {
            const amt = parseFloat(pos.positionAmt);
            return {
              symbol: pos.symbol,
              side: amt > 0 ? 'Buy' : 'Sell',
              size: Math.abs(amt),
              positionValue: Math.abs(amt) * parseFloat(pos.markPrice || '0'),
              entryPrice: parseFloat(pos.entryPrice || '0'),
              markPrice: parseFloat(pos.markPrice || '0'),
              leverage: parseFloat(pos.leverage || '1'),
              unrealisedPnl: parseFloat(pos.unRealizedProfit || '0'),
              liqPrice: parseFloat(pos.liquidationPrice || '0'),
              updateTime: parseInt(pos.updateTime || '0')
            };
          });
      }
      return [];
    } catch (err) {
      console.error('[BinanceClient] Error fetching positions:', err);
      return [];
    }
  }

  /**
   * تنفيذ أمر تداول مباشر في Binance Futures (Testnet or Live)
   * يدعم الأوامر الشرطية الحقيقية (STOP_MARKET / STOP) وحماية reduceOnly
   */
  public async executeOrder(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP' | 'TAKE_PROFIT_MARKET' | 'TAKE_PROFIT', 
    quantity: number, 
    price?: number,
    options: BinanceOrderOptions = {}
  ): Promise<{ success: boolean; orderId?: string; message?: string; raw?: any }> {
    if (!this.hasCredentials()) {
      return { success: false, message: 'مفاتيح Binance غير معرفة في الخزنة.' };
    }

    try {
      const cleanSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const refPrice = price || options.stopPrice || 1.0;
      
      // 1. Precision Validation and Quantization
      const validation = precisionManager.validateOrder(cleanSymbol, quantity, refPrice);
      if (!validation.isValid) {
        console.warn(`[BinanceClient] ⛔ Order rejected locally by PrecisionManager: ${validation.reason}`);
        return {
          success: false,
          message: `رفض الأمر بسبب قيود الدقة: ${validation.reason}`,
          raw: { reason: validation.reason, cleanSymbol, quantity, refPrice }
        };
      }

      const params: Record<string, any> = {
        symbol: cleanSymbol,
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: validation.qtyString
      };

      if ((type === 'LIMIT' || type === 'STOP' || type === 'TAKE_PROFIT') && price) {
        params.price = validation.priceString;
        params.timeInForce = options.timeInForce || 'GTC';
      }

      // Conditional Stop / Take Profit Orders
      if (options.stopPrice) {
        params.stopPrice = precisionManager.roundPrice(cleanSymbol, options.stopPrice).toString();
        params.workingType = options.workingType || 'MARK_PRICE';
      }

      // Explicit reduceOnly protection
      if (options.reduceOnly === true || options.reduceOnly === 'true') {
        params.reduceOnly = 'true';
      }

      const queryString = this.signParams(params);
      const url = `${this.baseUrl}/fapi/v1/order?${queryString}`;

      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const data = await res.json();
      if (data && data.orderId) {
        return {
          success: true,
          orderId: String(data.orderId),
          message: `تم تنفيذ أمر ${type} ${side} على ${cleanSymbol} بنجاح! (الكمية: ${validation.qtyString}${options.reduceOnly ? ' | ReduceOnly' : ''})`,
          raw: data
        };
      }

      return {
        success: false,
        message: data.msg || 'فشل تنفيذ الأمر في Binance Futures.',
        raw: data
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'خطأ في شبكة Binance.'
      };
    }
  }
}
