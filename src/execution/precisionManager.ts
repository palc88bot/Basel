/**
 * OMEGA Bot - Precision Manager (TypeScript / Node.js Institutional Grade)
 * =========================================================================
 * مدير دقة الأسعار والكميات (Tick Size & Step Size / LOT_SIZE / PRICE_FILTER)
 * 
 * يحل مشكلة: "Precision is over the maximum defined for this asset" على منصات Binance و Bybit
 * 
 * المميزات:
 *   1. ✅ جلب معلومات الدقة والفلاتر من exchangeInfo / instruments-info تلقائياً عند بدء التشغيل
 *   2. ✅ دالة roundQuantity() لضبط الكمية باتجاه الصفر لتجنب تجاوز الهامش (Floor Rounding)
 *   3. ✅ دالة roundPrice() لضبط السعر وفق مضاعفات tickSize الدقيقة
 *   4. ✅ فحص الحدود الدنيا للكمية (minQty) والقيمة الاسمية (minNotional / $5 USD)
 *   5. ✅ كاش سريع للبيانات في الذاكرة لتفادي استدعاءات الشبكة المتكررة
 *   6. ✅ دعم تنسيق السلاسل النصية الدقيقة (Formatted String Quantization) لمنع مشاكل الفواصل العشرية
 */

export interface SymbolPrecision {
  symbol: string;
  tickSize: number;          // أصغر خطوة سعرية (مثل 0.01 لـ AAVEUSDT أو 0.1 لـ BTCUSDT)
  stepSize: number;          // أصغر خطوة كمية (مثل 0.001 لـ AAVEUSDT أو 0.001 لـ BTCUSDT)
  pricePrecision: number;    // عدد الخانات العشرية للسعر
  quantityPrecision: number; // عدد الخانات العشرية للكمية
  minQty: number;            // الحد الأدنى للكمية المسموح بإرسالها
  minNotional: number;       // الحد الأدنى للقيمة الاسمية بالدولار (مثل $5.0)
  maxQty?: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason: string;
  roundedQuantity: number;
  roundedPrice: number;
  qtyString: string;
  priceString: string;
}

export class PrecisionManager {
  private precisionCache: Map<string, SymbolPrecision> = new Map();
  private isLoaded: boolean = false;
  private exchangeType: 'BINANCE' | 'BYBIT' = 'BINANCE';
  private baseUrl: string = 'https://fapi.binance.com';

  // Fallback Precisions for Top Pairs
  private static readonly FALLBACK_PRECISIONS: Record<string, SymbolPrecision> = {
    'BTCUSDT': { symbol: 'BTCUSDT', tickSize: 0.1, stepSize: 0.001, pricePrecision: 1, quantityPrecision: 3, minQty: 0.001, minNotional: 5.0 },
    'ETHUSDT': { symbol: 'ETHUSDT', tickSize: 0.01, stepSize: 0.001, pricePrecision: 2, quantityPrecision: 3, minQty: 0.001, minNotional: 5.0 },
    'SOLUSDT': { symbol: 'SOLUSDT', tickSize: 0.01, stepSize: 0.01, pricePrecision: 2, quantityPrecision: 2, minQty: 0.01, minNotional: 5.0 },
    'BNBUSDT': { symbol: 'BNBUSDT', tickSize: 0.01, stepSize: 0.01, pricePrecision: 2, quantityPrecision: 2, minQty: 0.01, minNotional: 5.0 },
    'AAVEUSDT': { symbol: 'AAVEUSDT', tickSize: 0.01, stepSize: 0.001, pricePrecision: 2, quantityPrecision: 3, minQty: 0.001, minNotional: 5.0 },
    'XRPUSDT': { symbol: 'XRPUSDT', tickSize: 0.0001, stepSize: 0.1, pricePrecision: 4, quantityPrecision: 1, minQty: 0.1, minNotional: 5.0 },
    'ADAUSDT': { symbol: 'ADAUSDT', tickSize: 0.0001, stepSize: 1.0, pricePrecision: 4, quantityPrecision: 0, minQty: 1.0, minNotional: 5.0 },
    'DOGEUSDT': { symbol: 'DOGEUSDT', tickSize: 0.00001, stepSize: 1.0, pricePrecision: 5, quantityPrecision: 0, minQty: 1.0, minNotional: 5.0 },
    'LINKUSDT': { symbol: 'LINKUSDT', tickSize: 0.001, stepSize: 0.01, pricePrecision: 3, quantityPrecision: 2, minQty: 0.01, minNotional: 5.0 },
    'AVAXUSDT': { symbol: 'AVAXUSDT', tickSize: 0.001, stepSize: 0.01, pricePrecision: 3, quantityPrecision: 2, minQty: 0.01, minNotional: 5.0 },
    'NEARUSDT': { symbol: 'NEARUSDT', tickSize: 0.001, stepSize: 0.1, pricePrecision: 3, quantityPrecision: 1, minQty: 0.1, minNotional: 5.0 },
    'DOTUSDT': { symbol: 'DOTUSDT', tickSize: 0.001, stepSize: 0.1, pricePrecision: 3, quantityPrecision: 1, minQty: 0.1, minNotional: 5.0 },
    'SUIUSDT': { symbol: 'SUIUSDT', tickSize: 0.0001, stepSize: 1.0, pricePrecision: 4, quantityPrecision: 0, minQty: 1.0, minNotional: 5.0 },
    'ARBUSDT': { symbol: 'ARBUSDT', tickSize: 0.0001, stepSize: 0.1, pricePrecision: 4, quantityPrecision: 1, minQty: 0.1, minNotional: 5.0 },
    'OPUSDT': { symbol: 'OPUSDT', tickSize: 0.0001, stepSize: 0.1, pricePrecision: 4, quantityPrecision: 1, minQty: 0.1, minNotional: 5.0 },
    'LTCUSDT': { symbol: 'LTCUSDT', tickSize: 0.01, stepSize: 0.001, pricePrecision: 2, quantityPrecision: 3, minQty: 0.001, minNotional: 5.0 },
  };

