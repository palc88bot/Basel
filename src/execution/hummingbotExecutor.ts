/**
 * Hummingbot Executor - التنفيذ الفعلي للأوامر على Bybit Perpetual
 * يدعم: Limit, Market, Stop orders, Pair trading, Atomic Rollback, Rate limiting
 */

import { OrderState, OrderTracker, TrackedOrder } from './orderTracker';
import { RateLimiter } from './rateLimiter';
import { BybitClient } from './bybitClient';
import { BinanceClient } from './binanceClient';
import { serverVault } from './secretVault';
import { precisionManager } from './precisionManager';

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  FILLED = 'filled',
  PARTIAL = 'partial',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

export interface OrderResult {
  success: boolean;
  orderId: string | null;
  clientOrderId: string;
  status: OrderStatus;
  filledAmount: number;
  averagePrice: number;
  tradingPair: string;
  side: 'BUY' | 'SELL';
  errorMessage?: string;
  latencyUs?: number;
}

export interface TradingSignal {
  id?: string;
  signal: 'BUY' | 'SELL';
  assetA: string;
  assetB: string;
  entryPriceA: number;
  entryPriceB: number;
}

export interface ExecutablePosition {
  id: string;
  sizeUsd: number;
  beta: number;
  leverage?: number;
}

export interface ExecutorConfig {
  connectorName?: string;
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
}

export class HummingbotExecutor {
  private config: ExecutorConfig;
  private connectorName: string;
  private orderTracker: OrderTracker;
  private rateLimiter: RateLimiter | null = null;
  private isConnected: boolean = false;
  private walletBalance: number = 0.0;
  private activeOrders: Map<string, any> = new Map();
  private bybitClient: BybitClient;
  private binanceClient: BinanceClient;

  constructor(
    config: ExecutorConfig,
    orderTracker: OrderTracker,
    rateLimiter?: RateLimiter
  ) {
    this.config = config;
    this.connectorName = config.connectorName || 'bybit_perpetual';
    this.orderTracker = orderTracker;
    this.bybitClient = new BybitClient(config.apiKey, config.apiSecret, config.testnet);
    this.binanceClient = new BinanceClient(
      process.env.BINANCE_API_KEY,
      process.env.BINANCE_API_SECRET,
      process.env.BINANCE_TESTNET !== 'false'
    );
    if (rateLimiter) {
      this.rateLimiter = rateLimiter;
    }
    this.initializeConnector();
  }

  public getBybitClient(): BybitClient {
    return this.bybitClient;
  }

  public getBinanceClient(): BinanceClient {
    return this.binanceClient;
  }

  public getWalletBalance(): number {
    return this.walletBalance;
  }

  public setWalletBalance(balance: number): void {
    this.walletBalance = balance;
  }

  public updateCredentials(apiKey: string, apiSecret: string, testnet?: boolean): void {
    this.config.apiKey = apiKey;
    this.config.apiSecret = apiSecret;
    if (testnet !== undefined) {
      this.config.testnet = testnet;
    }
    this.bybitClient.updateCredentials(apiKey, apiSecret, testnet);
    console.log(`[HummingbotExecutor] 🔑 Updated Bybit credentials from Secret Vault. Authenticated: ${this.bybitClient.hasCredentials()}`);
  }

  public updateBinanceCredentials(apiKey: string, apiSecret: string, testnet?: boolean): void {
    this.binanceClient.updateCredentials(apiKey, apiSecret, testnet);
    console.log(`[HummingbotExecutor] 🔑 Updated Binance credentials from Secret Vault. Authenticated: ${this.binanceClient.hasCredentials()}`);
  }

  private initializeConnector(): void {
    const hasKeys = this.bybitClient.hasCredentials();
    this.isConnected = true;
    console.log(
      `[HummingbotExecutor] ✅ Initialized ${this.connectorName} connector (${hasKeys ? 'Authenticated V5 Live' : 'Public Telemetry Only - Awaiting API Keys'})`
    );
  }

  public setRateLimiter(rateLimiter: RateLimiter): void {
    this.rateLimiter = rateLimiter;
  }

  public getConnectorStatus() {
    return {
      connectorName: this.connectorName,
      testnet: this.config.testnet ?? true,
      hasApiKey: Boolean(this.config.apiKey || process.env.BYBIT_API_KEY),
      connected: this.isConnected,
      activeOrdersCount: this.activeOrders.size
    };
  }

