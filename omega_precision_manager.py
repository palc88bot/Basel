"""
OMEGA Bot - Precision Manager V2 (Institutional Grade)
======================================================
مدير دقة الأسعار والكميات (Tick Size & Step Size / LOT_SIZE / PRICE_FILTER)

يحل مشكلة: "Precision is over the maximum defined for this asset" على منصات Binance و Bybit

المميزات:
  1. ✅ جلب معلومات الدقة والفلاتر من exchangeInfo / instruments-info تلقائياً عند بدء التشغيل
  2. ✅ دالة round_quantity() لضبط الكمية باتجاه الصفر لتجنب تجاوز الهامش (Floor Rounding)
  3. ✅ دالة round_price() لضبط السعر وفق مضاعفات tickSize الدقيقة
  4. ✅ فحص الحدود الدنيا للكمية (min_qty) والقيمة الاسمية (min_notional / $5 USD)
  5. ✅ كاش سريع للبيانات في الذاكرة لتفادي استدعاءات الشبكة المتكررة
  6. ✅ حماية حسابية ضد الفواصل العائمة في بايثون (IEEE 754 Floating Point Quirks)
"""

import asyncio
import logging
import math
from typing import Dict, Optional, Any, Tuple
from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class SymbolPrecision:
    """معلومات الدقة والحدود المنظمة لزوج تداول واحد"""
    symbol: str
    tick_size: float          # أصغر خطوة سعرية (مثل 0.01 لـ AAVEUSDT أو 0.1 لـ BTCUSDT)
    step_size: float          # أصغر خطوة كمية (مثل 0.001 لـ AAVEUSDT أو 0.001 لـ BTCUSDT)
    price_precision: int      # عدد الخانات العشرية للسعر
    quantity_precision: int   # عدد الخانات العشرية للكمية
    min_qty: float            # الحد الأدنى للكمية المسموح بإرسالها
    min_notional: float       # الحد الأدنى للقيمة الاسمية بالدولار (مثل $5.0)
    max_qty: float = 1000000.0


