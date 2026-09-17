"""
OMEGA Bot - Smart Pair Selector V2 (Quant Institutional Standard)
==================================================================
منتقي الأزواج الذكي مع فحوصات الصحة العقلية الصارمة وقواطع الدوائر الإحصائية

المميزات:
  1. ✅ فحص صارم ضد NaN/Inf في جميع القيم الرقمية
  2. ✅ قاطع دائرة إحصائي لـ Z-Score (|Z| > 10 = خطأ بيانات، |Z| > 4.0 = حدث بجعة سوداء)
  3. ✅ فحص نصف العمر OU Half-Life عبر انحدار AR(1) الدقيق (60-1800 ثانية)
  4. ✅ فحص السيولة المؤسسية (50M+ دولار)
  5. ✅ فحص القائمة البيضاء الصارمة للعملات المسموحة وتفادي العملات المستقرة
  6. ✅ ترتيب الفرص بناءً على Priority Score الإحصائي

التكامل:
  - StateDatabase: لحفظ آخر Z-Score
  - ExchangeAdapter: لجلب بيانات السوق الحقيقية
  - SafeCoinFilter: للتحقق الأمني من العملات
"""

import asyncio
import math
import logging
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime, timezone
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)


# ==================== فحوصات الصحة العقلية (Sanity Checks) ====================

class SanityChecks:
    """
    فحوصات الصحة العقلية للبيانات الإحصائية
    تمنع البوت من اتخاذ قرارات تداولية بناءً على بيانات فاسدة أو غير منطقية
    """
    
    # حدود آمنة للمؤشرات الإحصائية
    MAX_Z_SCORE_CIRCUIT_BREAKER = 10.0   # أي قيمة فوق 10 = خطأ بيانات صريح
    MAX_Z_SCORE_TRADEABLE = 4.0          # أي قيمة فوق 4 = بجعة سوداء / تذبذب مفرط
    MIN_HALF_LIFE = 60.0                 # ثانية (أقل من ذلك ضوضاء مفرطة)
    MAX_HALF_LIFE = 1800.0               # ثانية (30 دقيقة كحد أقصى للارتداد)
    MIN_VOLUME_USD = 50_000_000.0        # 50 مليون دولار كحد أدنى للسيولة
    MAX_SPREAD_PERCENT = 0.15            # 0.15% كحد أقصى للفارق السعري
    
    @staticmethod
    def is_valid_number(value: Any, name: str = "value", allow_negative: bool = False) -> bool:
        """
        فحص صارم ضد القيم غير الرقمية، الفارغة، أو غير المنطقية
        
        Args:
            value: القيمة المراد فحصها
            name: اسم القيمة (للتسجيل)
            allow_negative: السماح بالقيم السالبة (مثل Z-Score والعوائد)
        
        Returns:
            True إذا كانت القيمة رقمية صالحة
        """
        if value is None:
            logger.warning(f"⛔ REJECTED: {name} is None")
            return False
        
        try:
            val_float = float(value)
        except (TypeError, ValueError):
            logger.warning(f"⛔ REJECTED: {name} is not a valid numeric type ({value})")
            return False
        
        # فحص NaN
        if math.isnan(val_float):
            logger.warning(f"⛔ REJECTED: {name} is NaN")
            return False
        
        # فحص Inf
        if math.isinf(val_float):
            logger.warning(f"⛔ REJECTED: {name} is Infinity")
            return False
        
        # فحص الأرقام السالبة للكميات التي يجب أن تكون موجبة حصراً (الحجم، السعر، نصف العمر)
        if not allow_negative and val_float < 0:
            logger.warning(f"⛔ REJECTED: {name} is strictly non-negative ({val_float})")
            return False
        
        return True
    
    @classmethod
    def validate_z_score(cls, z_score: float) -> bool:
        """
        قاطع دائرة إحصائي لـ Z-Score
        يسمح بالقيم السالبة للإشارة إلى فرص الشراء Long ويمنع القيم الشاذة الفاسدة
        """
        if not cls.is_valid_number(z_score, "Z-Score", allow_negative=True):
            return False
        
        abs_z = abs(z_score)
        
        if abs_z > cls.MAX_Z_SCORE_CIRCUIT_BREAKER:
            logger.error(
                f"🚨 DATA CORRUPTION: Absurd Z-Score ({z_score:.2f}). "
                f"Max absolute allowed: {cls.MAX_Z_SCORE_CIRCUIT_BREAKER}. Hard circuit breaker tripped."
            )
            return False
        
        if abs_z > cls.MAX_Z_SCORE_TRADEABLE:
            logger.warning(
                f"⚠️ BLACK SWAN / OVERFLOW: Z-Score ({z_score:.2f}) exceeds safe trading threshold ({cls.MAX_Z_SCORE_TRADEABLE})."
            )
            return False
        
        return True
    
    @classmethod
    def validate_half_life(cls, half_life: float) -> bool:
        """فحص نصف العمر بالثواني"""
        if not cls.is_valid_number(half_life, "Half-Life", allow_negative=False):
            return False
        
        if not (cls.MIN_HALF_LIFE <= half_life <= cls.MAX_HALF_LIFE):
            logger.warning(
                f"⛔ REJECTED: Half-Life {half_life:.2f}s out of safe mean-reverting range "
                f"[{cls.MIN_HALF_LIFE}-{cls.MAX_HALF_LIFE}s]"
            )
            return False
        
        return True
    
    @classmethod
    def validate_volume(cls, volume_usd: float) -> bool:
        """فحص حجم التداول اليومي"""
        if not cls.is_valid_number(volume_usd, "Volume", allow_negative=False):
            return False
        
        if volume_usd < cls.MIN_VOLUME_USD:
            logger.warning(
                f"⛔ REJECTED: Low liquidity volume ${volume_usd/1_000_000:.2f}M "
                f"(Minimum required: ${cls.MIN_VOLUME_USD/1_000_000:.2f}M)"
            )
            return False
        
        return True
    
    @classmethod
    def validate_spread(cls, spread_percent: float) -> bool:
        """فحص الفارق السعري بالنسبة المئوية"""
        if not cls.is_valid_number(spread_percent, "Spread", allow_negative=False):
            return False
        
        if spread_percent > cls.MAX_SPREAD_PERCENT:
            logger.warning(
                f"⛔ REJECTED: High spread {spread_percent:.4f}% "
                f"(Maximum allowed: {cls.MAX_SPREAD_PERCENT}%)"
            )
            return False
        
        return True


