// src/index.ts
export * from './brain/index';
export * from './orchestrator';
export { DataBuffer } from './data/data-buffer';
export { RegimeDetector } from './market/regime-detector';
export * from './security/security';
export * from './config/config';

import { SecurityManager } from './security/security';
import { QuantumTradingOrchestrator } from './orchestrator';

/**
 * العقل الكمومي الحي - النظام الكامل
 */
export class QuantumTradingSystem {
  private orchestrator: QuantumTradingOrchestrator;

  constructor() {
    this.orchestrator = QuantumTradingOrchestrator.getInstance();
  }

  /**
   * 🔐 الوضع: إعداد الأمان
   */
  async setup(): Promise<void> {
    console.log('\n🔐 إعداد الأمان والتشفير العالي...\n');
    const apiKey = process.env.EXCHANGE_API_KEY;
    const apiSecret = process.env.EXCHANGE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.log('ℹ️ لم يتم العثور على مفاتيح بيئة EXCHANGE_API_KEY / EXCHANGE_API_SECRET.');
      return;
    }
    
    const security = new SecurityManager();
    security.saveCredentials(apiKey, apiSecret);
    console.log('✅ تم حفظ وتشفير الاعتمادات بنجاح!');
  }

  /**
   * تشغيل النظام
   */
  async run(): Promise<void> {
    console.log('🚀 تشغيل العقل الكمومي الشامل...');
    await this.orchestrator.start();
  }
}

// إذا تم تشغيل الملف مباشرة عبر node / tsx
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('src/index')) {
  const system = new QuantumTradingSystem();
  system.run().catch(err => {
    console.error('❌ Error in QuantumTradingSystem:', err);
  });
}
