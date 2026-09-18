// src/brain/continual-learner.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { MarketData } from '../data/data-buffer';

export type { MarketData };

export class ContinualLearner {
  private quantumCircuit: BayesianQuantumCircuit;
  private elasticWeights: Map<number, number>; // Fisher Information
  private ewcLambda: number = 1000; // قوة regularization
  private learningRate: number = 0.01;
  private trainingHistory: Array<{
    timestamp: number;
    weights: number[];
    performance: number;
  }> = [];
  
  constructor(quantumCircuit: BayesianQuantumCircuit) {
    this.quantumCircuit = quantumCircuit;
    this.elasticWeights = new Map();
  }
  
  /**
   * تعلم_incremental من بيانات جديدة مع حماية من النسيان
   */
  async learnIncremental(newData: MarketData[]): Promise<void> {
    const oldWeights = this.quantumCircuit.getWeights();
    
    // 1. حساب Fisher Information (أهمية كل weight)
    await this.computeFisherInformation(newData);
    
    // 2. تدريب على البيانات الجديدة
    const numEpochs = 10;
    for (let epoch = 0; epoch < numEpochs; epoch++) {
      for (const data of newData) {
        const features = this.extractFeatures(data);
        const target = this.computeTarget(data);
        
        // تحديث Bayesian
        await this.quantumCircuit.updateWithBayesianGradient(
          features,
          target,
          this.learningRate
        );
      }
      
      // 3. تطبيق EWC Regularization
      await this.applyEWCRegularization(oldWeights);
    }
    
    // 4. تسجيل التاريخ
    this.trainingHistory.push({
      timestamp: Date.now(),
      weights: [...this.quantumCircuit.getWeights()],
      performance: await this.evaluatePerformance(newData)
    });
    
    // الحفاظ على آخر 100 نقطة فقط
    if (this.trainingHistory.length > 100) {
      this.trainingHistory.shift();
    }
  }
  
  /**
   * حساب Fisher Information Matrix (قطري فقط للكفاءة)
   */
  private async computeFisherInformation(data: MarketData[]): Promise<void> {
    const weights = this.quantumCircuit.getWeights();
    const fisherDiag = new Array(weights.length).fill(0);
    
    // حساب التدرج لكل عينة
    for (const sample of data.slice(0, 50)) { // عينات عشوائية
      const features = this.extractFeatures(sample);
      const target = this.computeTarget(sample);
      
      // حساب التدرج
      const gradient = await this.computeGradient(features, target);
      
      // Fisher = E[gradient^2]
      for (let i = 0; i < gradient.length; i++) {
        fisherDiag[i] += Math.pow(gradient[i], 2);
      }
    }
    
    // متوسط Fisher
    const n = Math.min(data.length, 50);
    for (let i = 0; i < fisherDiag.length; i++) {
      const avgFisher = fisherDiag[i] / n;
      const current = this.elasticWeights.get(i) || 0;
      // تحديث تراكمي
      this.elasticWeights.set(i, current * 0.9 + avgFisher * 0.1);
    }
  }
  
  /**
   * حساب التدرج باستخدام Parameter-Shift Rule
   */
  private async computeGradient(features: number[], target: number): Promise<number[]> {
    const weights = this.quantumCircuit.getWeights();
    const gradients: number[] = [];
    const shift = Math.PI / 2;
    
    for (let i = 0; i < weights.length; i++) {
      const weightsPlus = [...weights];
      weightsPlus[i] += shift;
      this.quantumCircuit.setWeights(weightsPlus);
      const predPlus = await this.quantumCircuit.predictWithUncertainty(features);
      
      const weightsMinus = [...weights];
      weightsMinus[i] -= shift;
      this.quantumCircuit.setWeights(weightsMinus);
      const predMinus = await this.quantumCircuit.predictWithUncertainty(features);
      
      const grad = (predPlus.prediction - predMinus.prediction) / 2;
      gradients.push(grad * (predPlus.prediction - target));
    }
    
    // استعادة الأوزان الأصلية
    this.quantumCircuit.setWeights(weights);
    
    return gradients;
  }
  
  /**
   * تطبيق EWC Regularization
   */
  private async applyEWCRegularization(oldWeights: number[]): Promise<void> {
    const currentWeights = this.quantumCircuit.getWeights();
    const ewcGradient: number[] = [];
    
    for (let i = 0; i < currentWeights.length; i++) {
      const importance = this.elasticWeights.get(i) || 0;
      const diff = currentWeights[i] - oldWeights[i];
      // عقاب التغيير في الأوزان المهمة
      const ewcGrad = this.ewcLambda * importance * diff;
      ewcGradient.push(ewcGrad);
    }
    
    // تطبيق العقاب (تقليل التغيير)
    const adjustedWeights = currentWeights.map((w, i) => 
      w - this.learningRate * 0.1 * ewcGradient[i]
    );
    
    this.quantumCircuit.setWeights(adjustedWeights);
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
   * حساب الهدف من البيانات
   */
  private computeTarget(data: MarketData): number {
    // هدف بسيط: 1 إذا السعر صعد، -1 إذا نزل
    const futureReturn = data.futureReturn || 0;
    return Math.tanh(futureReturn * 100); // تحويل إلى نطاق [-1, 1]
  }
  
  /**
   * تقييم الأداء على البيانات
   */
  private async evaluatePerformance(data: MarketData[]): Promise<number> {
    let correct = 0;
    let total = 0;
    
    for (const sample of data) {
      const features = this.extractFeatures(sample);
      const prediction = await this.quantumCircuit.predictWithUncertainty(features);
      const target = this.computeTarget(sample);
      
      // إذا التنبؤ في نفس اتجاه الهدف
      if (Math.sign(prediction.prediction) === Math.sign(target)) {
        correct++;
      }
      total++;
    }
    
    return total > 0 ? correct / total : 0;
  }
  
  /**
   * الحصول على إحصائيات التدريب
   */
  getTrainingStats(): {
    totalUpdates: number;
    avgPerformance: number;
    performanceTrend: number;
  } {
    const avgPerformance = this.trainingHistory.length > 0
      ? this.trainingHistory.reduce((sum, h) => sum + h.performance, 0) / this.trainingHistory.length
      : 0;
    
    // حساب الاتجاه (آخر 10 vs أول 10)
    let trend = 0;
    if (this.trainingHistory.length >= 20) {
      const recent = this.trainingHistory.slice(-10);
      const old = this.trainingHistory.slice(0, 10);
      const recentAvg = recent.reduce((sum, h) => sum + h.performance, 0) / recent.length;
      const oldAvg = old.reduce((sum, h) => sum + h.performance, 0) / old.length;
      trend = recentAvg - oldAvg;
    }
    
    return {
      totalUpdates: this.trainingHistory.length,
      avgPerformance,
      performanceTrend: trend
    };
  }
  
  /**
   * ضبط معامل EWC ديناميكياً
   */
  adjustEWCLambda(performance: number): void {
    if (performance < 0.5) {
      // أداء سيء: تقليل EWC (السماح بتغيير أكثر)
      this.ewcLambda = Math.max(100, this.ewcLambda * 0.9);
    } else if (performance > 0.7) {
      // أداء جيد: زيادة EWC (حماية الأوزان المهمة)
      this.ewcLambda = Math.min(10000, this.ewcLambda * 1.1);
    }
  }
}