# ==================== فلتر العملات الآمنة (SafeCoinFilter) ====================

class SafeCoinFilter:
    """فلتر العملات الآمنة والمؤسسية للتداول بعقود الفيوتشرز"""
    
    ALLOWED_COINS = [
        "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT",
        "AVAXUSDT", "LINKUSDT", "UNIUSDT", "DOTUSDT",
        "ADAUSDT", "XRPUSDT", "LTCUSDT", "ATOMUSDT",
        "NEARUSDT", "SUIUSDT", "APTUSDT", "FETUSDT",
        "ARBUSDT", "OPUSDT", "INJUSDT", "TIAUSDT",
        "RENDERUSDT", "SEIUSDT", "FTMUSDT", "TONUSDT", "AAVEUSDT"
    ]
    
    STABLECOINS = {
        "USDT", "USDC", "DAI", "BUSD", "TUSD", "FDUSD", "PYUSD", "USD", "USDE", "USDD"
    }
    
    def __init__(self, min_volume_usd: float = 50_000_000.0, max_spread_pct: float = 0.15):
        self.min_volume_usd = min_volume_usd
        self.max_spread_pct = max_spread_pct
        self.allowed_symbols = set(self.ALLOWED_COINS)
        logger.info(f"✅ SafeCoinFilter initialized with {len(self.allowed_symbols)} verified whitelist assets.")
    
    def is_safe(self, symbol: str, volume_24h: float, price: float, spread_pct: float = 0.02) -> Tuple[bool, str]:
        """
        التحقق الصارم من أهلية العملة للتداول
        Returns: (is_safe: bool, reason: str)
        """
        # 1. فحص العملات المستقرة
        base_asset = symbol.replace("USDT", "").replace("USDC", "").upper()
        if base_asset in self.STABLECOINS:
            return False, f"STABLECOIN ({symbol})"
        
        # 2. فحص القائمة البيضاء المؤسسية
        if symbol not in self.allowed_symbols:
            return False, f"NOT_IN_WHITELIST ({symbol})"
        
        # 3. فحص الأرقام والسيولة
        if not SanityChecks.is_valid_number(price, f"{symbol} price", allow_negative=False) or price <= 0:
            return False, f"INVALID_PRICE ({price})"
        
        if not SanityChecks.validate_volume(volume_24h):
            return False, f"LOW_VOLUME (${volume_24h/1_000_000:.1f}M < ${self.min_volume_usd/1_000_000:.0f}M)"
        
        # 4. فحص السبريد
        if not SanityChecks.validate_spread(spread_pct):
            return False, f"HIGH_SPREAD ({spread_pct:.3f}%)"
        
        return True, "PASSED_SAFE_FILTER"


# ==================== منتقي الأزواج الذكي (SmartPairSelector) ====================

