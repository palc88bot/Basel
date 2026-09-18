export interface L2Level { price: number; qty: number; }
export interface L2Book { bids: L2Level[]; asks: L2Level[]; spreadBps: number; }

export interface NetEVResult {
  isProfitable: boolean;
  grossEvBps: number;
  totalFrictionBps: number;
  netEvBps: number;
  rrRatio: number;
  details: Record<string, number>;
}

export class FrictionEngine {
  private readonly TAKER_FEE_BPS = 11.0; // 0.055% * 2 (دخول وخروج)
  private readonly BASE_SLIPPAGE_BPS = 0.5;

  calculate(
    spreadReversionBps: number,
    orderNotionalUSD: number,
    l2Book: L2Book,
    fundingRateDiff: number,
    expectedHoldMinutes: number
  ): NetEVResult {
    
    const top3BidLiquidity = l2Book.bids.slice(0, 3).reduce((sum, lvl) => sum + (lvl.price * lvl.qty), 0);
    const top3AskLiquidity = l2Book.asks.slice(0, 3).reduce((sum, lvl) => sum + (lvl.price * lvl.qty), 0);
    const minLiquidity = Math.min(top3BidLiquidity, top3AskLiquidity) || 1;
    
    const consumptionRatio = orderNotionalUSD / minLiquidity;
    const dynamicSlippageBps = this.BASE_SLIPPAGE_BPS + (consumptionRatio * 15.0);
    
    const hoursHeld = expectedHoldMinutes / 60.0;
    const fundingCostBps = Math.abs(fundingRateDiff) * 10000 * (hoursHeld / 8.0);
    
    const totalFrictionBps = this.TAKER_FEE_BPS + l2Book.spreadBps + dynamicSlippageBps + fundingCostBps;
    const netEvBps = spreadReversionBps - totalFrictionBps;
    
    const riskBps = spreadReversionBps * 0.4; 
    const rrRatio = riskBps > 0 ? netEvBps / riskBps : 0;
    
    // الشرط الذهبي: صافي الربح >= 3x الاحتكاك، و R:R >= 2.0
    const isProfitable = (netEvBps >= (3.0 * totalFrictionBps)) && (rrRatio >= 2.0);
    
    return {
      isProfitable, grossEvBps: spreadReversionBps, totalFrictionBps, netEvBps, rrRatio,
      details: { takerFeeBps: this.TAKER_FEE_BPS, spreadBps: l2Book.spreadBps, slippageBps: dynamicSlippageBps, fundingCostBps }
    };
  }
}