class PrecisionManager:
    """
    مدير الدقة الحسابية وضبط الأوامر للفيوتشرز
    """
    
    # دقة افتراضية آمنة لأشهر العملات في حال انقطاع الاتصال المؤقت
    FALLBACK_PRECISIONS = {
        "BTCUSDT": SymbolPrecision("BTCUSDT", 0.1, 0.001, 1, 3, 0.001, 5.0),
        "ETHUSDT": SymbolPrecision("ETHUSDT", 0.01, 0.001, 2, 3, 0.001, 5.0),
        "SOLUSDT": SymbolPrecision("SOLUSDT", 0.01, 0.01, 2, 2, 0.01, 5.0),
        "BNBUSDT": SymbolPrecision("BNBUSDT", 0.01, 0.01, 2, 2, 0.01, 5.0),
        "AAVEUSDT": SymbolPrecision("AAVEUSDT", 0.01, 0.001, 2, 3, 0.001, 5.0),
        "XRPUSDT": SymbolPrecision("XRPUSDT", 0.0001, 0.1, 4, 1, 0.1, 5.0),
        "ADAUSDT": SymbolPrecision("ADAUSDT", 0.0001, 1.0, 4, 0, 1.0, 5.0),
        "DOGEUSDT": SymbolPrecision("DOGEUSDT", 0.00001, 1.0, 5, 0, 1.0, 5.0),
        "LINKUSDT": SymbolPrecision("LINKUSDT", 0.001, 0.01, 3, 2, 0.01, 5.0),
        "AVAXUSDT": SymbolPrecision("AVAXUSDT", 0.001, 0.01, 3, 2, 0.01, 5.0),
        "NEARUSDT": SymbolPrecision("NEARUSDT", 0.001, 0.1, 3, 1, 0.1, 5.0),
        "DOTUSDT": SymbolPrecision("DOTUSDT", 0.001, 0.1, 3, 1, 0.1, 5.0),
    }

    def __init__(self, exchange_type: str = "binance", base_url: Optional[str] = None):
        """
        Args:
            exchange_type: 'binance' أو 'bybit'
            base_url: رابط API الأساسي
        """
        self.exchange_type = exchange_type.lower()
        if not base_url:
            self.base_url = "https://fapi.binance.com" if "binance" in self.exchange_type else "https://api.bybit.com"
        else:
            self.base_url = base_url
            
        self.precision_cache: Dict[str, SymbolPrecision] = dict(self.FALLBACK_PRECISIONS)
        self._loaded = False
        logger.info(f"✅ PrecisionManager initialized for {self.exchange_type} with fallback cache.")

    async def load_precision_info(self) -> bool:
        """
        جلب وتحديث معلومات الفلاتر الرسمية من المنصة
        """
        logger.info(f"📊 Fetching latest precision metadata from {self.exchange_type}...")
        try:
            if "binance" in self.exchange_type:
                await self._load_binance_precision()
            elif "bybit" in self.exchange_type:
                await self._load_bybit_precision()
            self._loaded = True
            logger.info(f"✅ Precision metadata active: {len(self.precision_cache)} symbols cached.")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Failed to fetch exchange info dynamically ({e}). Utilizing fallback precision cache.")
            return False

    async def _load_binance_precision(self):
        """جلب معلومات الدقة من Binance Futures API"""
        url = f"{self.base_url}/fapi/v1/exchangeInfo"
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    raise ValueError(f"Binance exchangeInfo returned HTTP {resp.status}")
                data = await resp.json()
                for symbol_info in data.get('symbols', []):
                    symbol = symbol_info['symbol']
                    tick_size = 0.01
                    step_size = 0.001
                    price_precision = int(symbol_info.get('pricePrecision', 2))
                    quantity_precision = int(symbol_info.get('quantityPrecision', 3))
                    min_qty = 0.001
                    min_notional = 5.0
                    
                    for f in symbol_info.get('filters', []):
                        f_type = f.get('filterType')
                        if f_type == 'PRICE_FILTER':
                            tick_size = float(f.get('tickSize', tick_size))
                            price_precision = self._count_decimals(tick_size)
                        elif f_type == 'LOT_SIZE':
                            step_size = float(f.get('stepSize', step_size))
                            quantity_precision = self._count_decimals(step_size)
                            min_qty = float(f.get('minQty', min_qty))
                        elif f_type == 'MIN_NOTIONAL':
                            min_notional = float(f.get('notional', min_notional))

                    self.precision_cache[symbol] = SymbolPrecision(
                        symbol=symbol,
                        tick_size=tick_size,
                        step_size=step_size,
                        price_precision=price_precision,
                        quantity_precision=quantity_precision,
                        min_qty=min_qty,
                        min_notional=min_notional
                    )

    async def _load_bybit_precision(self):
        """جلب معلومات الدقة من Bybit Linear Perpetual API"""
        url = f"{self.base_url}/v5/market/instruments-info?category=linear"
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    raise ValueError(f"Bybit instruments-info returned HTTP {resp.status}")
                data = await resp.json()
                if data.get('retCode') == 0:
                    for s in data.get('result', {}).get('list', []):
                        symbol = s.get('symbol')
                        tick_size = float(s.get('priceFilter', {}).get('tickSize', 0.01))
                        step_size = float(s.get('lotSizeFilter', {}).get('qtyStep', 0.001))
                        price_precision = int(s.get('priceScale', 2))
                        quantity_precision = self._count_decimals(step_size)
                        min_qty = float(s.get('lotSizeFilter', {}).get('minOrderQty', 0.001))
                        
                        self.precision_cache[symbol] = SymbolPrecision(
                            symbol=symbol,
                            tick_size=tick_size,
                            step_size=step_size,
                            price_precision=price_precision,
                            quantity_precision=quantity_precision,
                            min_qty=min_qty,
                            min_notional=5.0
                        )

    @staticmethod
    def _count_decimals(value: float) -> int:
        """حساب عدد الخانات العشرية بدقة من مضاعفات الخطوة"""
        str_val = f"{Decimal(str(value)):f}".rstrip('0')
        if '.' in str_val:
            return len(str_val.split('.')[-1])
        return 0

    def round_quantity(self, symbol: str, quantity: float) -> float:
        """
        تقريب الكمية إلى أقرب مضاعف لـ stepSize مع استخدام تقريب أرضي (Floor)
        لتجنب طلب كميات تتجاوز الرصيد المتاح (Margin Overflow).
        """
        prec = self.precision_cache.get(symbol)
        if not prec:
            # Fallback safe rounding
            return math.floor(quantity * 1000) / 1000

        step_dec = Decimal(str(prec.step_size))
        qty_dec = Decimal(str(quantity))
        
        # Floor to nearest step_size: (qty // step) * step
        rounded_dec = (qty_dec // step_dec) * step_dec
        
        # Quantize to exact decimal precision string
        fmt = f"{{:.{prec.quantity_precision}f}}"
        return float(fmt.format(rounded_dec))

    def round_price(self, symbol: str, price: float) -> float:
        """
        تقريب السعر إلى أقرب مضاعف لـ tickSize مع الحفاظ على الدقة
        """
        prec = self.precision_cache.get(symbol)
        if not prec:
            return round(price, 2)

        tick_dec = Decimal(str(prec.tick_size))
        price_dec = Decimal(str(price))
        
        # Round to nearest tick_size
        rounded_dec = (price_dec / tick_dec).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * tick_dec
        
        fmt = f"{{:.{prec.price_precision}f}}"
        return float(fmt.format(rounded_dec))

    def validate_order(self, symbol: str, quantity: float, price: float) -> Tuple[bool, str, float, float]:
        """
        فحص ومعايرة الأمر قبل إرساله إلى المنصة
        Returns: (is_valid, reason, rounded_quantity, rounded_price)
        """
        rounded_qty = self.round_quantity(symbol, quantity)
        rounded_price = self.round_price(symbol, price)

        prec = self.precision_cache.get(symbol)
        if not prec:
            return True, "ACCEPTED_WITH_DEFAULT_PRECISION", rounded_qty, rounded_price

        # 1. فحص الحد الأدنى للكمية (minQty)
        if rounded_qty < prec.min_qty:
            return False, f"QUANTITY_BELOW_MIN ({rounded_qty} < {prec.min_qty})", rounded_qty, rounded_price

        # 2. فحص القيمة الاسمية (minNotional: Qty * Price >= $5)
        notional = rounded_qty * rounded_price
        if notional < prec.min_notional:
            return False, f"NOTIONAL_BELOW_MIN (${notional:.2f} < ${prec.min_notional:.2f})", rounded_qty, rounded_price

        return True, "ORDER_PRECISION_VALIDATED", rounded_qty, rounded_price


# ==================== اختبار الوحدة (Unit Test) ====================

def test_precision_manager():
    print("=== Testing Institutional Precision Manager ===")
    manager = PrecisionManager("binance")

    # اختبار AAVEUSDT (Tick=0.01, Step=0.001)
    raw_aave_price = 123.456789
    raw_aave_qty = 0.12345678

    rounded_price = manager.round_price("AAVEUSDT", raw_aave_price)
    rounded_qty = manager.round_quantity("AAVEUSDT", raw_aave_qty)

    print(f"AAVE Raw Price: {raw_aave_price} -> Rounded: {rounded_price}")
    print(f"AAVE Raw Qty:   {raw_aave_qty} -> Rounded: {rounded_qty}")

    assert rounded_price == 123.46, f"Expected 123.46 but got {rounded_price}"
    assert rounded_qty == 0.123, f"Expected 0.123 but got {rounded_qty}"

    # اختبار التحقق من الأمر
    valid, reason, q, p = manager.validate_order("AAVEUSDT", raw_aave_qty, raw_aave_price)
    assert valid == True
    print(f"Validation: {valid} ({reason}) | Qty={q} | Price={p}")

    # اختبار أمر صغير جداً أقل من الحد الأدنى (Notional < $5)
    micro_qty = 0.001  # 0.001 * 123.46 = $0.12 < $5
    valid_micro, reason_micro, _, _ = manager.validate_order("AAVEUSDT", micro_qty, raw_aave_price)
    assert valid_micro == False
    print(f"Micro Order Rejected correctly: {reason_micro}")

    print("\n✅ All Precision Manager assertions passed successfully!")


if __name__ == "__main__":
    test_precision_manager()
