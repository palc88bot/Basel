"""
OMEGA Bot - Hybrid Exit System V2 (Audited & Production-Ready)
============================================================
نظام خروج هجين مصحح بالكامل يجمع بين:
  1. أوامر TP/SL في المنصة كشبكة أمان كارثية (Hard Catastrophic Stop)
  2. مراقبة لحظية لـ Z-Score مع تصحيح إشارات المقارنة الرياضية
  3. إدارة دقة الكسور والأسعار (Tick Size & Precision Management)
  4. إلغاء الأوامر المتبادلة (OCO Cleanup upon Fill)
  5. فترة سماح لتجنب التذبذب اللحظي الكاذب (Z-Score Hysteresis)

التصحيحات المطبقة:
  ✅ تصحيح شرط الـ Z-Score:
     - في الـ LONG: ننتظر صعود Z إلى 0.0 أو تجاوزه (current_z >= target_z)
     - في الـ SHORT: ننتظر هبوط Z إلى 0.0 أو تجاوزه (current_z <= -target_z)
  ✅ معالجة الترقيم العشري بدون أخطاء الصيغة العلمية (Exponential Notation Safe)
  ✅ فك تعقيد الأزواج: وقف كارثي صلب (3%) في المنصة، وخروج ديناميكي بالـ Z-Score
  ✅ دمج OCO Cleanup لحذف الأوامر المعلقة المقابلة فور تنفيذ أحد الطرفين
  ✅ فترة سماح 3 ثوانٍ (Hysteresis Window) لضمان استقرار الانعكاس
"""

import asyncio
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass, field
import time
from decimal import Decimal

from omega_state_database import StateDatabase
from omega_reconciliation import ExchangeAdapter

logger = logging.getLogger(__name__)


@dataclass
class TickSizeConfig:
    """إعدادات دقة الأسعار والكميات لكل رمز"""
    symbol: str
    tick_size: float          # أصغر وحدة سعرية (مثل 0.01 لـ BTC)
    step_size: float          # أصغر وحدة كمية (مثل 0.001)
    price_precision: int      # عدد الخانات العشرية للسعر
    quantity_precision: int   # عدد الخانات العشرية للكمية


@dataclass
class ExitOrders:
    """تمثيل أوامر الخروج (TP + SL) في المنصة وذاكرة عقل البوت"""
    symbol: str
    side: str  # "LONG" أو "SHORT"
    
    # Take Profit (المنصة)
    tp_order_id: Optional[str] = None
    tp_price: float = 0.0
    
    # Stop Loss (المنصة)
    sl_order_id: Optional[str] = None
    sl_price: float = 0.0
    
    # Time Exit (خروج زمني أقصى)
    time_exit_timestamp: Optional[float] = None
    time_exit_seconds: int = 3600
    
    # تفاصيل الدخول
    entry_price: float = 0.0
    entry_z_score: float = 0.0
    created_at: str = ""
    
    # Hysteresis tracking (فترة تأكيد استقرار الإشارة)
    exit_signal_start_time: Optional[float] = None
    hysteresis_seconds: float = 3.0
    
    @property
    def has_tp(self) -> bool:
        return self.tp_order_id is not None
    
    @property
    def has_sl(self) -> bool:
        return self.sl_order_id is not None
    
    @property
    def is_active(self) -> bool:
        return self.has_tp or self.has_sl


