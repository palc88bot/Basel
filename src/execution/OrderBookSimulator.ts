/**
 * OMEGA QuantBrain - Order Book Simulator
 * =========================================
 * محاكاة واقعية لدفتر الأوامر (Order Book)
 * 
 * المميزات:
 *   1. ✅ بناء دفتر أوامر من بيانات حقيقية
 *   2. ✅ حساب عمق السوق (Market Depth)
 *   3. ✅ حساب VWAP (متوسط السعر المرجح بالحجم)
 *   4. ✅ حساب السبريد اللحظي
 *   5. ✅ حساب Order Book Imbalance
 *   6. ✅ محاكاة تأثير الأوامر الكبيرة على السعر
 */

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderBookLevel[];  // أوامر الشراء (من الأعلى للأدنى)
  asks: OrderBookLevel[];  // أوامر البيع (من الأدنى للأعلى)
}

export interface OrderBookMetrics {
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPct: number;
  midPrice: number;
  vwapBid: number;
  vwapAsk: number;
  depthBidUsd: number;    // إجمالي حجم الشراء بالدولار
  depthAskUsd: number;    // إجمالي حجم البيع بالدولار
  imbalance: number;      // -1 إلى 1 (سالب = ضغط بيع، موجب = ضغط شراء)
}

export class OrderBookSimulator {
  private orderBooks: Map<string, OrderBook> = new Map();
  private maxLevels: number = 20;  // عدد المستويات المحفوظة

  /**
   * تحديث دفتر الأوامر لرمز معين
   */
  updateOrderBook(symbol: string, bids: OrderBookLevel[], asks: OrderBookLevel[]): void {
    // ترتيب bids من الأعلى للأدنى
    const sortedBids = [...bids]
      .sort((a, b) => b.price - a.price)
      .slice(0, this.maxLevels);
    
    // ترتيب asks من الأدنى للأعلى
    const sortedAsks = [...asks]
      .sort((a, b) => a.price - b.price)
      .slice(0, this.maxLevels);
    
    this.orderBooks.set(symbol, {
      symbol,
      timestamp: Date.now(),
      bids: sortedBids,
      asks: sortedAsks
    });
  }

  /**
   * بناء دفتر أوامر صناعي من سعر وسيولة (عند عدم توفر بيانات حقيقية)
   */
  buildSyntheticOrderBook(symbol: string, midPrice: number, volume24hUsd: number): OrderBook {
    const spreadPct = this.estimateSpread(volume24hUsd);
    const halfSpread = midPrice * spreadPct / 2;
    
    const bids: OrderBookLevel[] = [];
    const asks: OrderBookLevel[] = [];
    
    // بناء 20 مستوى
    for (let i = 0; i < this.maxLevels; i++) {
      const bidPrice = midPrice - halfSpread - (i * midPrice * 0.0002);
      const askPrice = midPrice + halfSpread + (i * midPrice * 0.0002);
      
      // الحجم يتناقص كلما ابتعدنا عن السعر
      const baseQty = (volume24hUsd / (midPrice > 0 ? midPrice : 1)) / 1000;
      const qty = baseQty * (1 - i * 0.03);
      
      bids.push({ price: bidPrice, quantity: Math.max(qty, 0.001) });
      asks.push({ price: askPrice, quantity: Math.max(qty, 0.001) });
    }
    
    const ob: OrderBook = {
      symbol,
      timestamp: Date.now(),
      bids,
      asks
    };

    this.orderBooks.set(symbol, ob);
    return ob;
  }

  /**
   * تقدير السبريد بناءً على السيولة
   */
  private estimateSpread(volume24hUsd: number): number {
    if (volume24hUsd > 1_000_000_000) return 0.0001;  // 0.01%
    if (volume24hUsd > 500_000_000) return 0.0002;    // 0.02%
    if (volume24hUsd > 100_000_000) return 0.0005;    // 0.05%
    if (volume24hUsd > 50_000_000) return 0.001;      // 0.1%
    return 0.002;  // 0.2%
  }