  constructor(exchangeType: 'BINANCE' | 'BYBIT' = 'BINANCE', baseUrl?: string) {
    this.exchangeType = exchangeType;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      this.baseUrl = exchangeType === 'BINANCE' ? 'https://fapi.binance.com' : 'https://api.bybit.com';
    }

    // Populate fallback cache immediately
    for (const [sym, prec] of Object.entries(PrecisionManager.FALLBACK_PRECISIONS)) {
      this.precisionCache.set(sym, prec);
      // Also map normalized forms (e.g. BTC-USDT or BTC/USDT)
      this.precisionCache.set(sym.replace('USDT', '-USDT'), prec);
    }
  }

  public setExchange(exchangeType: 'BINANCE' | 'BYBIT', baseUrl?: string): void {
    this.exchangeType = exchangeType;
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      this.baseUrl = exchangeType === 'BINANCE' ? 'https://fapi.binance.com' : 'https://api.bybit.com';
    }
  }

  /**
   * حساب عدد الخانات العشرية بدقة من مضاعفات الخطوة
   */
  private countDecimals(value: number): number {
    const str = value.toString();
    if (str.includes('e-')) {
      const parts = str.split('e-');
      return parseInt(parts[1], 10);
    }
    const dec = str.split('.')[1];
    return dec ? dec.length : 0;
  }

  /**
   * تحميل وتحديث معلومات الدقة والفلاتر من المنصة المحددة
   */
  public async loadPrecisionInfo(): Promise<boolean> {
    try {
      if (this.exchangeType === 'BINANCE') {
        await this.loadBinancePrecision();
      } else {
        await this.loadBybitPrecision();
      }
      this.isLoaded = true;
      console.log(`[PrecisionManager] ✅ Precision filters synchronized for ${this.precisionCache.size} trading pairs on ${this.exchangeType}`);
      return true;
    } catch (err: any) {
      console.warn(`[PrecisionManager] ⚠️ Dynamic precision sync warning (${err.message}). Using robust fallback precision table.`);
      return false;
    }
  }

  private async loadBinancePrecision(): Promise<void> {
    const url = `${this.baseUrl}/fapi/v1/exchangeInfo`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Binance exchangeInfo returned HTTP ${res.status}`);
    const data = await res.json();

    if (data && Array.isArray(data.symbols)) {
      for (const s of data.symbols) {
        if (!s.symbol || !s.symbol.endsWith('USDT')) continue;

        let tickSize = 0.01;
        let stepSize = 0.001;
        let pricePrecision = typeof s.pricePrecision === 'number' ? s.pricePrecision : 2;
        let quantityPrecision = typeof s.quantityPrecision === 'number' ? s.quantityPrecision : 3;
        let minQty = 0.001;
        let minNotional = 5.0;

        if (Array.isArray(s.filters)) {
          for (const f of s.filters) {
            if (f.filterType === 'PRICE_FILTER') {
              tickSize = parseFloat(f.tickSize || '0.01');
              pricePrecision = this.countDecimals(tickSize);
            } else if (f.filterType === 'LOT_SIZE') {
              stepSize = parseFloat(f.stepSize || '0.001');
              quantityPrecision = this.countDecimals(stepSize);
              minQty = parseFloat(f.minQty || '0.001');
            } else if (f.filterType === 'MIN_NOTIONAL') {
              minNotional = parseFloat(f.notional || '5.0');
            }
          }
        }

        const precObj: SymbolPrecision = {
          symbol: s.symbol,
          tickSize,
          stepSize,
          pricePrecision,
          quantityPrecision,
          minQty,
          minNotional
        };

        this.precisionCache.set(s.symbol, precObj);
        this.precisionCache.set(s.symbol.replace('USDT', '-USDT'), precObj);
      }
    }
  }

  private async loadBybitPrecision(): Promise<void> {
    const url = `${this.baseUrl}/v5/market/instruments-info?category=linear`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Bybit instruments-info returned HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.retCode === 0 && data.result && Array.isArray(data.result.list)) {
      for (const s of data.result.list) {
        const symbol = s.symbol;
        if (!symbol || !symbol.endsWith('USDT')) continue;

        const tickSize = parseFloat(s.priceFilter?.tickSize || '0.01');
        const stepSize = parseFloat(s.lotSizeFilter?.qtyStep || '0.001');
        const pricePrecision = parseInt(s.priceScale || '2', 10);
        const quantityPrecision = this.countDecimals(stepSize);
        const minQty = parseFloat(s.lotSizeFilter?.minOrderQty || '0.001');
        const minNotional = 5.0;

        const precObj: SymbolPrecision = {
          symbol,
          tickSize,
          stepSize,
          pricePrecision,
          quantityPrecision,
          minQty,
          minNotional
        };

        this.precisionCache.set(symbol, precObj);
        this.precisionCache.set(symbol.replace('USDT', '-USDT'), precObj);
      }
    }
  }

  public getPrecision(symbol: string): SymbolPrecision | undefined {
    const cleanSym = symbol.replace(/[^A-Z0-9]/g, '');
    return this.precisionCache.get(cleanSym) || this.precisionCache.get(symbol);
  }

  /**
   * تقريب الكمية إلى أقرب مضاعف لـ stepSize مع استخدام تقريب أرضي (Floor)
   * لتجنب طلب كميات تتجاوز الرصيد المتاح (Margin Overflow).
   */
  public roundQuantity(symbol: string, quantity: number): number {
    if (quantity <= 0 || isNaN(quantity)) return 0;
    const prec = this.getPrecision(symbol);
    if (!prec) {
      // Safe fallback: 3 decimals floor
      return Math.floor(quantity * 1000) / 1000;
    }

    const step = prec.stepSize;
    // Floor to step size: Math.floor(quantity / step) * step
    const stepped = Math.floor(quantity / step + 1e-12) * step;
    return parseFloat(stepped.toFixed(prec.quantityPrecision));
  }

  /**
   * تقريب السعر إلى أقرب مضاعف لـ tickSize مع الحفاظ على الدقة
   */
  public roundPrice(symbol: string, price: number): number {
    if (price <= 0 || isNaN(price)) return 0;
    const prec = this.getPrecision(symbol);
    if (!prec) {
      return parseFloat(price.toFixed(4));
    }

    const tick = prec.tickSize;
    const rounded = Math.round(price / tick) * tick;
    return parseFloat(rounded.toFixed(prec.pricePrecision));
  }

  /**
   * معايرة الأمر والتحقق من الحدود الدنيا (minQty, minNotional) قبل الإرسال للمنصة
   */
  public validateOrder(symbol: string, rawQuantity: number, rawPrice: number): ValidationResult {
    const prec = this.getPrecision(symbol);
    const roundedQuantity = this.roundQuantity(symbol, rawQuantity);
    const roundedPrice = this.roundPrice(symbol, rawPrice);

    const pricePrecision = prec ? prec.pricePrecision : 2;
    const quantityPrecision = prec ? prec.quantityPrecision : 3;

    const qtyString = roundedQuantity.toFixed(quantityPrecision);
    const priceString = roundedPrice.toFixed(pricePrecision);

    if (!prec) {
      return {
        isValid: roundedQuantity > 0,
        reason: 'PRECISION_APPLIED_WITH_FALLBACK',
        roundedQuantity,
        roundedPrice,
        qtyString,
        priceString
      };
    }

    // 1. فحص الحد الأدنى للكمية (minQty)
    if (roundedQuantity < prec.minQty) {
      return {
        isValid: false,
        reason: `QUANTITY_BELOW_MIN: الكمية (${roundedQuantity}) أقل من الحد الأدنى (${prec.minQty}) لـ ${symbol}`,
        roundedQuantity,
        roundedPrice,
        qtyString,
        priceString
      };
    }

    // 2. فحص القيمة الاسمية (minNotional: Qty * Price >= $5)
    const notional = roundedQuantity * roundedPrice;
    if (notional < prec.minNotional) {
      return {
        isValid: false,
        reason: `NOTIONAL_BELOW_MIN: القيمة الاسمية ($${notional.toFixed(2)}) أقل من الحد الأدنى ($${prec.minNotional.toFixed(2)})`,
        roundedQuantity,
        roundedPrice,
        qtyString,
        priceString
      };
    }

    return {
      isValid: true,
      reason: 'ORDER_PRECISION_VALIDATED_OK',
      roundedQuantity,
      roundedPrice,
      qtyString,
      priceString
    };
  }
}

// Global Singleton Instance
export const precisionManager = new PrecisionManager();
