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

export interface BybitTickerData {
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
}

export interface BybitWalletBalance {
  hasCredentials: boolean;
  totalEquity: number;
  walletBalance: number;
  availableBalance: number;
  unrealisedPnl: number;
  accountType: string;
  coin: string;
}

export interface BybitLivePosition {
  symbol: string;
  side: 'Buy' | 'Sell' | 'None';
  size: number;
  positionValue: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  unrealisedPnl: number;
  liqPrice: number;
  takeProfit: number;
  stopLoss: number;
  createdTime: number;
  updatedTime: number;
}

export interface BybitOrderParams {
  symbol: string;
  side: 'Buy' | 'Sell';
  orderType: 'Limit' | 'Market';
  qty: string;
  price?: string;
  orderLinkId?: string;
  positionIdx?: number;
  reduceOnly?: boolean;
  triggerPrice?: string;
  triggerDirection?: 1 | 2; // 1 = Rise to trigger, 2 = Fall to trigger
  triggerBy?: 'MarkPrice' | 'IndexPrice' | 'LastPrice';
  orderFilter?: 'Order' | 'StopOrder' | 'tpslOrder';
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'PostOnly';
}

export class BybitClient {
  private apiKey: string;
  private apiSecret: string;
  private testnet: boolean;
  private baseUrl: string;

