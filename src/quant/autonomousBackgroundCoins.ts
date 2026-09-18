/**
 * Autonomous Background Basket & Coin Engine
 * ========================================================
 * محرك حقن السلات والعملات الكمية وتتبع الفرص تلقائياً في خلفية البوت.
 * يقوم بحقن السلات القطاعية وتوسيع نطاق المراقبة بشكل ذاتي ومستمر
 * بدون الحاجة لأي تدخل يدوي، مع تتبع عقل البوت الكمي للفرص اللحظية.
 */

export interface SectorBasket {
  id: string;
  name: string;
  category: string;
  symbols: string[];
}

export const AUTONOMOUS_SECTOR_BASKETS: SectorBasket[] = [
  {
    id: 'layer1',
    name: 'سلة الطبقة الأولى (Layer-1)',
    category: 'L1',
    symbols: ['SOLUSDT', 'AVAXUSDT', 'APTUSDT', 'SUIUSDT', 'NEARUSDT', 'ADAUSDT', 'DOTUSDT', 'SEIUSDT']
  },
  {
    id: 'majors',
    name: 'سلة العملات القيادية الفائقة',
    category: 'MAJORS',
    symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'LTCUSDT']
  },
  {
    id: 'defi',
    name: 'سلة الخدمات والتمويل اللامركزي (DeFi)',
    category: 'DEFI',
    symbols: ['LINKUSDT', 'AAVEUSDT', 'UNIUSDT', 'INJUSDT', 'RUNEUSDT']
  },
  {
    id: 'ai_data',
    name: 'سلة الذكاء الاصطناعي والبيانات (AI & Data)',
    category: 'AI',
    symbols: ['RENDERUSDT', 'FETUSDT', 'TIAUSDT', 'WLDUSDT', 'NEARUSDT']
  },
  {
    id: 'layer2',
    name: 'سلة حلول التوسع (Layer-2 & Modular)',
    category: 'L2',
    symbols: ['ARBUSDT', 'OPUSDT', 'POLUSDT']
  }
];

// All expanded coins unified for background monitoring
export const ALL_AUTONOMOUS_COINS: string[] = Array.from(
  new Set(AUTONOMOUS_SECTOR_BASKETS.flatMap(b => b.symbols))
);
