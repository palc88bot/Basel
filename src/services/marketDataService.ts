import axios from 'axios';

export interface MarketData {
  symbol: string;
  currentPrice: number;
  zScore: number;
  volatility: number;
  trend: 'up' | 'down' | 'sideways';
  volume: number;
  halfLifeEstimate: number; // تقدير بسيط لعمر النصف للارتداد
}

export class MarketDataService {
  private readonly BINANCE_API = 'https://api.binance.com/api/v3';

  /**
   * جلب بيانات السوق وحساب المؤشرات الكمية
   */
  async getQuantitativeData(symbol: string, interval: string = '1h', limit: number = 100): Promise<MarketData> {
    try {
      // 1. جلب بيانات الشموع من بينانس
      const response = await axios.get(`${this.BINANCE_API}/klines`, {
        params: { symbol: symbol.toUpperCase(), interval, limit }
      });

      const klines = response.data; // [[time, open, high, low, close, volume, ...], ...]
      
      // 2. استخراج أسعار الإغلاق وحساب المتوسط والانحراف المعياري
      const closes = klines.map((k: any) => parseFloat(k[4]));
      const volumes = klines.map((k: any) => parseFloat(k[5]));
      
      const currentPrice = closes[closes.length - 1];
      const mean = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
      
      const variance = closes.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / closes.length;
      const stdDev = Math.sqrt(variance);
      
      // 3. حساب Z-Score: (السعر الحالي - المتوسط) / الانحراف المعياري
      const zScore = (currentPrice - mean) / stdDev;
      
      // 4. حساب التقلب (Volatility) كنسبة مئوية
      const volatility = stdDev / mean;

      // 5. تحديد الاتجاه البسيط (مقارنة آخر 5 شمعات بأول 5)
      const recentAvg = closes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5;
      const oldAvg = closes.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / 5;
      const trend = recentAvg > oldAvg * 1.01 ? 'up' : recentAvg < oldAvg * 0.99 ? 'down' : 'sideways';

      // 6. تقدير بسيط لعمر النصف (Half-Life) بناءً على سرعة العودة للمتوسط
      // (محاكاة مبسطة: كلما كان Z-Score أعلى، كان الارتداد المتوقع أسرع في نماذج OU)
      const halfLifeEstimate = Math.max(1, Math.round(10 / (Math.abs(zScore) + 0.1)));

      return {
        symbol: symbol.toUpperCase(),
        currentPrice,
        zScore,
        volatility,
        trend,
        volume: volumes[volumes.length - 1],
        halfLifeEstimate
      };

    } catch (error) {
      console.error(`فشل في جلب بيانات ${symbol}:`, error);
      throw new Error('تعذر الاتصال ببيانات السوق الحية');
    }
  }
}