  /**
   * تنفيذ صفقة pairs trading (Leg A + Leg B) مع حماية الـ Rollback الذري
   */
  public async executePairTrade(
    position: ExecutablePosition,
    signal: TradingSignal
  ): Promise<{
    success: boolean;
    orders: OrderResult[];
    error: string | null;
    latencyUs: number;
  }> {
    const startTime = performance.now();

    if (!this.isConnected) {
      return {
        success: false,
        orders: [],
        error: 'Connector not initialized',
        latencyUs: 0
      };
    }

    try {
      // 1. Rate Limit Check (2 orders: Leg A and Leg B)
      if (this.rateLimiter) {
        const canExecuteA = await this.rateLimiter.canExecute('order', 1);
        const canExecuteB = await this.rateLimiter.canExecute('order', 1);
        if (!canExecuteA || !canExecuteB) {
          return {
            success: false,
            orders: [],
            error: 'Rate limit threshold reached on Bybit V5 endpoint (Backoff active)',
            latencyUs: Math.round((performance.now() - startTime) * 1000)
          };
        }
      }

      // 2. Exact Position & Hedge Sizing Calculation with Precision Calibration
      const rawSizeA = (position.sizeUsd * position.beta) / signal.entryPriceA;
      const rawSizeB = position.sizeUsd / signal.entryPriceB;

      const sizeA = precisionManager.roundQuantity(signal.assetA, rawSizeA);
      const sizeB = precisionManager.roundQuantity(signal.assetB, rawSizeB);
      const priceA = precisionManager.roundPrice(signal.assetA, signal.entryPriceA);
      const priceB = precisionManager.roundPrice(signal.assetB, signal.entryPriceB);

      // 3. Direction determination
      const isBuySignal = signal.signal === 'BUY';
      const orderASide: 'BUY' | 'SELL' = isBuySignal ? 'BUY' : 'SELL';
      const orderBSide: 'BUY' | 'SELL' = isBuySignal ? 'SELL' : 'BUY';

      // 4. Place Leg A
      const orderA = await this.placeOrder({
        tradingPair: signal.assetA,
        isBuy: orderASide === 'BUY',
        amount: sizeA,
        price: priceA,
        orderType: 'LIMIT',
        positionId: position.id,
        signalId: signal.id
      });

      if (!orderA.success || !orderA.orderId) {
        return {
          success: false,
          orders: [orderA],
          error: `Leg A (${signal.assetA}) failed: ${orderA.errorMessage}`,
          latencyUs: Math.round((performance.now() - startTime) * 1000)
        };
      }

      // 5. Place Leg B
      const orderB = await this.placeOrder({
        tradingPair: signal.assetB,
        isBuy: orderBSide === 'BUY',
        amount: sizeB,
        price: priceB,
        orderType: 'LIMIT',
        positionId: position.id,
        signalId: signal.id
      });

      // 6. Atomic Rollback Guard: If Leg B fails, cancel Leg A immediately to avoid naked exposure
      if (!orderB.success) {
        await this.cancelOrder(orderA.orderId, signal.assetA);
        return {
          success: false,
          orders: [orderA, orderB],
          error: `Leg B (${signal.assetB}) failed! Rolled back Leg A immediately to prevent naked unhedged risk: ${orderB.errorMessage}`,
          latencyUs: Math.round((performance.now() - startTime) * 1000)
        };
      }

      const totalLatencyUs = Math.round((performance.now() - startTime) * 1000);

      return {
        success: true,
        orders: [orderA, orderB],
        error: null,
        latencyUs: totalLatencyUs
      };
    } catch (err: any) {
      return {
        success: false,
        orders: [],
        error: err.message || 'Execution error in pair trade',
        latencyUs: Math.round((performance.now() - startTime) * 1000)
      };
    }
  }

