/**
 * OMEGA QuantBrain - Point-in-Time Database
 * ============================================
 * قاعدة بيانات تاريخية دقيقة تحفظ كل نقطة سعرية بطابع زمني
 * 
 * المميزات:
 *   1. ✅ حفظ كل tick بطابع زمني دقيق (timestamp)
 *   2. ✅ منع Look-Ahead Bias (لا بيانات مستقبلية)
 *   3. ✅ استرجاع بنافذة زمنية محددة
 *   4. ✅ منع استخدام آخر شمعة غير مغلقة
 *   5. ✅ تخزين دائم في JSON مع WAL atomic writes
 *   6. ✅ تنظيف تلقائي للبيانات القديمة
 *   7. ✅ إحصائيات شاملة للبيانات المحفوظة
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PriceTick {
  symbol: string;
  price: number;
  timestamp: number;        // Unix timestamp (ms)
  source: 'BINANCE' | 'BYBIT' | 'COINGECKO';
  volume?: number;          // حجم التداول (اختياري)
  spread?: number;          // السبريد (اختياري)
}

export interface Candle {
  symbol: string;
  timestamp: number;        // وقت الفتح
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;        // هل الشمعة مغلقة؟
}

export interface QueryOptions {
  symbol: string;
  startTime: number;
  endTime: number;
  maxPoints?: number;       // الحد الأقصى للنقاط
  includeIncomplete?: boolean;  // تضمين الشموع غير المكتملة (افتراضي: false)
}

export interface DatabaseStats {
  totalSymbols: number;
  totalTicks: number;
  totalCandles: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  storageSizeMb: number;
  lastCleanup: number | null;
}

export class PointInTimeDatabase {
  private dbPath: string;
  private backupPath: string;
  
  // التخزين في الذاكرة (للوصول السريع)
  private priceTicks: Map<string, PriceTick[]> = new Map();
  private candles: Map<string, Candle[]> = new Map();
  
  // الإعدادات
  private maxTicksPerSymbol: number = 10000;
  private maxCandlesPerSymbol: number = 5000;
  private retentionDays: number = 30;  // الاحتفاظ بالبيانات 30 يوم
  private lastCleanup: number | null = null;
  private lastSave: number = 0;
  private saveIntervalMs: number = 60000;  // حفظ كل دقيقة
  
  // القفل (لمنع الكتابة المتزامنة)
  private isSaving: boolean = false;

  constructor(dbPath: string = './data/point_in_time_db.json') {
    this.dbPath = dbPath;
    this.backupPath = `${dbPath}.backup`;
    
    // إنشاء المجلد إذا لم يكن موجوداً
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err: any) {
        console.warn('[PointInTime] Directory creation warning:', err.message);
      }
    }
    
    this.load();
    
    // الحفظ الدوري
    setInterval(() => this.autoSave(), this.saveIntervalMs);
    
    // التنظيف الدوري (كل ساعة)
    setInterval(() => this.cleanup(), 3600000);
    
    console.log('✅ PointInTimeDatabase initialized');
    console.log(`   Path: ${this.dbPath}`);
    console.log(`   Retention: ${this.retentionDays} days`);
    console.log(`   Max ticks/symbol: ${this.maxTicksPerSymbol}`);
  }

  // ==================== حفظ البيانات ====================

  /**
   * حفظ نقطة سعرية واحدة
   */
  addTick(tick: PriceTick): void {
    // التحقق من صحة البيانات
    if (!this.isValidTick(tick)) {
      return;
    }
    
    if (!this.priceTicks.has(tick.symbol)) {
      this.priceTicks.set(tick.symbol, []);
    }
    
    const ticks = this.priceTicks.get(tick.symbol)!;
    ticks.push(tick);
    
    // تحديد الحجم الأقصى
    if (ticks.length > this.maxTicksPerSymbol) {
      ticks.splice(0, ticks.length - this.maxTicksPerSymbol);
    }
  }

  /**
   * حفظ نقاط سعرية متعددة (دفعة واحدة)
   */
  addTicks(ticks: PriceTick[]): void {
    const validTicks = ticks.filter(t => this.isValidTick(t));
    
    if (validTicks.length === 0) return;
    
    // تجميع حسب الرمز
    const grouped = new Map<string, PriceTick[]>();
    for (const tick of validTicks) {
      if (!grouped.has(tick.symbol)) {
        grouped.set(tick.symbol, []);
      }
      grouped.get(tick.symbol)!.push(tick);
    }
    
    // إضافة كل مجموعة
    for (const [symbol, symbolTicks] of grouped) {
      if (!this.priceTicks.has(symbol)) {
        this.priceTicks.set(symbol, []);
      }
      this.priceTicks.get(symbol)!.push(...symbolTicks);
      
      const current = this.priceTicks.get(symbol)!;
      if (current.length > this.maxTicksPerSymbol) {
        current.splice(0, current.length - this.maxTicksPerSymbol);
      }
    }
  }

  /**
   * حفظ شمعة واحدة
   */
  addCandle(candle: Candle): void {
    // التحقق من صحة الشمعة
    if (!this.isValidCandle(candle)) {
      return;
    }
    
    if (!this.candles.has(candle.symbol)) {
      this.candles.set(candle.symbol, []);
    }
    
    const candles = this.candles.get(candle.symbol)!;
    
    // استبدال إذا كانت موجودة، أو إضافة جديدة
    const existingIndex = candles.findIndex(c => c.timestamp === candle.timestamp);
    if (existingIndex >= 0) {
      candles[existingIndex] = candle;
    } else {
      candles.push(candle);
      // ترتيب حسب الوقت
      candles.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    // تحديد الحجم الأقصى
    if (candles.length > this.maxCandlesPerSymbol) {
      candles.splice(0, candles.length - this.maxCandlesPerSymbol);
    }
  }

  /**
   * حفظ شموع متعددة
   */
  addCandles(candles: Candle[]): void {
    for (const candle of candles) {
      this.addCandle(candle);
    }
  }

  // ==================== استرجاع البيانات ====================

  /**
   * استرجاع النقاط السعرية بنافذة زمنية
   * ⚠️ مهم: لا يعيد نقاطاً مستقبلية (Look-Ahead Protection)
   */
  getTicks(options: QueryOptions): PriceTick[] {
    const { symbol, startTime, endTime, maxPoints = 1000 } = options;
    
    if (!this.priceTicks.has(symbol)) {
      return [];
    }
    
    const ticks = this.priceTicks.get(symbol)!;
    const now = Date.now();
    
    // 🛡️ حماية من Look-Ahead: لا بيانات بعد الوقت الحالي
    const safeEndTime = Math.min(endTime, now);
    
    return ticks
      .filter(t => t.timestamp >= startTime && t.timestamp <= safeEndTime)
      .slice(-maxPoints);
  }

  /**
   * استرجاع الشموع بنافذة زمنية
   * ⚠️ مهم: يستبعد الشموع غير المغلقة افتراضياً
   */
  getCandles(options: QueryOptions): Candle[] {
    const { symbol, startTime, endTime, maxPoints = 500, includeIncomplete = false } = options;
    
    if (!this.candles.has(symbol)) {
      return [];
    }
    
    const candles = this.candles.get(symbol)!;
    const now = Date.now();
    
    // 🛡️ حماية من Look-Ahead
    const safeEndTime = Math.min(endTime, now);
    
    let result = candles.filter(c => 
      c.timestamp >= startTime && 
      c.closeTime <= safeEndTime
    );
    
    // 🛡️ استبعاد الشموع غير المكتملة (إلا إذا طُلب صراحة)
    if (!includeIncomplete) {
      result = result.filter(c => c.isClosed);
    }
    
    return result.slice(-maxPoints);
  }

  /**
   * استرجاع آخر سعر معروف لرمز معين
   */
  getLastPrice(symbol: string): PriceTick | null {
    const ticks = this.priceTicks.get(symbol);
    if (!ticks || ticks.length === 0) return null;
    return ticks[ticks.length - 1];
  }

  /**
   * استرجاع آخر شمعة مغلقة فقط
   * ⚠️ هذه الدالة الأهم - تضمن عدم استخدام بيانات غير مكتملة
   */
  getLastClosedCandle(symbol: string): Candle | null {
    const candles = this.candles.get(symbol);
    if (!candles || candles.length === 0) return null;
    
    // البحث من الأحدث للأقدم عن شمعة مغلقة
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].isClosed) {
        return candles[i];
      }
    }
    
    return null;
  }

  /**
   * استرجاع شموع مغلقة فقط (لـ Backtesting)
   */
  getClosedCandlesOnly(symbol: string, limit: number = 100): Candle[] {
    const candles = this.candles.get(symbol);
    if (!candles) return [];
    
    return candles
      .filter(c => c.isClosed)
      .slice(-limit);
  }

  // ==================== التحقق من صحة البيانات ====================

  /**
   * التحقق من صحة نقطة سعرية
   */
  private isValidTick(tick: PriceTick): boolean {
    if (!tick.symbol || typeof tick.symbol !== 'string') return false;
    if (!tick.price || typeof tick.price !== 'number' || tick.price <= 0) return false;
    if (!tick.timestamp || typeof tick.timestamp !== 'number') return false;
    if (isNaN(tick.price) || !isFinite(tick.price)) return false;
    
    // التأكد من أن الطابع الزمني ليس مستقبلياً (مع هامش 5 ثوانٍ)
    if (tick.timestamp > Date.now() + 5000) return false;
    
    return true;
  }

  /**
   * التحقق من صحة شمعة
   */
  private isValidCandle(candle: Candle): boolean {
    if (!candle.symbol || typeof candle.symbol !== 'string') return false;
    if (!candle.timestamp || typeof candle.timestamp !== 'number') return false;
    
    // التحقق من الأسعار
    const prices = [candle.open, candle.high, candle.low, candle.close];
    for (const p of prices) {
      if (typeof p !== 'number' || p <= 0 || isNaN(p) || !isFinite(p)) {
        return false;
      }
    }
    
    // التحقق من المنطق: high >= low, high >= open/close, low <= open/close
    if (candle.high < candle.low) return false;
    if (candle.high < candle.open || candle.high < candle.close) return false;
    if (candle.low > candle.open || candle.low > candle.close) return false;
    
    // التأكد من أن الشمعة ليست مستقبلية
    if (candle.timestamp > Date.now() + 5000) return false;
    
    return true;
  }

  // ==================== الحفظ والتحميل ====================

  /**
   * حفظ إلى القرص (مع حماية من الكتابة المتزامنة)
   */
  async save(): Promise<boolean> {
    if (this.isSaving) {
      return false;
    }
    
    this.isSaving = true;
    
    try {
      const data = {
        version: '1.0',
        savedAt: Date.now(),
        priceTicks: Object.fromEntries(this.priceTicks),
        candles: Object.fromEntries(this.candles),
        lastCleanup: this.lastCleanup
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      
      // كتابة ذرية (نكتب في ملف مؤقت أولاً ثم نعيد التسمية)
      const tempPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tempPath, jsonString, 'utf8');
      
      // إنشاء نسخة احتياطية قبل الاستبدال
      if (fs.existsSync(this.dbPath)) {
        fs.copyFileSync(this.dbPath, this.backupPath);
      }
      
      // الاستبدال الذري
      fs.renameSync(tempPath, this.dbPath);
      
      this.lastSave = Date.now();
      this.isSaving = false;
      
      return true;
      
    } catch (err: any) {
      this.isSaving = false;
      console.error('[PointInTime] ❌ Save failed:', err.message);
      return false;
    }
  }

  /**
   * حفظ تلقائي (يُستدعى دورياً)
   */
  private autoSave(): void {
    this.save().catch(err => {
      console.error('[PointInTime] Auto-save failed:', err.message);
    });
  }

  /**
   * تحميل من القرص
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return;
      }
      
      const raw = fs.readFileSync(this.dbPath, 'utf8');
      const data = JSON.parse(raw);
      
      // تحميل النقاط السعرية
      if (data.priceTicks) {
        for (const [symbol, ticks] of Object.entries(data.priceTicks)) {
          this.priceTicks.set(symbol, ticks as PriceTick[]);
        }
      }
      
      // تحميل الشموع
      if (data.candles) {
        for (const [symbol, candles] of Object.entries(data.candles)) {
          this.candles.set(symbol, candles as Candle[]);
        }
      }
      
      this.lastCleanup = data.lastCleanup || null;
      
      const totalTicks = Array.from(this.priceTicks.values()).reduce((sum, t) => sum + t.length, 0);
      const totalCandles = Array.from(this.candles.values()).reduce((sum, c) => sum + c.length, 0);
      
      console.log(`[PointInTime] ✅ Loaded: ${totalTicks} ticks, ${totalCandles} candles`);
      
    } catch (err: any) {
      console.error('[PointInTime] ❌ Load failed:', err.message);
      
      // محاولة التحميل من النسخة الاحتياطية
      if (fs.existsSync(this.backupPath)) {
        try {
          const raw = fs.readFileSync(this.backupPath, 'utf8');
          const data = JSON.parse(raw);
          
          if (data.priceTicks) {
            for (const [symbol, ticks] of Object.entries(data.priceTicks)) {
              this.priceTicks.set(symbol, ticks as PriceTick[]);
            }
          }
          if (data.candles) {
            for (const [symbol, candles] of Object.entries(data.candles)) {
              this.candles.set(symbol, candles as Candle[]);
            }
          }
          
          console.log('[PointInTime] ✅ Loaded from backup successfully');
        } catch (backupErr) {
          console.error('[PointInTime] ❌ Backup load also failed');
        }
      }
    }
  }

  // ==================== التنظيف والصيانة ====================

  /**
   * تنظيف البيانات القديمة (أكبر من فترة الاحتفاظ)
   */
  cleanup(): void {
    const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    let removedTicks = 0;
    let removedCandles = 0;
    
    // تنظيف النقاط السعرية
    for (const [symbol, ticks] of this.priceTicks) {
      const originalLength = ticks.length;
      const filtered = ticks.filter(t => t.timestamp >= cutoffTime);
      removedTicks += originalLength - filtered.length;
      
      if (filtered.length === 0) {
        this.priceTicks.delete(symbol);
      } else {
        this.priceTicks.set(symbol, filtered);
      }
    }
    
    // تنظيف الشموع
    for (const [symbol, candles] of this.candles) {
      const originalLength = candles.length;
      const filtered = candles.filter(c => c.timestamp >= cutoffTime);
      removedCandles += originalLength - filtered.length;
      
      if (filtered.length === 0) {
        this.candles.delete(symbol);
      } else {
        this.candles.set(symbol, filtered);
      }
    }
    
    this.lastCleanup = Date.now();
    
    if (removedTicks > 0 || removedCandles > 0) {
      console.log(`[PointInTime] 🧹 Cleanup: removed ${removedTicks} ticks, ${removedCandles} candles`);
    }
  }

  // ==================== الإحصائيات ====================

  /**
   * إحصائيات شاملة لقاعدة البيانات
   */
  getStats(): DatabaseStats {
    const totalTicks = Array.from(this.priceTicks.values()).reduce((sum, t) => sum + t.length, 0);
    const totalCandles = Array.from(this.candles.values()).reduce((sum, c) => sum + c.length, 0);
    
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    
    // إيجاد أقدم وأحدث طابع زمني
    for (const ticks of this.priceTicks.values()) {
      if (ticks.length > 0) {
        const min = Math.min(...ticks.map(t => t.timestamp));
        const max = Math.max(...ticks.map(t => t.timestamp));
        if (oldestTimestamp === null || min < oldestTimestamp) oldestTimestamp = min;
        if (newestTimestamp === null || max > newestTimestamp) newestTimestamp = max;
      }
    }
    
    // حجم التخزين
    let storageSizeMb = 0;
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      storageSizeMb = stats.size / (1024 * 1024);
    }
    
    return {
      totalSymbols: this.priceTicks.size,
      totalTicks,
      totalCandles,
      oldestTimestamp,
      newestTimestamp,
      storageSizeMb: parseFloat(storageSizeMb.toFixed(2)),
      lastCleanup: this.lastCleanup
    };
  }

  /**
   * قائمة الرموز المتاحة
   */
  getAvailableSymbols(): string[] {
    const symbols = new Set<string>();
    for (const symbol of this.priceTicks.keys()) symbols.add(symbol);
    for (const symbol of this.candles.keys()) symbols.add(symbol);
    return Array.from(symbols);
  }

  // ==================== التدمير ====================

  /**
   * حفظ وإغلاق بشكل نظيف
   */
  async destroy(): Promise<void> {
    await this.save();
    console.log('[PointInTime] Database closed');
  }
}