class TickSizeManager:
    """
    مدير دقة الأسعار والكميات (Tick Size & Lot Precision)
    يمنع أخطاء الرفض الناتجة عن الخانات العشرية الزائدة
    """
    
    def __init__(self):
        self.tick_configs: Dict[str, TickSizeConfig] = {}
        logger.info("✅ TickSizeManager initialized")
    
    def _calc_precision(self, value_str: str) -> int:
        """حساب عدد الخانات العشرية بدقة بدون أخطاء الصيغ العلمية"""
        try:
            d = Decimal(str(value_str))
            return max(0, -d.as_tuple().exponent)
        except Exception:
            return 2

    async def load_exchange_info(self, exchange: ExchangeAdapter):
        """جلب معلومات الدقة والفلاتر مباشرة من المنصة"""
        try:
            if exchange.exchange_type.value == "binance":
                await self._load_binance_info(exchange)
            elif exchange.exchange_type.value == "bybit":
                await self._load_bybit_info(exchange)
            logger.info(f"✅ Loaded tick configurations for {len(self.tick_configs)} symbols")
        except Exception as e:
            logger.error(f"❌ Failed to load exchange info: {e}")
    
    async def _load_binance_info(self, exchange: ExchangeAdapter):
        """جلب فلاتر Binance Futures"""
        import aiohttp
        url = f"{exchange.base_url}/fapi/v1/exchangeInfo"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                data = await resp.json()
                for s in data.get('symbols', []):
                    symbol = s['symbol']
                    tick_size = 0.01
                    step_size = 0.001
                    for f in s.get('filters', []):
                        if f['filterType'] == 'PRICE_FILTER':
                            tick_size = float(f['tickSize'])
                        elif f['filterType'] == 'LOT_SIZE':
                            step_size = float(f['stepSize'])
                    
                    self.tick_configs[symbol] = TickSizeConfig(
                        symbol=symbol,
                        tick_size=tick_size,
                        step_size=step_size,
                        price_precision=self._calc_precision(str(tick_size)),
                        quantity_precision=self._calc_precision(str(step_size))
                    )

    async def _load_bybit_info(self, exchange: ExchangeAdapter):
        """جلب فلاتر Bybit Linear Perpetual"""
        import aiohttp
        url = f"{exchange.base_url}/v5/market/instruments-info?category=linear"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                data = await resp.json()
                if data.get('retCode') == 0:
                    for s in data.get('result', {}).get('list', []):
                        symbol = s['symbol']
                        tick_size = float(s.get('priceFilter', {}).get('tickSize', '0.01'))
                        step_size = float(s.get('lotSizeFilter', {}).get('qtyStep', '0.001'))
                        price_scale = int(s.get('priceScale', self._calc_precision(str(tick_size))))
                        
                        self.tick_configs[symbol] = TickSizeConfig(
                            symbol=symbol,
                            tick_size=tick_size,
                            step_size=step_size,
                            price_precision=price_scale,
                            quantity_precision=self._calc_precision(str(step_size))
                        )

    def round_price(self, symbol: str, price: float) -> float:
        """تقريب السعر لأقرب وحدة Tick Size مسموحة مع الدقة المحددة"""
        if symbol not in self.tick_configs:
            return round(price, 2)
        cfg = self.tick_configs[symbol]
        rounded = round(price / cfg.tick_size) * cfg.tick_size
        return round(rounded, cfg.price_precision)

    def round_quantity(self, symbol: str, quantity: float) -> float:
        """تقريب الكمية لأقرب وحدة Step Size مسموحة"""
        if symbol not in self.tick_configs:
            return round(quantity, 3)
        cfg = self.tick_configs[symbol]
        rounded = round(quantity / cfg.step_size) * cfg.step_size
        return round(rounded, cfg.quantity_precision)


