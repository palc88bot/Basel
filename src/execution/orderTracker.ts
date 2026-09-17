/**
 * Order Tracker - تتبع دورة حياة الأوامر من الإرسال حتى التنفيذ
 * يدير: In-Flight orders, Partial fills, Orphaned orders, Stale detection
 */

export enum OrderState {
  CREATED = 'created',
  SUBMITTED = 'submitted',
  OPEN = 'open',
  PARTIAL_FILL = 'partial_fill',
  FILLED = 'filled',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface TrackedOrder {
  orderId: string;
  clientOrderId: string;
  tradingPair: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  
  // State
  state: OrderState;
  filledAmount: number;
  averageFillPrice: number;
  
  // Timestamps (in seconds)
  createdAt: number;
  submittedAt?: number;
  filledAt?: number;
  
  // Metadata
  positionId?: string;
  signalId?: string;
}

export class OrderTracker {
  private orders: Map<string, TrackedOrder> = new Map();
  private staleThreshold: number; // seconds
  private partialFillTimeout: number; // seconds
  
  // Statistics
  private totalOrders: number = 0;
  private successfulOrders: number = 0;
  private failedOrders: number = 0;

  constructor(config: { staleThreshold?: number; partialFillTimeout?: number } = {}) {
    this.staleThreshold = config.staleThreshold ?? 300; // 5 minutes
    this.partialFillTimeout = config.partialFillTimeout ?? 60; // 1 minute
  }

  public trackOrder(params: {
    orderId: string;
    clientOrderId: string;
    tradingPair: string;
    side: 'BUY' | 'SELL';
    amount: number;
    price: number;
    positionId?: string;
    signalId?: string;
  }): TrackedOrder {
    const now = Date.now() / 1000;
    const order: TrackedOrder = {
      orderId: params.orderId,
      clientOrderId: params.clientOrderId,
      tradingPair: params.tradingPair,
      side: params.side,
      amount: params.amount,
      price: params.price,
      state: OrderState.SUBMITTED,
      filledAmount: 0,
      averageFillPrice: 0,
      createdAt: now,
      submittedAt: now,
      positionId: params.positionId,
      signalId: params.signalId
    };

    this.orders.set(params.orderId, order);
    this.totalOrders++;
    return order;
  }

  public updateOrderStatus(
    orderId: string,
    state: OrderState,
    filledAmount?: number,
    averageFillPrice?: number
  ): TrackedOrder | null {
    const order = this.orders.get(orderId);
    if (!order) return null;

    order.state = state;

    if (filledAmount !== undefined) {
      order.filledAmount = filledAmount;
    }
    if (averageFillPrice !== undefined) {
      order.averageFillPrice = averageFillPrice;
    }

    if (state === OrderState.FILLED) {
      order.filledAt = Date.now() / 1000;
      this.successfulOrders++;
    } else if (
      state === OrderState.CANCELLED ||
      state === OrderState.FAILED ||
      state === OrderState.EXPIRED
    ) {
      this.failedOrders++;
    }

    return order;
  }

  public getOrder(orderId: string): TrackedOrder | undefined {
    return this.orders.get(orderId);
  }

  public getActiveOrders(): TrackedOrder[] {
    return Array.from(this.orders.values()).filter(
      o =>
        o.state === OrderState.SUBMITTED ||
        o.state === OrderState.OPEN ||
        o.state === OrderState.PARTIAL_FILL
    );
  }

  public getAllOrders(): TrackedOrder[] {
    return Array.from(this.orders.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getOrdersByPosition(positionId: string): TrackedOrder[] {
    return Array.from(this.orders.values()).filter(o => o.positionId === positionId);
  }

  public detectStaleOrders(): TrackedOrder[] {
    const now = Date.now() / 1000;
    return this.getActiveOrders().filter(order => {
      if (order.submittedAt) {
        return (now - order.submittedAt) > this.staleThreshold;
      }
      return false;
    });
  }

  public detectPartialFillsTimeout(): TrackedOrder[] {
    const now = Date.now() / 1000;
    return this.getActiveOrders().filter(order => {
      if (order.state === OrderState.PARTIAL_FILL && order.submittedAt) {
        return (now - order.submittedAt) > this.partialFillTimeout;
      }
      return false;
    });
  }

  public cleanupOldOrders(maxAgeHours: number = 24): number {
    const now = Date.now() / 1000;
    const cutoff = now - (maxAgeHours * 3600);
    let removed = 0;

    for (const [orderId, order] of this.orders.entries()) {
      if (
        order.state === OrderState.FILLED ||
        order.state === OrderState.CANCELLED ||
        order.state === OrderState.FAILED
      ) {
        if (order.createdAt < cutoff) {
          this.orders.delete(orderId);
          removed++;
        }
      }
    }

    return removed;
  }

  public getStatistics() {
    const activeOrders = this.getActiveOrders().length;
    const successRate = this.totalOrders > 0 ? this.successfulOrders / this.totalOrders : 0;

    return {
      totalOrders: this.totalOrders,
      successfulOrders: this.successfulOrders,
      failedOrders: this.failedOrders,
      activeOrders,
      successRatePct: parseFloat((successRate * 100).toFixed(1))
    };
  }

  public reconcileWithExchange(exchangeOrders: Array<{ order_id: string; filled_amount?: number; status?: string }>) {
    const exchangeOrderIds = new Set(exchangeOrders.map(o => o.order_id));
    const localOrderIds = new Set(this.orders.keys());

    const orphaned = Array.from(exchangeOrderIds).filter(id => !localOrderIds.has(id));
    const missing = Array.from(localOrderIds).filter(id => !exchangeOrderIds.has(id));

    let updated = 0;
    for (const exOrder of exchangeOrders) {
      const local = this.orders.get(exOrder.order_id);
      if (local) {
        if (exOrder.filled_amount !== undefined) {
          local.filledAmount = exOrder.filled_amount;
        }
        if (exOrder.status) {
          local.state = exOrder.status as OrderState;
        }
        updated++;
      }
    }

    const matched = Array.from(exchangeOrderIds).filter(id => localOrderIds.has(id)).length;

    return {
      matched,
      missing: missing.length,
      orphaned: orphaned.length,
      updated
    };
  }
}
