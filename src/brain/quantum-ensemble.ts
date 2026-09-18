// src/brain/quantum-ensemble.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { MarketData } from '../data/data-buffer';
import { MarketRegime } from '../market/regime-detector';

export type { MarketRegime };

export class QuantumEnsemble {
  private experts: Map<string, BayesianQuantumCircuit> = new Map();
  private expertPerformance: Map<string, number[]> = new Map();
  
  constructor(numQubits: number) {
    const regimes: string[] = ['BULL', 'BEAR', 'SIDEWAYS', 'TRENDING', 'CRASH', 'HIGH_VOLATILITY', 'ACCUMULATION'];
    regimes.forEach(regime => {
      this.experts.set(regime, new BayesianQuantumCircuit(numQubits));
      this.expertPerformance.set(regime, []);
    });
  }
  
  /**
   * اتخاذ قرار جماعي
   */
  async decide(
    features: number[],
    regime: MarketRegime,
    marketData: MarketData
  ): Promise<{
    finalPrediction: number;
    finalConfidence: number;
    finalUncertainty: number;
    shouldTrade: boolean;
    selectedExpert: string;
  }> {
    const probabilities = await this.computeGatingProbabilities(features, regime);
    
    let weightedPrediction = 0;
    let weightedConfidence = 0;
    let weightedUncertainty = 0;
    let maxProb = 0;
    let selectedExpert = '';
    
    for (const [regimeName, prob] of probabilities) {
      const expert = this.experts.get(regimeName)!;
      const prediction = await expert.predictWithUncertainty(features);
      
      weightedPrediction += prediction.prediction * prob;
      weightedConfidence += prediction.confidence * prob;
      weightedUncertainty += prediction.uncertainty * prob;
      
      if (prob > maxProb) {
        maxProb = prob;
        selectedExpert = regimeName;
      }
    }
    
    return {
      finalPrediction: weightedPrediction,
      finalConfidence: weightedConfidence,
      finalUncertainty: weightedUncertainty,
      shouldTrade: weightedConfidence > 0.6,
      selectedExpert
    };
  }
  
  /**
   * حساب احتمالات Gating ديناميكياً
   */
  private async computeGatingProbabilities(
    features: number[],
    currentRegime: MarketRegime
  ): Promise<Map<string, number>> {
    const probs = new Map<string, number>();
    
    // 1. وزن العقل المتخصص في الـ regime الحالي
    const regimeBoost = 2.5; // تعزيز 2.5x للعقل المتخصص
    
    // 2. حساب الأداء الأخير لكل عقل
    const performanceScores = new Map<string, number>();
    
    for (const [regime, expert] of this.experts) {
      const recentPerf = this.expertPerformance.get(regime) || [];
      const avgPerf = recentPerf.length > 0 
        ? recentPerf.slice(-20).reduce((a, b) => a + b, 0) / Math.min(recentPerf.length, 20)
        : 0.5;
      
      performanceScores.set(regime, avgPerf);
    }
    
    // 3. حساب الاحتمالات باستخدام Softmax
    let totalScore = 0;
    const scores = new Map<string, number>();
    
    for (const [regime, _] of this.experts) {
      let score = performanceScores.get(regime) || 0.5;
      
      // تعزيز العقل المتخصص في الـ regime الحالي
      if (regime === currentRegime) {
        score *= regimeBoost;
      }
      
      scores.set(regime, score);
      totalScore += score;
    }
    
    // 4. تحويل إلى احتمالات
    for (const [regime, score] of scores) {
      probs.set(regime, score / totalScore);
    }
    
    return probs;
  }
  
  /**
   * تدريب العقول بشكل انتقائي
   */
  async trainExpert(
    regime: string,
    features: number[],
    target: number,
    learningRate: number = 0.01
  ): Promise<void> {
    const expert = this.experts.get(regime);
    if (!expert) return;
    
    // تدريب العقل المتخصص
    await expert.updateWithBayesianGradient(features, target, learningRate);
    
    // تسجيل الأداء
    const prediction = await expert.predictWithUncertainty(features);
    const correct = Math.sign(prediction.prediction) === Math.sign(target);
    
    const performance = this.expertPerformance.get(regime) || [];
    performance.push(correct ? 1 : 0);
    
    // الحفاظ على آخر 100 نتيجة فقط
    if (performance.length > 100) {
      performance.shift();
    }
    
    this.expertPerformance.set(regime, performance);
  }
  
  /**
   * الحصول على إحصائيات كل عقل
   */
  getExpertStats(): Map<string, {
    avgPerformance: number;
    totalTrades: number;
    recentPerformance: number;
  }> {
    const stats = new Map();
    
    for (const [regime, performance] of this.expertPerformance) {
      const recent = performance.slice(-20);
      const avgPerf = performance.length > 0 
        ? performance.reduce((a, b) => a + b, 0) / performance.length 
        : 0;
      const recentPerf = recent.length > 0 
        ? recent.reduce((a, b) => a + b, 0) / recent.length 
        : 0;
      
      stats.set(regime, {
        avgPerformance: avgPerf,
        totalTrades: performance.length,
        recentPerformance: recentPerf
      });
    }
    
    return stats;
  }
  
  /**
   * إعادة تعيين عقل ضعيف
   */
  resetWeakExpert(regime: string, numQubits: number): void {
    const stats = this.expertPerformance.get(regime);
    if (!stats || stats.length < 50) return;
    
    const recentPerf = stats.slice(-20).reduce((a, b) => a + b, 0) / 20;
    
    // إذا الأداء أقل من 40% في آخر 20 صفقة
    if (recentPerf < 0.4) {
      console.log(`[Ensemble] Resetting weak expert: ${regime} (perf: ${recentPerf.toFixed(2)})`);
      this.experts.set(regime, new BayesianQuantumCircuit(numQubits));
      this.expertPerformance.set(regime, []);
    }
  }
}