class HybridExitSystem:
    """
    نظام الخروج الهجين المعتمد:
    1. وقف خسارة كارثي ثابت على المنصة (Hard Catastrophic Stop Loss)
    2. خروج ذكي ديناميكي وفق عودة الـ Z-Score للمتوسط
    3. آلية Hysteresis لحماية الأرباح وتجنب الخروج الكاذب
    4. تنظيف تلقائي للأوامر المتبادلة (OCO Cleanup)
    """

    def __init__(
        self,
        state_db: StateDatabase,
        exchange: ExchangeAdapter,
        tick_manager: TickSizeManager,
        catastrophic_sl_percent: float = 0.03,  # وقف كارثي 3%
        time_exit_seconds: int = 3600,         # أقصى مدة 60 دقيقة
        hysteresis_seconds: float = 3.0        # تأكيد ثبات 3 ثوانٍ
    ):
        self.state_db = state_db
        self.exchange = exchange
        self.tick_manager = tick_manager
        self.catastrophic_sl_percent = catastrophic_sl_percent
        self.time_exit_seconds = time_exit_seconds
        self.hysteresis_seconds = hysteresis_seconds
        self.active_exits: Dict[str, ExitOrders] = {}

        logger.info(
            f"✅ HybridExitSystem initialized | SL={catastrophic_sl_percent*100}% | "
            f"TimeExit={time_exit_seconds}s | Hysteresis={hysteresis_seconds}s"
        )

    def calculate_exit_prices(self, symbol: str, side: str, entry_price: float) -> Tuple[float, float]:
        """
        حساب أسعار الوقف الكارثي والهدف المبدئي مع مراعاة اتجاه الصفقة:
        - في LONG: الوقف أقل من سعر الدخول (entry * (1 - SL))
        - في SHORT: الوقف أعلى من سعر الدخول (entry * (1 + SL))
        """
        if side == "LONG":
            sl_price = entry_price * (1.0 - self.catastrophic_sl_percent)
            tp_price = entry_price * (1.0 + self.catastrophic_sl_percent * 2.0)
        else:
            sl_price = entry_price * (1.0 + self.catastrophic_sl_percent)
            tp_price = entry_price * (1.0 - self.catastrophic_sl_percent * 2.0)

        return (
            self.tick_manager.round_price(symbol, tp_price),
            self.tick_manager.round_price(symbol, sl_price)
        )

    async def place_exit_orders(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        entry_z: float,
        size: float
    ) -> Optional[ExitOrders]:
        """وضع أوامر الحماية الكارثية على المنصة مع تسجيل المعرفات محلياً"""
        logger.info(f"🎯 Placing hybrid exit protections for {symbol} ({side})...")
        try:
            tp_price, sl_price = self.calculate_exit_prices(symbol, side, entry_price)
            size_clean = self.tick_manager.round_quantity(symbol, size)
            close_side = "SELL" if side == "LONG" else "BUY"

            # 1. وضع أمر Stop-Market للوقف الكارثي (أهم خط دفاع)
            sl_order_id = await self._place_stop_market(symbol, close_side, size_clean, sl_price)
            if not sl_order_id:
                logger.error(f"❌ Critical: Failed to place SL on exchange for {symbol}")
                return None

            # 2. وضع أمر Take-Profit اختياري كهدف نهائي متباعد
            tp_order_id = await self._place_take_profit_market(symbol, close_side, size_clean, tp_price)

            exit_orders = ExitOrders(
                symbol=symbol,
                side=side,
                tp_order_id=tp_order_id,
                tp_price=tp_price,
                sl_order_id=sl_order_id,
                sl_price=sl_price,
                time_exit_timestamp=time.time() + self.time_exit_seconds,
                time_exit_seconds=self.time_exit_seconds,
                entry_price=entry_price,
                entry_z_score=entry_z,
                created_at=datetime.now(timezone.utc).isoformat(),
                hysteresis_seconds=self.hysteresis_seconds
            )

            self.active_exits[symbol] = exit_orders

            # حفظ الحالة في SQLite
            self.state_db.save_position(
                symbol=symbol,
                side=side,
                entry_price=entry_price,
                size=size_clean,
                stop_loss=sl_price,
                take_profit=tp_price
            )

            logger.info(
                f"✅ Hybrid Exits armed for {symbol} | SL=${sl_price} (ID:{sl_order_id}) | "
                f"TP=${tp_price} (ID:{tp_order_id})"
            )
            return exit_orders
        except Exception as e:
            logger.error(f"❌ Error setting hybrid exits for {symbol}: {e}")
            return None

    async def _place_stop_market(self, symbol: str, close_side: str, size: float, sl_price: float) -> Optional[str]:
        """إرسال أمر Stop-Market مع Reduce-Only ودعم Mark Price"""
        import aiohttp
        import hashlib
        import hmac
        import json as json_lib

        if self.exchange.exchange_type.value == "binance":
            timestamp = int(time.time() * 1000)
            params = {
                "symbol": symbol,
                "side": close_side,
                "type": "STOP_MARKET",
                "stopPrice": str(sl_price),
                "quantity": size,
                "reduceOnly": "true",
                "workingType": "MARK_PRICE",
                "timestamp": timestamp
            }
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            signature = hmac.new(self.exchange.api_secret.encode(), query_string.encode(), hashlib.sha256).hexdigest()
            url = f"{self.exchange.base_url}/fapi/v1/order?{query_string}&signature={signature}"
            headers = {"X-MBX-APIKEY": self.exchange.api_key}

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as resp:
                    res = await resp.json()
                    return str(res['orderId']) if 'orderId' in res else None

        elif self.exchange.exchange_type.value == "bybit":
            timestamp = str(int(time.time() * 1000))
            recv_window = "5000"
            body = {
                "category": "linear",
                "symbol": symbol,
                "side": close_side,
                "orderType": "Market",
                "qty": str(size),
                "triggerPrice": str(sl_price),
                "triggerDirection": 2 if close_side == "SELL" else 1,
                "reduceOnly": True,
                "triggerBy": "MarkPrice"
            }
            body_str = json_lib.dumps(body)
            sign_str = timestamp + self.exchange.api_key + recv_window + body_str
            signature = hmac.new(self.exchange.api_secret.encode(), sign_str.encode(), hashlib.sha256).hexdigest()
            url = f"{self.exchange.base_url}/v5/order/create"
            headers = {
                "X-BAPI-API-KEY": self.exchange.api_key,
                "X-BAPI-TIMESTAMP": timestamp,
                "X-BAPI-RECV-WINDOW": recv_window,
                "X-BAPI-SIGN": signature,
                "Content-Type": "application/json"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=body_str) as resp:
                    res = await resp.json()
                    return res['result']['orderId'] if res.get('retCode') == 0 else None

        return None

    async def _place_take_profit_market(self, symbol: str, close_side: str, size: float, tp_price: float) -> Optional[str]:
        """إرسال أمر Take-Profit-Market مع Reduce-Only"""
        import aiohttp
        import hashlib
        import hmac
        import json as json_lib

        if self.exchange.exchange_type.value == "binance":
            timestamp = int(time.time() * 1000)
            params = {
                "symbol": symbol,
                "side": close_side,
                "type": "TAKE_PROFIT_MARKET",
                "stopPrice": str(tp_price),
                "quantity": size,
                "reduceOnly": "true",
                "workingType": "MARK_PRICE",
                "timestamp": timestamp
            }
            query_string = "&".join(f"{k}={v}" for k, v in params.items())
            signature = hmac.new(self.exchange.api_secret.encode(), query_string.encode(), hashlib.sha256).hexdigest()
            url = f"{self.exchange.base_url}/fapi/v1/order?{query_string}&signature={signature}"
            headers = {"X-MBX-APIKEY": self.exchange.api_key}

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as resp:
                    res = await resp.json()
                    return str(res['orderId']) if 'orderId' in res else None

        elif self.exchange.exchange_type.value == "bybit":
            timestamp = str(int(time.time() * 1000))
            recv_window = "5000"
            body = {
                "category": "linear",
                "symbol": symbol,
                "side": close_side,
                "orderType": "Market",
                "qty": str(size),
                "triggerPrice": str(tp_price),
                "triggerDirection": 1 if close_side == "SELL" else 2,
                "reduceOnly": True,
                "triggerBy": "MarkPrice"
            }
            body_str = json_lib.dumps(body)
            sign_str = timestamp + self.exchange.api_key + recv_window + body_str
            signature = hmac.new(self.exchange.api_secret.encode(), sign_str.encode(), hashlib.sha256).hexdigest()
            url = f"{self.exchange.base_url}/v5/order/create"
            headers = {
                "X-BAPI-API-KEY": self.exchange.api_key,
                "X-BAPI-TIMESTAMP": timestamp,
                "X-BAPI-RECV-WINDOW": recv_window,
                "X-BAPI-SIGN": signature,
                "Content-Type": "application/json"
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, data=body_str) as resp:
                    res = await resp.json()
                    return res['result']['orderId'] if res.get('retCode') == 0 else None

        return None

    def should_exit_early(
        self,
        symbol: str,
        current_z: float,
        target_z: float = 0.0
    ) -> Tuple[bool, str]:
        """
        التحقق المنطقي المصحح للخروج المبكر الذكي مع فترة تأكيد (Hysteresis):
        - LONG (دخلنا عند Z سالب): نربح عندما يرتفع Z إلى المتوسط (current_z >= target_z)
        - SHORT (دخلنا عند Z موجب): نربح عندما يهبط Z إلى المتوسط (current_z <= -target_z)
        """
        if symbol not in self.active_exits:
            return False, ""

        exit_info = self.active_exits[symbol]
        now = time.time()
        signal_triggered = False
        exit_reason = ""

        # 1. فحص الانعكاس الإحصائي (Z-Score Mean Reversion)
        if exit_info.side == "LONG":
            if current_z >= target_z:
                signal_triggered = True
                exit_reason = f"Mean Reverted: Long Z reached {current_z:.2f} >= target ({target_z})"
        else:  # SHORT
            if current_z <= -target_z:
                signal_triggered = True
                exit_reason = f"Mean Reverted: Short Z reached {current_z:.2f} <= target ({-target_z})"

        # 2. فحص الخروج الزمني الأقصى (Time Exit)
        if exit_info.time_exit_timestamp and now >= exit_info.time_exit_timestamp:
            signal_triggered = True
            exit_reason = f"Time-Stop: Max holding period of {exit_info.time_exit_seconds}s reached"

        # 3. تطبيق فلتر Hysteresis لمنع الخروج الكاذب السريع
        if signal_triggered:
            if exit_info.exit_signal_start_time is None:
                exit_info.exit_signal_start_time = now
                logger.debug(f"⏳ Hysteresis timer started for {symbol}: {exit_reason}")
                return False, f"Hysteresis started: {exit_reason}"

            elapsed = now - exit_info.exit_signal_start_time
            if elapsed >= exit_info.hysteresis_seconds:
                logger.info(f"🎯 Hysteresis confirmed ({elapsed:.1f}s) for {symbol}: {exit_reason}")
                return True, exit_reason
            else:
                return False, f"Waiting for hysteresis ({elapsed:.1f}/{exit_info.hysteresis_seconds}s)"
        else:
            # إعادة تصفير المؤقت إذا تذبذب السعر خارج منطقة الخروج
            if exit_info.exit_signal_start_time is not None:
                exit_info.exit_signal_start_time = None

        return False, ""

    async def handle_order_fill(self, symbol: str, filled_order_id: str):
        """إلغاء الأمر المقابل فور تنفيذ أحد الأمرين في المنصة (OCO Cleanup)"""
        if symbol not in self.active_exits:
            return

        exit_info = self.active_exits[symbol]
        logger.info(f"🔔 Order fill received for {symbol}: ID {filled_order_id}")

        if filled_order_id == exit_info.tp_order_id and exit_info.sl_order_id:
            logger.info(f"💰 Take-Profit filled! Canceling protective SL {exit_info.sl_order_id}...")
            await self.exchange.cancel_order(symbol, exit_info.sl_order_id)
        elif filled_order_id == exit_info.sl_order_id and exit_info.tp_order_id:
            logger.info(f"🛡️ Stop-Loss filled! Canceling pending TP {exit_info.tp_order_id}...")
            await self.exchange.cancel_order(symbol, exit_info.tp_order_id)

        del self.active_exits[symbol]
        self.state_db.remove_position(symbol)

    async def cancel_exit_orders(self, symbol: str):
        """إلغاء جميع الأوامر المعلقة على المنصة عند إغلاق الصفقة مبكراً"""
        if symbol not in self.active_exits:
            return
        exit_info = self.active_exits[symbol]
        if exit_info.tp_order_id:
            await self.exchange.cancel_order(symbol, exit_info.tp_order_id)
        if exit_info.sl_order_id:
            await self.exchange.cancel_order(symbol, exit_info.sl_order_id)
        del self.active_exits[symbol]
        logger.info(f"🧹 Cleaned up and canceled all exit orders for {symbol}")

    def get_active_exits(self) -> Dict[str, ExitOrders]:
        return self.active_exits.copy()
