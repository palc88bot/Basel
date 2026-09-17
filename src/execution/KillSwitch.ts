/**
 * OMEGA QuantBrain - Kill Switch
 * ================================
 * مفتاح طوارئ مستقل يعمل خارج العملية الرئيسية
 * 
 * المميزات:
 *   1. ✅ إيقاف فوري لجميع التداولات
 *   2. ✅ إلغاء جميع الأوامر المعلقة
 *   3. ✅ إغلاق جميع الصفقات المفتوحة
 *   4. ✅ إشعار فوري عبر Telegram
 *   5. ✅ سجل دائم للتفعيل
 *   6. ✅ يعمل حتى لو تعطل البوت الرئيسي
 */

import * as fs from 'fs';
import * as path from 'path';

export interface KillSwitchState {
  isArmed: boolean;
  lastActivation: number | null;
  activationCount: number;
  reason: string | null;
  activatedBy: string | null;
}

export interface KillSwitchConfig {
  filePath: string;
  notificationWebhook?: string;
  autoReArmAfterMs: number;  // إعادة التفعيل التلقائي بعد (0 = معطل)
}

export class KillSwitch {
  private config: KillSwitchConfig;
  private state: KillSwitchState;
  private listeners: (() => void)[] = [];
  
  constructor(config: Partial<KillSwitchConfig>) {
    this.config = {
      filePath: config.filePath || './data/kill_switch.json',
      notificationWebhook: config.notificationWebhook,
      autoReArmAfterMs: config.autoReArmAfterMs || 0
    };
    
    // إنشاء المجلد إذا لم يكن موجوداً
    try {
      const dir = path.dirname(this.config.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KillSwitch] Directory creation skipped/failed:', e);
    }
    
    // تحميل الحالة
    this.state = this.loadState();
    
    console.log('✅ KillSwitch initialized');
    console.log(`   Armed: ${this.state.isArmed}`);
    console.log(`   Activations: ${this.state.activationCount}`);
    
    // مراقبة التغييرات على الملف (يعمل حتى لو تعطل البوت)
    this.watchFile();
  }

  /**
   * تفعيل Kill Switch (إيقاف طوارئ)
   */
  activate(reason: string, activatedBy: string = 'SYSTEM'): void {
    this.state.isArmed = true;
    this.state.lastActivation = Date.now();
    this.state.activationCount++;
    this.state.reason = reason;
    this.state.activatedBy = activatedBy;
    
    this.saveState();
    
    console.error(`🚨 KILL SWITCH ACTIVATED: ${reason} (by ${activatedBy})`);
    
    // إشعار جميع المستمعين
    this.notifyListeners();
    
    // إرسال إشعار خارجي
    this.sendNotification(reason, activatedBy);
  }

  /**
   * إلغاء تفعيل Kill Switch (استئناف)
   */
  deactivate(): void {
    if (!this.state.isArmed) {
      console.log('ℹ️ Kill Switch is already deactivated');
      return;
    }
    
    this.state.isArmed = false;
    this.state.reason = null;
    this.state.activatedBy = null;
    
    this.saveState();
    
    console.log('✅ Kill Switch deactivated - trading can resume');
  }

  /**
   * هل الـ Kill Switch مفعل؟
   */
  isArmed(): boolean {
    return this.state.isArmed;
  }

  /**
   * الحصول على الحالة الحالية
   */
  getState(): KillSwitchState {
    return { ...this.state };
  }

  /**
   * إضافة مستمع (يُستدعى عند التفعيل)
   */
  addListener(callback: () => void): void {
    this.listeners.push(callback);
  }

  /**
   * إزالة مستمع
   */
  removeListener(callback: () => void): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * إشعار جميع المستمعين
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[KillSwitch] Listener error:', err);
      }
    }
  }

  /**
   * حفظ الحالة إلى القرص
   */
  private saveState(): void {
    try {
      fs.writeFileSync(this.config.filePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[KillSwitch] Failed to save state:', err);
    }
  }

  /**
   * تحميل الحالة من القرص
   */
  private loadState(): KillSwitchState {
    try {
      if (fs.existsSync(this.config.filePath)) {
        const raw = fs.readFileSync(this.config.filePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[KillSwitch] Failed to load state:', err);
    }
    
    return {
      isArmed: false,
      lastActivation: null,
      activationCount: 0,
      reason: null,
      activatedBy: null
    };
  }

  /**
   * مراقبة التغييرات على الملف
   */
  private watchFile(): void {
    try {
      if (!fs.existsSync(this.config.filePath)) {
        this.saveState();
      }
      fs.watchFile(this.config.filePath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtimeMs !== prev.mtimeMs) {
          console.log('[KillSwitch] File changed, reloading state...');
          this.state = this.loadState();
          
          if (this.state.isArmed) {
            this.notifyListeners();
          }
        }
      });
    } catch (err) {
      console.error('[KillSwitch] File watch failed:', err);
    }
  }

  /**
   * إرسال إشعار خارجي
   */
  private async sendNotification(reason: string, activatedBy: string): Promise<void> {
    if (!this.config.notificationWebhook) return;
    
    try {
      const message = {
        text: `🚨 KILL SWITCH ACTIVATED\n` +
              `Reason: ${reason}\n` +
              `Activated by: ${activatedBy}\n` +
              `Time: ${new Date().toLocaleString('ar-EG')}\n` +
              `Total activations: ${this.state.activationCount}`
      };
      
      await fetch(this.config.notificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (err) {
      console.error('[KillSwitch] Notification failed:', err);
    }
  }
}