  constructor(apiKey?: string, apiSecret?: string, testnet?: boolean) {
    this.apiKey = apiKey || process.env.BYBIT_API_KEY || '';
    this.apiSecret = apiSecret || process.env.BYBIT_API_SECRET || '';
    this.testnet = testnet ?? (process.env.BYBIT_TESTNET === 'true');
    this.baseUrl = this.testnet
      ? 'https://api-testnet.bybit.com'
      : 'https://api.bybit.com';
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
        ? 'https://api-testnet.bybit.com'
        : 'https://api.bybit.com';
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isTestnet(): boolean {
    return this.testnet;
  }

  /**
   * جلب بيانات السوق الحية العامة لجميع عقود Bybit USDT Perpetual
   * لا تحتاج مفاتيح API وتجلب أسعاراً حقيقية 100% مباشرة من المنصة
   */
  public async fetchRealLinearTickers(symbols?: string[]): Promise<Map<string, BybitTickerData>> {
    const map = new Map<string, BybitTickerData>();
    try {
      let url = `${this.baseUrl}/v5/market/tickers?category=linear`;
      if (symbols && symbols.length === 1) {
        url += `&symbol=${symbols[0]}`;
      }

      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();

      if (data.retCode === 0 && data.result && Array.isArray(data.result.list)) {
        const targetSet = symbols && symbols.length > 1 ? new Set(symbols) : null;

        for (const item of data.result.list) {
          if (targetSet && !targetSet.has(item.symbol)) continue;

          const lastPrice = parseFloat(item.lastPrice) || 0;
          const bid1 = parseFloat(item.bid1Price) || lastPrice;
          const ask1 = parseFloat(item.ask1Price) || lastPrice;
          const spreadPct = lastPrice > 0 ? (ask1 - bid1) / lastPrice : 0.00015;

          map.set(item.symbol, {
            symbol: item.symbol,
            lastPrice,
            markPrice: parseFloat(item.markPrice) || lastPrice,
            indexPrice: parseFloat(item.indexPrice) || lastPrice,
            prevPrice24h: parseFloat(item.prevPrice24h) || lastPrice,
            price24hPcnt: parseFloat(item.price24hPcnt) * 100 || 0,
            highPrice24h: parseFloat(item.highPrice24h) || lastPrice,
            lowPrice24h: parseFloat(item.lowPrice24h) || lastPrice,
            volume24h: parseFloat(item.volume24h) || 0,
            turnover24h: parseFloat(item.turnover24h) || 0,
            fundingRate: parseFloat(item.fundingRate) || 0,
            openInterest: parseFloat(item.openInterest) || 0,
            bid1Price: bid1,
            ask1Price: ask1,
            spreadPct
          });
        }
      }
    } catch (err) {
      console.error('[BybitClient] Error fetching linear tickers:', err);
    }
    return map;
  }

  /**
   * جلب شموع الأسعار الحقيقية من Bybit V5 لحساب Kalman Filter و Z-Score الفعلي
   */
  public async fetchRealKlines(symbol: string, interval = '1', limit = 50): Promise<Array<{ timestamp: number; close: number }>> {
    try {
      const url = `${this.baseUrl}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      if (data.retCode === 0 && data.result && Array.isArray(data.result.list)) {
        // Bybit returns newest first, so we reverse it
        return data.result.list.map((k: string[]) => ({
          timestamp: parseInt(k[0]),
          close: parseFloat(k[4])
        })).reverse();
      }
    } catch (err) {
      console.error(`[BybitClient] Error fetching klines for ${symbol}:`, err);
    }
    return [];
  }

  /**
   * توقيع الطلبات بـ HMAC-SHA256 وفقاً لمتطلبات Bybit V5
   */
  private generateSignature(timestamp: number, recvWindow: number, queryStringOrBody: string): string {
    const raw = `${timestamp}${this.apiKey}${recvWindow}${queryStringOrBody}`;
    return crypto.createHmac('sha256', this.apiSecret).update(raw).digest('hex');
  }

  /**
   * جلب رصيد المحفظة الفعلي من Bybit V5 (Unified Account)
   * إذا لم تكن المفاتيح مضبوطة، يعيد 0.00 دون أي أرقام مصطنعة
   */
  public async getRealWalletBalance(): Promise<BybitWalletBalance> {
    if (!this.hasCredentials()) {
      return {
        hasCredentials: false,
        totalEquity: 0.0,
        walletBalance: 0.0,
        availableBalance: 0.0,
        unrealisedPnl: 0.0,
        accountType: 'UNCONFIGURED',
        coin: 'USDT'
      };
    }

    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const query = 'accountType=UNIFIED';
      const signature = this.generateSignature(timestamp, recvWindow, query);

      const res = await fetch(`${this.baseUrl}/v5/account/wallet-balance?${query}`, {
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      if (data.retCode === 0 && data.result && Array.isArray(data.result.list) && data.result.list.length > 0) {
        const acc = data.result.list[0];
        const totalEquity = parseFloat(acc.totalEquity) || 0;
        const totalWalletBalance = parseFloat(acc.totalWalletBalance) || 0;
        const totalAvailableBalance = parseFloat(acc.totalAvailableBalance) || 0;
        const totalPerpUPL = parseFloat(acc.totalPerpUPL) || 0;

        return {
          hasCredentials: true,
          totalEquity: parseFloat(totalEquity.toFixed(2)),
          walletBalance: parseFloat(totalWalletBalance.toFixed(2)),
          availableBalance: parseFloat(totalAvailableBalance.toFixed(2)),
          unrealisedPnl: parseFloat(totalPerpUPL.toFixed(2)),
          accountType: acc.accountType || 'UNIFIED',
          coin: 'USDT'
        };
      } else {
        console.warn('[BybitClient] Wallet balance query returned non-zero code:', data.retCode, data.retMsg);
        return {
          hasCredentials: true,
          totalEquity: 0.0,
          walletBalance: 0.0,
          availableBalance: 0.0,
          unrealisedPnl: 0.0,
          accountType: 'ERROR',
          coin: 'USDT'
        };
      }
    } catch (err) {
      console.error('[BybitClient] Failed to fetch real wallet balance:', err);
      return {
        hasCredentials: true,
        totalEquity: 0.0,
        walletBalance: 0.0,
        availableBalance: 0.0,
        unrealisedPnl: 0.0,
        accountType: 'NETWORK_ERROR',
        coin: 'USDT'
      };
    }
  }

  /**
   * جلب الصفقات المفتوحة الفعلية على المنصة من Bybit V5
   */
  public async getRealPositions(): Promise<BybitLivePosition[]> {
    if (!this.hasCredentials()) {
      return [];
    }

    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const query = 'category=linear&settleCoin=USDT';
      const signature = this.generateSignature(timestamp, recvWindow, query);

      const res = await fetch(`${this.baseUrl}/v5/position/list?${query}`, {
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      if (data.retCode === 0 && data.result && Array.isArray(data.result.list)) {
        const positions: BybitLivePosition[] = [];
        for (const item of data.result.list) {
          const size = parseFloat(item.size) || 0;
          if (size <= 0) continue; // Only active non-zero positions

          positions.push({
            symbol: item.symbol,
            side: item.side as 'Buy' | 'Sell',
            size,
            positionValue: parseFloat(item.positionValue) || 0,
            entryPrice: parseFloat(item.avgPrice) || 0,
            markPrice: parseFloat(item.markPrice) || 0,
            leverage: parseFloat(item.leverage) || 1,
            unrealisedPnl: parseFloat(item.unrealisedPnl) || 0,
            liqPrice: parseFloat(item.liqPrice) || 0,
            takeProfit: parseFloat(item.takeProfit) || 0,
            stopLoss: parseFloat(item.stopLoss) || 0,
            createdTime: parseInt(item.createdTime) || Date.now(),
            updatedTime: parseInt(item.updatedTime) || Date.now()
          });
        }
        return positions;
      }
    } catch (err) {
      console.error('[BybitClient] Error fetching real positions:', err);
    }
    return [];
  }

  /**
   * إرسال أمر تداول حقيقي إلى Bybit V5 مع التحقق ومعايرة الدقة ودعم reduceOnly والأوامر الشرطية Stop Orders
   */
  public async placeRealOrder(params: BybitOrderParams): Promise<{ success: boolean; orderId?: string; orderLinkId?: string; error?: string }> {
    if (!this.hasCredentials()) {
      return {
        success: false,
        error: 'مفاتيح Bybit API غير مضبوطة في متغيرات الخادم (BYBIT_API_KEY & BYBIT_API_SECRET).'
      };
    }

    try {
      const cleanSymbol = params.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const rawQty = parseFloat(params.qty) || 0;
      const rawPrice = params.price ? parseFloat(params.price) : (params.triggerPrice ? parseFloat(params.triggerPrice) : 1.0);

      // 1. Precision Validation and Quantization
      const validation = precisionManager.validateOrder(cleanSymbol, rawQty, rawPrice);
      if (!validation.isValid) {
        console.warn(`[BybitClient] ⛔ Order rejected locally by PrecisionManager: ${validation.reason}`);
        return {
          success: false,
          error: `رفض الأمر بسبب قيود الدقة: ${validation.reason}`
        };
      }

      const timestamp = Date.now();
      const recvWindow = 5000;
      const payload: Record<string, any> = {
        category: 'linear',
        symbol: cleanSymbol,
        side: params.side,
        orderType: params.orderType,
        qty: validation.qtyString,
        positionIdx: params.positionIdx ?? 0
      };

      if (params.orderType === 'Limit' && params.price) {
        payload.price = validation.priceString;
        payload.timeInForce = params.timeInForce || 'GTC';
      }

      if (params.orderLinkId) {
        payload.orderLinkId = params.orderLinkId;
      }

      // Explicit reduceOnly protection
      if (params.reduceOnly === true) {
        payload.reduceOnly = true;
      }

      // Conditional Stop / Trigger Orders
      if (params.triggerPrice) {
        payload.triggerPrice = precisionManager.roundPrice(cleanSymbol, parseFloat(params.triggerPrice)).toString();
        payload.triggerDirection = params.triggerDirection ?? (params.side === 'Buy' ? 1 : 2);
        payload.triggerBy = params.triggerBy || 'MarkPrice';
        payload.orderFilter = params.orderFilter || 'StopOrder';
      }

      const body = JSON.stringify(payload);
      const signature = this.generateSignature(timestamp, recvWindow, body);

      const res = await fetchWithTimeout(`${this.baseUrl}/v5/order/create`, {
        method: 'POST',
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body
      });

      const data = await res.json();
      if (data.retCode === 0 && data.result) {
        return {
          success: true,
          orderId: data.result.orderId,
          orderLinkId: data.result.orderLinkId
        };
      } else {
        return {
          success: false,
          error: `رفضت Bybit الأمر (كود ${data.retCode}): ${data.retMsg}`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `فشل الاتصال بمنصة Bybit: ${err.message}`
      };
    }
  }

  /**
   * إلغاء أمر حقيقي على Bybit V5
   */
  public async cancelRealOrder(symbol: string, orderId?: string, orderLinkId?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.hasCredentials()) {
      return { success: false, error: 'مفاتيح Bybit غير مضبوطة.' };
    }

    try {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const payload: Record<string, any> = {
        category: 'linear',
        symbol
      };
      if (orderId) payload.orderId = orderId;
      if (orderLinkId) payload.orderLinkId = orderLinkId;

      const body = JSON.stringify(payload);
      const signature = this.generateSignature(timestamp, recvWindow, body);

      const res = await fetch(`${this.baseUrl}/v5/order/cancel`, {
        method: 'POST',
        headers: {
          'X-BAPI-API-KEY': this.apiKey,
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-SIGN': signature,
          'X-BAPI-RECV-WINDOW': recvWindow.toString(),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body
      });

      const data = await res.json();
      return {
        success: data.retCode === 0,
        error: data.retCode === 0 ? undefined : data.retMsg
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
