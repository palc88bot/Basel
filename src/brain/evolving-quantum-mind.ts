// src/brain/evolving-quantum-mind.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { SelfReflection, TradeDecision } from './self-reflection';
import { ContinualLearner, MarketData } from './continual-learner';
import { QuantumEnsemble, MarketRegime } from './quantum-ensemble';

export interface EvolvingDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  uncertainty: number;
  prediction: number;
  selectedExpert: string;
  reasoning: string;
  shouldTrade: boolean;
}

export class EvolvingQuantumMind {
  private ensemble: QuantumEnsemble;
  private selfReflection: SelfReflection;
  private continualLearner: ContinualLearner;
  private numQubits: number = 8;
  
  // إعدادات التكيف الذاتي
  private learningInterval: number = 50; // تعلم كل 50 صفقة
  private reflectionInterval: number = 25; // انعكاس كل 25 صفقة
  private tradeCounter: number = 0;
  private lastLearningTime: number = Date.now();
  
  constructor() {
    // 1. إنشاء Ensemble من 7 عقول
    this.ensemble = new QuantumEnsemble(this.numQubits);
    
    // 2. إنشاء Self-Reflection (يستخدم أول عقل كمرجع)
    const primaryCircuit = new BayesianQuantumCircuit(this.numQubits);
    this.selfReflection = new SelfReflection(primaryCircuit);
    
    // 3. إنشاء Continual Learner
    this.continualLearner = new ContinualLearner(primaryCircuit);
  }
  
  /**
   * اتخاذ قرار تداول متطور
   */
  async decide(
    marketData: MarketData,
    regime: MarketRegime
  ): Promise<EvolvingDecision> {
    // 1. استخراج الميزات
    const features = this.extractFeatures(marketData);
    
    // 2. الحصول على قرار من Ensemble
    const ensembleDecision = await this.ensemble.decide(features, regime, marketData);
    
    // 3. تحديد الإجراء
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (ensembleDecision.shouldTrade) {
      action = ensembleDecision.finalPrediction > 0 ? 'BUY' : 'SELL';
    }
    
    // 4. بناء التفسير
    const reasoning = this.buildReasoning(ensembleDecision, regime);
    
    // 5. التحقق من عتبة الثقة من Self-Reflection
    const confidenceThreshold = this.selfReflection.getConfidenceThreshold();
    const shouldTrade = ensembleDecision.shouldTrade && 
                       ensembleDecision.finalConfidence >= confidenceThreshold;
    
    return {
      action,
      confidence: ensembleDecision.finalConfidence,
      uncertainty: ensembleDecision.finalUncertainty,
      prediction: ensembleDecision.finalPrediction,
      selectedExpert: ensembleDecision.selectedExpert,
      reasoning,
      shouldTrade
    };
  }
  
  /**
   * تسجيل نتيجة صفقة للتعلم
   */
  async recordTradeResult(
    decision: EvolvingDecision,
    marketData: MarketData,
    pnl: number,
    entryPrice: number,
    exitPrice: number
  ): Promise<void> {
    this.tradeCounter++;
    
    // 1. تسجيل القرار في Self-Reflection
    const tradeDecision: TradeDecision = {
      timestamp: Date.now(),
      features: this.extractFeatures(marketData),
      prediction: decision.prediction,
      confidence: decision.confidence,
      action: decision.action,
      entryPrice,
      exitPrice,
      pnl,
      regime: decision.selectedExpert,
      uncertainty: decision.uncertainty
    };
    
    this.selfReflection.recordDecision(tradeDecision);
    
    // 2. تدريب العقل المتخصص
    const target = Math.tanh(pnl * 100); // تحويل PnL إلى هدف
    await this.ensemble.trainExpert(
      decision.selectedExpert,
      this.extractFeatures(marketData),
      target,
      0.01
    );
    
    // 3. تعلم مستمر دوري
    if (this.tradeCounter % this.learningInterval === 0) {
      await this.performContinualLearning(marketData);
    }
    
    // 4. انعكاس دوري
    if (this.tradeCounter % this.reflectionInterval === 0) {
      const insights = await this.selfReflection.reflect();
      console.log(`[EvolvingMind] Reflection: ${insights.length} insights`);
    }
    
    // 5. إعادة تعيين العقول الضعيفة
    const expertStats = this.ensemble.getExpertStats();
    for (const [regime, stats] of expertStats) {
      if (stats.totalTrades > 50 && stats.recentPerformance < 0.4) {
        this.ensemble.resetWeakExpert(regime, this.numQubits);
      }
    }
  }
  
  /**
   * تعلم مستمر من البيانات الجديدة
   */
  private async performContinualLearning(marketData: MarketData): Promise<void> {
    const timeSinceLastLearning = Date.now() - this.lastLearningTime;
    
    // تعلم كل ساعة على الأقل
    if (timeSinceLastLearning < 3600000) return;
    
    console.log('[EvolvingMind] Performing continual learning...');
    
    // جمع بيانات حديثة (آخر 100 نقطة)
    const recentData = [marketData]; // في الواقع، نحتاج buffer للبيانات التاريخية
    
    await this.continualLearner.learnIncremental(recentData);
    
    // ضبط EWC lambda بناءً على الأداء
    const stats = this.selfReflection.getPerformanceStats();
    this.continualLearner.adjustEWCLambda(stats.recentPerformance);
    
    this.lastLearningTime = Date.now();
  }
  
  /**
   * استخراج الميزات من بيانات السوق
   */
  private extractFeatures(data: MarketData): number[] {
    return [
      data.rsi / 100,
      data.macdHistogram / 100,
      data.bbPercentB,
      data.atrNormalized,
      data.volumeDelta,
      data.orderBookImbalance,
      data.momentum,
      data.priceAction
    ];
  }
  
  /**
   * بناء تفسير للقرار
   */
  private buildReasoning(
    decision: any,
    regime: MarketRegime
  ): string {
    const parts: string[] = [];
    
    parts.push(`Regime: ${regime}`);
    parts.push(`Selected Expert: ${decision.selectedExpert}`);
    parts.push(`Confidence: ${(decision.finalConfidence * 100).toFixed(1)}%`);
    parts.push(`Uncertainty: ${decision.finalUncertainty.toFixed(3)}`);
    
    if (decision.shouldTrade) {
      const direction = decision.finalPrediction > 0 ? 'BULLISH' : 'BEARISH';
      parts.push(`Signal: ${direction} (${decision.finalPrediction.toFixed(3)})`);
    } else {
      parts.push('Signal: HOLD (low confidence or high uncertainty)');
    }
    
    return parts.join(' | ');
  }
  
  /**
   * الحصول على إحصائيات شاملة
   */
  getFullStats(): {
    performance: any;
    experts: Map<string, any>;
    training: any;
    tradeCounter: number;
  } {
    return {
      performance: this.selfReflection.getPerformanceStats(),
      experts: this.ensemble.getExpertStats(),
      training: this.continualLearner.getTrainingStats(),
      tradeCounter: this.tradeCounter
    };
  }
  
  /**
   * حفظ الحالة
   */
  async saveState(): Promise<any> {
    return {
      tradeCounter: this.tradeCounter,
      lastLearningTime: this.lastLearningTime,
      // هنا نحفظ أوزان كل عقل
      // (يحتاج تنفيذ في كل مكون)
    };
  }
  
  /**
   * استعادة الحالة
   */
  async loadState(state: any): Promise<void> {
    this.tradeCounter = state.tradeCounter || 0;
    this.lastLearningTime = state.lastLearningTime || Date.now();
    // استعادة الأوزان
  }
}