@dataclass
class PairEvaluation:
    """نتيجة تقييم دقيقة لكل زوج عملات"""
    symbol: str
    is_valid: bool
    status_group: str          # 'READY' | 'PREPARED' | 'BACKGROUND'
    signal: str                # 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'
    z_score: float = 0.0
    half_life: float = 0.0
    volume_24h: float = 0.0
    price: float = 0.0
    priority_score: float = 0.0
    rejection_reason: str = ""
    timestamp: str = ""
    
    @property
    def should_trade(self) -> bool:
        """هل تنطبق على الزوج شروط التنفيذ الفوري؟"""
        return self.is_valid and self.status_group == 'READY' and abs(self.z_score) >= 1.8


class SmartPairSelector:
    """
    منتقي الأزواج الكمي المؤسسي مع تقييم شامل لجميع الأزواج وفرزها
    """
    
    def __init__(
        self,
        safe_filter: Optional[SafeCoinFilter] = None,
        entry_z_threshold: float = 1.8,
        prep_z_threshold: float = 0.8
    ):
        self.safe_filter = safe_filter or SafeCoinFilter()
        self.entry_z_threshold = entry_z_threshold
        self.prep_z_threshold = prep_z_threshold
        logger.info(f"✅ SmartPairSelector V2 ready: entry_z={entry_z_threshold}, prep_z={prep_z_threshold}")
    
    def calculate_half_life_ar1(self, spread_series: List[float]) -> float:
        """
        حساب دقيق لنصف العمر باستخدام انحدار Ornstein-Uhlenbeck AR(1) على بواقي الفارق السعري
        dS_t = lambda * (mu - S_{t-1}) * dt + sigma * dW
        """
        if len(spread_series) < 15:
            return 300.0  # قيمة افتراضية متوازنة
        
        try:
            arr = np.array(spread_series, dtype=float)
            x = arr[:-1]
            y = arr[1:] - arr[:-1]
            
            # الانحدار الخطي البسيط: y = lambda * x + const
            n = len(x)
            sum_x = np.sum(x)
            sum_y = np.sum(y)
            sum_xy = np.sum(x * y)
            sum_x2 = np.sum(x * x)
            
            denom = n * sum_x2 - sum_x * sum_x
            if abs(denom) < 1e-12:
                return 300.0
            
            lambd = (n * sum_xy - sum_x * sum_y) / denom
            
            # إذا كان lambda موجباً فالسلسلة متباعدة (Non-stationary) وليست ذات عودة للمتوسط
            if lambd >= 0:
                return 3600.0
            
            hl = -math.log(2) / lambd
            
            # تقييد النتيجة بين الحدود المنطقية
            return float(max(10.0, min(hl, 7200.0)))
        except Exception as e:
            logger.warning(f"Error computing AR(1) half-life: {e}")
            return 300.0
    
    def calculate_priority_score(self, z_score: float, volume_usd: float, half_life: float) -> float:
        """
        حساب نقاط الأولوية الرياضية لفرز الفرص:
        Priority = |Z| * 2.0 + log10(Volume/10M) * 1.5 + (1800 - HalfLife) / 600
        """
        abs_z = abs(z_score)
        vol_term = math.log10(max(1.0, volume_usd / 10_000_000.0)) * 1.5
        hl_term = max(0.0, (1800.0 - half_life) / 600.0)
        return float(abs_z * 2.0 + vol_term + hl_term)
    
    def evaluate_pair(
        self,
        symbol: str,
        price: float,
        volume_24h: float,
        spread_pct: float,
        spread_history: List[float],
        current_z_score: float
    ) -> PairEvaluation:
        """
        تقييم زوج واحد وتحديد حالته بدقة صارمة:
          - READY: عملة آمنة + حجم كافي + |Z| >= 1.8 + نصف عمر سليم
          - PREPARED: عملة آمنة + 0.8 <= |Z| < 1.8 (تحت المراقبة الحثيثة)
          - BACKGROUND: باقي العملات أو المستبعدة
        """
        now_str = datetime.now(timezone.utc).isoformat()
        
        # 1. فحص أمان العملة
        is_safe, reason = self.safe_filter.is_safe(symbol, volume_24h, price, spread_pct)
        if not is_safe:
            return PairEvaluation(
                symbol=symbol,
                is_valid=False,
                status_group='BACKGROUND',
                signal='NEUTRAL',
                z_score=current_z_score,
                volume_24h=volume_24h,
                price=price,
                rejection_reason=f"⚠️ {reason}",
                timestamp=now_str
            )
        
        # 2. فحص قاطع الدائرة للـ Z-Score
        if not SanityChecks.validate_z_score(current_z_score):
            return PairEvaluation(
                symbol=symbol,
                is_valid=False,
                status_group='BACKGROUND',
                signal='NEUTRAL',
                z_score=current_z_score,
                volume_24h=volume_24h,
                price=price,
                rejection_reason=f"🚨 INVALID_OR_CORRUPTED_Z_SCORE ({current_z_score})",
                timestamp=now_str
            )
        
        # 3. حساب وفحص نصف العمر
        half_life = self.calculate_half_life_ar1(spread_history)
        if not SanityChecks.validate_half_life(half_life):
            return PairEvaluation(
                symbol=symbol,
                is_valid=False,
                status_group='BACKGROUND',
                signal='NEUTRAL',
                z_score=current_z_score,
                half_life=half_life,
                volume_24h=volume_24h,
                price=price,
                rejection_reason=f"⛔ INVALID_HALF_LIFE ({half_life:.0f}s)",
                timestamp=now_str
            )
        
        # 4. التصنيف الإحصائي وفق التوزيع الطبيعي
        abs_z = abs(current_z_score)
        priority_score = self.calculate_priority_score(current_z_score, volume_24h, half_life)
        
        if current_z_score <= -self.entry_z_threshold:
            signal = 'STRONG_BUY' if current_z_score <= -2.2 else 'BUY'
            status_group = 'READY'
        elif current_z_score >= self.entry_z_threshold:
            signal = 'STRONG_SELL' if current_z_score >= 2.2 else 'SELL'
            status_group = 'READY'
        elif abs_z >= self.prep_z_threshold:
            signal = 'NEUTRAL'
            status_group = 'PREPARED'
        else:
            signal = 'NEUTRAL'
            status_group = 'BACKGROUND'
        
        return PairEvaluation(
            symbol=symbol,
            is_valid=True,
            status_group=status_group,
            signal=signal,
            z_score=current_z_score,
            half_life=half_life,
            volume_24h=volume_24h,
            price=price,
            priority_score=priority_score,
            rejection_reason="PASSED_ALL_CHECKS",
            timestamp=now_str
        )
    
    def get_valid_pairs(self, candidates_data: List[Dict[str, Any]]) -> List[PairEvaluation]:
        """
        مسح وتقييم كل العملات المرشحة وفرزها:
        READY (مرتبة حسب أعلى Priority) -> PREPARED -> BACKGROUND
        """
        evaluations = []
        for cand in candidates_data:
            eval_res = self.evaluate_pair(
                symbol=cand['symbol'],
                price=cand.get('price', 0.0),
                volume_24h=cand.get('volume_24h', 0.0),
                spread_pct=cand.get('spread_pct', 0.02),
                spread_history=cand.get('spread_history', []),
                current_z_score=cand.get('z_score', 0.0)
            )
            evaluations.append(eval_res)
        
        # الترتيب المؤسسي: الجاهزة أولاً حسب Priority Score ثم المهيأة ثم المراقبة
        group_order = {'READY': 1, 'PREPARED': 2, 'BACKGROUND': 3}
        evaluations.sort(key=lambda x: (group_order.get(x.status_group, 99), -x.priority_score))
        return evaluations


