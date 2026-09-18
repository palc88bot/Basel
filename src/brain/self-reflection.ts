// src/brain/self-reflection.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';

export interface TradeDecision {
  timestamp: number;
  features: number[];
  prediction: number;
  confidence: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  regime: string;
  uncertainty: number;
}

export interface ReflectionInsight {
  type: 'AVOID_PATTERN' | 'SEEK_PATTERN' | 'ADJUST_THRESHOLD';
  description: string;
  confidence: number;
  impact: number;
}

export class SelfReflection {
  private recentDecisions: TradeDecision[] = [];
  private maxHistory: number = 500;
  private reflectionInterval: number = 50; // كل 50 صفقة
  private quantumCircuit: BayesianQuantumCircuit;
  private confidenceThreshold: number = 0.65;
  private positionSizeMultiplier: number = 1.0;
  
  constructor(quantumCircuit: BayesianQuantumCircuit) {
    this.quantumCircuit = quantumCircuit;
  }
  
  /**
   * تسجيل قرار تداول جديد
   */
  recordDecision(decision: TradeDecision): void {
    this.recentDecisions.push(decision);
    
    // الحفاظ على آخر maxHistory قرار فقط
    if (this.recentDecisions.length > this.maxHistory) {
      this.recentDecisions.shift();
    }
    
    // انعكاس دوري
    if (this.recentDecisions.length % this.reflectionInterval === 0) {
      this.reflect();
    }
  }
  
  /**
   * عملية الانعكاس والتعلم من الأخطاء
   */
  async reflect(): Promise<ReflectionInsight[]> {
    if (this.recentDecisions.length < 20) return [];
    
    const insights: ReflectionInsight[] = [];
    
    // 1. تحليل الأداء الأخير
    const recentPerformance = this.computeRecentPerformance(50);
    
    // 2. اكتشاف الأنماط الخاسرة
    const losingPatterns = await this.findLosingPatterns();
    for (const pattern of losingPatterns) {
      insights.push({
        type: 'AVOID_PATTERN',
        description: pattern.description,
        confidence: pattern.confidence,
        impact: pattern.impact
      });
    }
    
    // 3. اكتشاف الأنماط الرابحة
    const winningPatterns = await this.findWinningPatterns();
    for (const pattern of winningPatterns) {
      insights.push({
        type: 'SEEK_PATTERN',
        description: pattern.description,
        confidence: pattern.confidence,
        impact: pattern.impact
      });
    }
    
    // 4. تعديل العتبات بناءً على الأداء
    const thresholdAdjustment = this.analyzeConfidenceCalibration();
    if (thresholdAdjustment) {
      insights.push(thresholdAdjustment);
    }
    
    // 5. تطبيق الاستنتاجات
    await this.applyInsights(insights, recentPerformance);
    
    return insights;
  }
  
  /**
   * حساب الأداء الأخير
   */
  private computeRecentPerformance(n: number): number {
    const recent = this.recentDecisions.slice(-n);
    const completed = recent.filter(d => d.pnl !== undefined);
    
    if (completed.length === 0) return 0.5;
    
    const wins = completed.filter(d => d.pnl! > 0).length;
    return wins / completed.length;
  }
  
  /**
   * اكتشاف الأنماط الخاسرة
   */
  private async findLosingPatterns(): Promise<Array<{
    description: string;
    confidence: number;
    impact: number;
  }>> {
    const losses = this.recentDecisions.filter(d => d.pnl !== undefined && d.pnl < 0);
    
    if (losses.length < 5) return [];
    
    const patterns: Array<{
      description: string;
      confidence: number;
      impact: number;
    }> = [];
    
    // نمط 1: تداول في ظروف عدم يقين عالي
    const highUncertaintyLosses = losses.filter(d => d.uncertainty > 0.15);
    if (highUncertaintyLosses.length > losses.length * 0.6) {
      patterns.push({
        description: 'تداول في ظروف عدم يقين عالي يؤدي لخسائر متكررة',
        confidence: highUncertaintyLosses.length / losses.length,
        impact: -0.3
      });
    }
    
    // نمط 2: تداول في regime معين
    const regimeCounts = new Map<string, number>();
    losses.forEach(d => {
      regimeCounts.set(d.regime, (regimeCounts.get(d.regime) || 0) + 1);
    });
    
    for (const [regime, count] of regimeCounts) {
      if (count > losses.length * 0.4) {
        patterns.push({
          description: `خسائر متكررة في regime: ${regime}`,
          confidence: count / losses.length,
          impact: -0.2
        });
      }
    }
    
    // نمط 3: Confidence منخفض
    const lowConfidenceLosses = losses.filter(d => d.confidence < 0.7);
    if (lowConfidenceLosses.length > losses.length * 0.5) {
      patterns.push({
        description: 'تداول بثقة منخفضة يؤدي لخسائر',
        confidence: lowConfidenceLosses.length / losses.length,
        impact: -0.25
      });
    }
    
    return patterns;
  }
  