  /**
   * حساب مقاييس دفتر الأوامر
   */
  getMetrics(symbol: string): OrderBookMetrics | null {
    const ob = this.orderBooks.get(symbol);
    if (!ob || ob.bids.length === 0 || ob.asks.length === 0) {
      return null;
    }
    
    const bestBid = ob.bids[0].price;
    const bestAsk = ob.asks[0].price;
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    
    // حساب VWAP
    let bidVolumeWeightedSum = 0;
    let bidTotalVolume = 0;
    for (const level of ob.bids) {
      bidVolumeWeightedSum += level.price * level.quantity;
      bidTotalVolume += level.quantity;
    }
    const vwapBid = bidTotalVolume > 0 ? bidVolumeWeightedSum / bidTotalVolume : bestBid;
    
    let askVolumeWeightedSum = 0;
    let askTotalVolume = 0;
    for (const level of ob.asks) {
      askVolumeWeightedSum += level.price * level.quantity;
      askTotalVolume += level.quantity;
    }
    const vwapAsk = askTotalVolume > 0 ? askVolumeWeightedSum / askTotalVolume : bestAsk;
    
    // حساب العمق بالدولار
    const depthBidUsd = ob.bids.reduce((sum, l) => sum + l.price * l.quantity, 0);
    const depthAskUsd = ob.asks.reduce((sum, l) => sum + l.price * l.quantity, 0);
    
    // حساب الـ Imbalance
    const totalDepth = depthBidUsd + depthAskUsd;
    const imbalance = totalDepth > 0 
      ? (depthBidUsd - depthAskUsd) / totalDepth 
      : 0;
    
    return {
      bestBid,
      bestAsk,
      spread,
      spreadPct: midPrice > 0 ? spread / midPrice : 0,
      midPrice,
      vwapBid,
      vwapAsk,
      depthBidUsd,
      depthAskUsd,
      imbalance: parseFloat(imbalance.toFixed(4))
    };
  }

  /**
   * حساب سعر التنفيذ المتوقع لأمر بحجم معين
   * ⚠️ هذه الدالة الأهم - تحاكي الانزلاق السعري الحقيقي
   */
  calculateExecutionPrice(
    symbol: string, 
    side: 'BUY' | 'SELL', 
    quantity: number
  ): { price: number; avgPrice: number; slippagePct: number } | null {
    const ob = this.orderBooks.get(symbol);
    if (!ob) return null;
    
    const levels = side === 'BUY' ? ob.asks : ob.bids;
    if (levels.length === 0) return null;
    
    let remainingQty = quantity;
    let totalCost = 0;
    let filledQty = 0;
    
    // المرور عبر مستويات دفتر الأوامر
    for (const level of levels) {
      const fillQty = Math.min(remainingQty, level.quantity);
      totalCost += fillQty * level.price;
      filledQty += fillQty;
      remainingQty -= fillQty;
      
      if (remainingQty <= 0) break;
    }
    
    if (filledQty === 0) return null;
    
    const avgPrice = totalCost / filledQty;
    const bestPrice = side === 'BUY' ? ob.asks[0].price : ob.bids[0].price;
    const slippagePct = side === 'BUY'
      ? (avgPrice - bestPrice) / (bestPrice > 0 ? bestPrice : 1)
      : (bestPrice - avgPrice) / (bestPrice > 0 ? bestPrice : 1);
    
    return {
      price: avgPrice,
      avgPrice,
      slippagePct: parseFloat(slippagePct.toFixed(6))
    };
  }

  /**
   * التحقق من توفر سيولة كافية
   */
  hasSufficientLiquidity(symbol: string, side: 'BUY' | 'SELL', quantity: number): boolean {
    const ob = this.orderBooks.get(symbol);
    if (!ob) return false;
    
    const levels = side === 'BUY' ? ob.asks : ob.bids;
    const totalAvailable = levels.reduce((sum, l) => sum + l.quantity, 0);
    
    return totalAvailable >= quantity;
  }

  /**
   * الحصول على دفتر الأوامر
   */
  getOrderBook(symbol: string): OrderBook | null {
    return this.orderBooks.get(symbol) || null;
  }

  /**
   * تنظيف دفاتر الأوامر القديمة
   */
  cleanup(maxAgeMs: number = 60000): void {
    const now = Date.now();
    for (const [symbol, ob] of this.orderBooks) {
      if (now - ob.timestamp > maxAgeMs) {
        this.orderBooks.delete(symbol);
      }
    }
  }
}