# ==================== اختبار الوحدة (Unit Tests) ====================

def test_suite():
    print("=== Testing OMEGA Sanity Checks & Quant Brain ===")
    
    # 1. فحص الأرقام
    assert SanityChecks.is_valid_number(1.5, "test") == True
    assert SanityChecks.is_valid_number(float('nan'), "test") == False
    assert SanityChecks.is_valid_number(float('inf'), "test") == False
    assert SanityChecks.is_valid_number(-5.0, "volume", allow_negative=False) == False
    assert SanityChecks.is_valid_number(-2.1, "z_score", allow_negative=True) == True
    
    # 2. قاطع دائرة Z-Score
    assert SanityChecks.validate_z_score(-2.1) == True
    assert SanityChecks.validate_z_score(1.9) == True
    assert SanityChecks.validate_z_score(71.62) == False  # قاطع الدائرة يرفض البيانات الفاسدة
    assert SanityChecks.validate_z_score(-12.0) == False
    
    # 3. فحص نصف العمر
    assert SanityChecks.validate_half_life(350.0) == True
    assert SanityChecks.validate_half_life(25.0) == False  # أقل من 60 ثانية
    assert SanityChecks.validate_half_life(2500.0) == False  # أكثر من 30 دقيقة
    
    # 4. فحص الفلتر
    safe_filter = SafeCoinFilter(min_volume_usd=50_000_000)
    assert safe_filter.is_safe("BTCUSDT", 200_000_000, 68000, 0.01)[0] == True
    assert safe_filter.is_safe("USDT", 1_000_000_000, 1.0, 0.01)[0] == False  # Stablecoin
    assert safe_filter.is_safe("UNKNOWNCOIN", 100_000_000, 1.0, 0.01)[0] == False  # Not whitelisted
    assert safe_filter.is_safe("SOLUSDT", 20_000_000, 140, 0.01)[0] == False  # Low volume (< 50M)
    
    print("✅ All Sanity Checks & Quant Assertions Passed Successfully!")


if __name__ == "__main__":
    test_suite()