  /**
   * اكتشاف الأنماط الرابحة
   */
  private async findWinningPatterns(): Promise<Array<{
    description: string;
    confidence: number;
    impact: number;
  }>> {
    const wins = this.recentDecisions.filter(d => d.pnl !== undefined && d.pnl > 0);
    
    if (wins.length < 5) return [];
    
    const patterns: Array<{
      description: string;
      confidence: number;
      impact: number;
    }> = [];
    
    // نمط 1: تداول بثقة عالية
    const highConfidenceWins = wins.filter(d => d.confidence > 0.8);
    if (highConfidenceWins.length > wins.length * 0.6) {
      patterns.push({
        description: 'تداول بثقة عالية يؤدي لأرباح متكررة',
        confidence: highConfidenceWins.length / wins.length,
        impact: 0.3
      });
    }
    
    // نمط 2: regime معين
    const regimeCounts = new Map<string, number>();
    wins.forEach(d => {
      regimeCounts.set(d.regime, (regimeCounts.get(d.regime) || 0) + 1);
    });
    
    for (const [regime, count] of regimeCounts) {
      if (count > wins.length * 0.4) {
        patterns.push({
          description: `أرباح متكررة في regime: ${regime}`,
          confidence: count / wins.length,
          impact: 0.2
        });
      }
    }
    
    return patterns;
  }
  
  /**
   * تحليل معايرة الثقة
   */
  private analyzeConfidenceCalibration(): ReflectionInsight | null {
    const recent = this.recentDecisions.slice(-100);
    const completed = recent.filter(d => d.pnl !== undefined);
    
    if (completed.length < 20) return null;
    
    // تقسيم حسب confidence
    const highConf = completed.filter(d => d.confidence > 0.8);
    const lowConf = completed.filter(d => d.confidence < 0.7);
    
    const highConfWinRate = highConf.length > 0 
      ? highConf.filter(d => d.pnl! > 0).length / highConf.length 
      : 0;
    const lowConfWinRate = lowConf.length > 0 
      ? lowConf.filter(d => d.pnl! > 0).length / lowConf.length 
      : 0;
    
    // إذا الثقة العالية لا تعطي نتائج أفضل، نحتاج معايرة
    if (highConfWinRate < lowConfWinRate + 0.1) {
      return {
        type: 'ADJUST_THRESHOLD',
        description: 'معايرة الثقة غير دقيقة - الثقة العالية لا تعطي نتائج أفضل',
        confidence: 0.7,
        impact: -0.15
      };
    }
    
    return null;
  }
  
  /**
   * تطبيق الاستنتاجات على النظام
   */
  private async applyInsights(
    insights: ReflectionInsight[],
    recentPerformance: number
  ): Promise<void> {
    // 1. تعديل عتبة عدم اليقين
    this.quantumCircuit.adjustUncertaintyThreshold(recentPerformance);
    
    // 2. تعديل عتبة الثقة
    const avoidPatterns = insights.filter(i => i.type === 'AVOID_PATTERN');
    if (avoidPatterns.length > 0) {
      const avgImpact = avoidPatterns.reduce((sum, i) => sum + i.impact, 0) / avoidPatterns.length;
      this.confidenceThreshold = Math.min(0.85, this.confidenceThreshold - avgImpact * 0.1);
    }
    
    // 3. تعديل حجم الصفقة
    if (recentPerformance < 0.4) {
      this.positionSizeMultiplier = Math.max(0.5, this.positionSizeMultiplier * 0.9);
    } else if (recentPerformance > 0.65) {
      this.positionSizeMultiplier = Math.min(1.5, this.positionSizeMultiplier * 1.05);
    }
    
    console.log(`[Self-Reflection] Applied ${insights.length} insights`);
    console.log(`  Confidence Threshold: ${this.confidenceThreshold.toFixed(3)}`);
    console.log(`  Position Size Multiplier: ${this.positionSizeMultiplier.toFixed(2)}`);
    console.log(`  Recent Performance: ${(recentPerformance * 100).toFixed(1)}%`);
  }
  
  /**
   * الحصول على عتبة الثقة الحالية
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
  
  /**
   * الحصول على مضاعف حجم الصفقة
   */
  getPositionSizeMultiplier(): number {
    return this.positionSizeMultiplier;
  }
  
  /**
   * الحصول على إحصائيات الأداء
   */
  getPerformanceStats(): {
    totalTrades: number;
    winRate: number;
    avgPnl: number;
    recentPerformance: number;
  } {
    const completed = this.recentDecisions.filter(d => d.pnl !== undefined);
    const wins = completed.filter(d => d.pnl! > 0);
    const avgPnl = completed.reduce((sum, d) => sum + d.pnl!, 0) / completed.length;
    
    return {
      totalTrades: completed.length,
      winRate: wins.length / completed.length,
      avgPnl,
      recentPerformance: this.computeRecentPerformance(50)
    };
  }
}