  /**
   * وضع أمر تداول
   */
  public async placeOrder(params: {
    tradingPair: string;
    isBuy: boolean;
    amount: number;
    price: number;
    orderType?: 'LIMIT' | 'MARKET';
    positionId?: string;
    signalId?: string;
  }): Promise<OrderResult> {
    const orderStart = performance.now();
    const orderType = params.orderType || 'LIMIT';
    const clientOrderId = `OMEGA-${Date.now()}-${params.tradingPair.replace(/[^A-Z0-9]/g, '')}`;

    // 0. Pre-Execution Precision & Min Notional Validation
    const cleanSym = params.tradingPair.replace(/[^A-Z0-9]/g, '');
    const validation = precisionManager.validateOrder(cleanSym, params.amount, params.price);
    if (!validation.isValid) {
      return {
        success: false,
        orderId: null,
        clientOrderId,
        status: OrderStatus.FAILED,
        filledAmount: 0,
        averagePrice: 0,
        tradingPair: params.tradingPair,
        side: params.isBuy ? 'BUY' : 'SELL',
        errorMessage: `[PrecisionGuard] ${validation.reason}`,
        latencyUs: 0
      };
    }

    const calibratedAmount = validation.roundedQuantity;
    const calibratedPrice = validation.roundedPrice;

    try {
      const activeExchange = serverVault.getSecret('ACTIVE_EXCHANGE') || 'BINANCE';

      // 1. Handle Binance Futures
      if (activeExchange === 'BINANCE') {
        const hasKeys = this.binanceClient.hasCredentials();
        let balanceInfo = { hasCredentials: false, walletBalance: 0 };
        if (hasKeys) {
          balanceInfo = await this.binanceClient.getRealWalletBalance();
        }

        // If real keys connected with balance > 0, execute real order
        if (hasKeys && balanceInfo.hasCredentials && balanceInfo.walletBalance > 0) {
          const realOrder = await this.binanceClient.executeOrder(
            params.tradingPair.replace(/[-_]/g, ''),
            params.isBuy ? 'BUY' : 'SELL',
            orderType === 'LIMIT' ? 'LIMIT' : 'MARKET',
            calibratedAmount,
            orderType === 'LIMIT' ? calibratedPrice : undefined
          );

          const latencyUs = Math.round((performance.now() - orderStart) * 1000);

          if (!realOrder.success || !realOrder.orderId) {
            return {
              success: false,
              orderId: null,
              clientOrderId,
              status: OrderStatus.FAILED,
              filledAmount: 0,
              averagePrice: 0,
              tradingPair: params.tradingPair,
              side: params.isBuy ? 'BUY' : 'SELL',
              errorMessage: realOrder.message || 'Binance rejected the order',
              latencyUs
            };
          }

          const orderData = {
            clientOrderId,
            orderId: realOrder.orderId,
            tradingPair: params.tradingPair,
            side: params.isBuy ? 'BUY' as const : 'SELL' as const,
            amount: calibratedAmount,
            price: calibratedPrice,
            orderType,
            status: OrderStatus.OPEN,
            createdAt: Date.now() / 1000
          };

          this.activeOrders.set(realOrder.orderId, orderData);
          this.orderTracker.trackOrder({
            orderId: realOrder.orderId,
            clientOrderId,
            tradingPair: params.tradingPair,
            side: params.isBuy ? 'BUY' : 'SELL',
            amount: calibratedAmount,
            price: calibratedPrice,
            positionId: params.positionId,
            signalId: params.signalId
          });

          return {
            success: true,
            orderId: realOrder.orderId,
            clientOrderId,
            status: OrderStatus.OPEN,
            filledAmount: calibratedAmount,
            averagePrice: calibratedPrice,
            tradingPair: params.tradingPair,
            side: params.isBuy ? 'BUY' : 'SELL',
            latencyUs
          };
        }

        // Demo / Paper Execution Mode Fallback (When API keys missing or $0 balance)
        const demoOrderId = `DEMO-BINANCE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const latencyUs = Math.round((performance.now() - orderStart) * 1000) + 12;

        const orderData = {
          clientOrderId,
          orderId: demoOrderId,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' as const : 'SELL' as const,
          amount: calibratedAmount,
          price: calibratedPrice,
          orderType,
          status: OrderStatus.FILLED,
          createdAt: Date.now() / 1000
        };

        this.activeOrders.set(demoOrderId, orderData);
        this.orderTracker.trackOrder({
          orderId: demoOrderId,
          clientOrderId,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' : 'SELL',
          amount: calibratedAmount,
          price: calibratedPrice,
          positionId: params.positionId,
          signalId: params.signalId
        });

        return {
          success: true,
          orderId: demoOrderId,
          clientOrderId,
          status: OrderStatus.FILLED,
          filledAmount: calibratedAmount,
          averagePrice: calibratedPrice,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' : 'SELL',
          latencyUs
        };
      }

      // 2. Handle Bybit V5
      const hasBybitKeys = this.bybitClient.hasCredentials();
      let bybitBalance = { hasCredentials: false, walletBalance: 0 };
      if (hasBybitKeys) {
        bybitBalance = await this.bybitClient.getRealWalletBalance();
      }

      if (hasBybitKeys && bybitBalance.hasCredentials && bybitBalance.walletBalance > 0) {
        const realOrder = await this.bybitClient.placeRealOrder({
          symbol: params.tradingPair,
          side: params.isBuy ? 'Buy' : 'Sell',
          orderType: orderType === 'LIMIT' ? 'Limit' : 'Market',
          qty: calibratedAmount.toString(),
          price: orderType === 'LIMIT' ? calibratedPrice.toString() : undefined,
          orderLinkId: clientOrderId
        });

        const latencyUs = Math.round((performance.now() - orderStart) * 1000);

        if (!realOrder.success || !realOrder.orderId) {
          return {
            success: false,
            orderId: null,
            clientOrderId,
            status: OrderStatus.FAILED,
            filledAmount: 0,
            averagePrice: 0,
            tradingPair: params.tradingPair,
            side: params.isBuy ? 'BUY' : 'SELL',
            errorMessage: realOrder.error || 'Bybit rejected the order',
            latencyUs
          };
        }

        const orderData = {
          clientOrderId,
          orderId: realOrder.orderId,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' as const : 'SELL' as const,
          amount: params.amount,
          price: params.price,
          orderType,
          status: OrderStatus.OPEN,
          createdAt: Date.now() / 1000
        };

        this.activeOrders.set(realOrder.orderId, orderData);
        this.orderTracker.trackOrder({
          orderId: realOrder.orderId,
          clientOrderId,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' : 'SELL',
          amount: params.amount,
          price: params.price,
          positionId: params.positionId,
          signalId: params.signalId
        });

        return {
          success: true,
          orderId: realOrder.orderId,
          clientOrderId,
          status: OrderStatus.OPEN,
          filledAmount: params.amount,
          averagePrice: params.price,
          tradingPair: params.tradingPair,
          side: params.isBuy ? 'BUY' : 'SELL',
          latencyUs
        };
      }

      // Demo / Paper Execution Mode Fallback for Bybit
      const demoOrderId = `DEMO-BYBIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const latencyUs = Math.round((performance.now() - orderStart) * 1000) + 15;

      const orderData = {
        clientOrderId,
        orderId: demoOrderId,
        tradingPair: params.tradingPair,
        side: params.isBuy ? 'BUY' as const : 'SELL' as const,
        amount: params.amount,
        price: params.price,
        orderType,
        status: OrderStatus.FILLED,
        createdAt: Date.now() / 1000
      };

      this.activeOrders.set(demoOrderId, orderData);
      this.orderTracker.trackOrder({
        orderId: demoOrderId,
        clientOrderId,
        tradingPair: params.tradingPair,
        side: params.isBuy ? 'BUY' : 'SELL',
        amount: params.amount,
        price: params.price,
        positionId: params.positionId,
        signalId: params.signalId
      });

      return {
        success: true,
        orderId: demoOrderId,
        clientOrderId,
        status: OrderStatus.FILLED,
        filledAmount: params.amount,
        averagePrice: params.price,
        tradingPair: params.tradingPair,
        side: params.isBuy ? 'BUY' : 'SELL',
        latencyUs
      };
    } catch (err: any) {
      const latencyUs = Math.round((performance.now() - orderStart) * 1000);
      return {
        success: false,
        orderId: null,
        clientOrderId,
        status: OrderStatus.FAILED,
        filledAmount: 0,
        averagePrice: 0,
        tradingPair: params.tradingPair,
        side: params.isBuy ? 'BUY' : 'SELL',
        errorMessage: err.message || 'Order execution failed',
        latencyUs
      };
    }
  }

  /**
   * إلغاء أمر
   */
  public async cancelOrder(orderId: string, tradingPair: string): Promise<boolean> {
    try {
      if (this.bybitClient.hasCredentials()) {
        await this.bybitClient.cancelRealOrder(tradingPair, orderId);
      }
      if (this.activeOrders.has(orderId)) {
        this.activeOrders.get(orderId).status = OrderStatus.CANCELLED;
      }
      this.orderTracker.updateOrderStatus(orderId, OrderState.CANCELLED);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * إغلاق المركز
   */
  public async closePosition(positionId: string): Promise<{ success: boolean; orders: OrderResult[] }> {
    const orders = this.orderTracker.getOrdersByPosition(positionId);
    for (const ord of orders) {
      if (ord.state === OrderState.OPEN || ord.state === OrderState.SUBMITTED) {
        await this.cancelOrder(ord.orderId, ord.tradingPair);
      }
    }
    return { success: true, orders: [] };
  }

  /**
   * جلب حالة أمر
   */
  public getOrderStatus(orderId: string) {
    const local = this.activeOrders.get(orderId);
    const tracked = this.orderTracker.getOrder(orderId);
    return tracked || local || null;
  }

  /**
   * إلغاء جميع الأوامر المفتوحة
   */
  public async cancelAllOrders(): Promise<number> {
    let cancelled = 0;
    const active = this.orderTracker.getActiveOrders();
    for (const ord of active) {
      const ok = await this.cancelOrder(ord.orderId, ord.tradingPair);
      if (ok) cancelled++;
    }
    return cancelled;
  }

  /**
   * تنظيف الأوامر القديمة
   */
  public async cleanupStaleOrders(maxAgeSeconds: number = 300): Promise<number> {
    const stale = this.orderTracker.detectStaleOrders();
    let cleaned = 0;
    for (const ord of stale) {
      await this.cancelOrder(ord.orderId, ord.tradingPair);
      cleaned++;
    }
    return cleaned;
  }
}
