export interface OrderRequest { symbol: string; side: 'Buy' | 'Sell'; qty: number; expectedPrice: number; }
export interface AtomicOrderResult { orderId: string; avgPrice: number; status: string; symbol?: string; }

// واجهة لعميل المنصة (Exchange Client Interface)
export interface ExchangeClient {
  placeOrder: (req: OrderRequest) => Promise<AtomicOrderResult>;
  cancelOrder: (symbol: string, orderId: string) => Promise<void>;
}

export class AtomicExecutor {
  constructor(private client: ExchangeClient, private maxSlippageBps: number = 25.0) {}

  async execute(legA: OrderRequest, legB: OrderRequest): Promise<{ status: string; reason?: string; details?: any }> {
    try {
      const [resA, resB] = await Promise.allSettled([
        this.client.placeOrder(legA),
        this.client.placeOrder(legB)
      ]);

      if (resA.status === 'rejected' || resB.status === 'rejected') {
        await this.rollback(resA.status === 'fulfilled' ? resA.value : null, resB.status === 'fulfilled' ? resB.value : null);
        return { status: 'FAILED', reason: 'Execution rejected by exchange' };
      }

      const valA = resA.value;
      const valB = resB.value;

      const slipA = Math.abs(valA.avgPrice - legA.expectedPrice) / legA.expectedPrice * 10000;
      const slipB = Math.abs(valB.avgPrice - legB.expectedPrice) / legB.expectedPrice * 10000;

      if (slipA > this.maxSlippageBps || slipB > this.maxSlippageBps) {
        await this.rollback(valA, valB);
        return { status: 'SLIPPAGE_REJECTED', details: { slipA, slipB } };
      }

      return { status: 'SUCCESS', details: { legA: valA, legB: valB, avgSlippage: (slipA + slipB) / 2 } };
    } catch (error) {
      return { status: 'FAILED', reason: String(error) };
    }
  }

  private async rollback(resA: AtomicOrderResult | null, resB: AtomicOrderResult | null) {
    if (resA?.orderId) await this.client.cancelOrder(resA.symbol || 'UNKNOWN', resA.orderId).catch(console.error);
    if (resB?.orderId) await this.client.cancelOrder(resB.symbol || 'UNKNOWN', resB.orderId).catch(console.error);
  }
}

