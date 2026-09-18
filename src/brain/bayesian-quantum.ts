// src/brain/bayesian-quantum.ts
import { QuantumCircuit } from '../core/circuit';
import { Qubit } from '../core/qubit';

export interface BayesianPrediction {
  prediction: number;
  uncertainty: number;
  confidence: number;
  shouldTrade: boolean;
  meanPrediction: number;
  stdDeviation: number;
}

export class BayesianQuantumCircuit {
  private baseCircuit: QuantumCircuit;
  private weights: number[];
  private weightVariances: number[];
  private numSamples: number = 30; // Monte Carlo samples
  private uncertaintyThreshold: number = 0.15;
  private minConfidence: number = 0.65;
  
  constructor(numQubits: number) {
    this.baseCircuit = new QuantumCircuit(numQubits);
    this.weights = this.initializeWeights(numQubits * 3);
    this.weightVariances = this.initializeVariances(numQubits * 3);
  }
  
  private initializeWeights(size: number): number[] {
    return Array.from({ length: size }, () => (Math.random() - 0.5) * 0.1);
  }
  
  private initializeVariances(size: number): number[] {
    // بدء بتباين منخفض، يزداد مع عدم اليقين
    return Array.from({ length: size }, () => 0.01);
  }
  
  /**
   * التنبؤ مع قياس عدم اليقين باستخدام Monte Carlo Dropout
   */
  async predictWithUncertainty(features: number[]): Promise<BayesianPrediction> {
    const predictions: number[] = [];
    
    // 30 تمريرة بأوزان مختلفة (مأخوذة من التوزيع)
    for (let i = 0; i < this.numSamples; i++) {
      const sampledWeights = this.sampleWeights();
      const prediction = await this.runCircuitWithWeights(features, sampledWeights);
      predictions.push(prediction);
    }
    
    // حساب الإحصائيات
    const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const variance = predictions.reduce((sum, p) => 
      sum + Math.pow(p - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);
    
    // تحويل التباين إلى confidence score
    const confidence = Math.max(0, 1 - stdDev / this.uncertaintyThreshold);
    const shouldTrade = confidence >= this.minConfidence;
    
    return {
      prediction: mean,
      uncertainty: stdDev,
      confidence,
      shouldTrade,
      meanPrediction: mean,
      stdDeviation: stdDev
    };
  }
  
  /**
   * أخذ عينات من الأوزان بناءً على التوزيع الحالي
   */
  private sampleWeights(): number[] {
    return this.weights.map((mean, i) => {
      const std = Math.sqrt(this.weightVariances[i]);
      // Box-Muller transform لتوليد أرقام عشوائية من توزيع طبيعي
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + std * z;
    });
  }
  
  /**
   * تشغيل الدارة الكمومية بأوزان محددة
   */
  private async runCircuitWithWeights(features: number[], weights: number[]): Promise<number> {
    const numQubits = features.length;
    const circuit = new QuantumCircuit(numQubits);
    
    // ترميز الميزات (Angle Encoding)
    for (let i = 0; i < numQubits; i++) {
      circuit.addGate('RY', [i], [features[i]]);
    }
    
    // طبقات التفكير مع الأوزان المأخوذة من العينة
    let weightIdx = 0;
    for (let layer = 0; layer < 3; layer++) {
      // طبقة دوران فردية
      for (let i = 0; i < numQubits; i++) {
        circuit.addGate('RY', [i], [weights[weightIdx++]]);
        circuit.addGate('RZ', [i], [weights[weightIdx++]]);
      }
      
      // طبقة تشابك
      for (let i = 0; i < numQubits - 1; i++) {
        circuit.addGate('CNOT', [i, i + 1]);
      }
      
      // طبقة دوران زوجية
      for (let i = 0; i < numQubits; i++) {
        circuit.addGate('RX', [i], [weights[weightIdx++]]);
      }
    }
    
    // قياس النتيجة
    const result = await circuit.execute();
    return result.expectationZ;
  }
  
  /**
   * تحديث الأوزان والتباينات بناءً على الخطأ
   */
  async updateWithBayesianGradient(
    features: number[],
    target: number,
    learningRate: number = 0.01
  ): Promise<void> {
    // حساب التدرج لكل عينة
    const gradients: number[][] = [];
    
    for (let i = 0; i < this.numSamples; i++) {
      const sampledWeights = this.sampleWeights();
      const prediction = await this.runCircuitWithWeights(features, sampledWeights);
      const error = prediction - target;
      
      // Parameter-Shift Rule لحساب التدرج
      const grad = await this.computeGradient(features, sampledWeights, error);
      gradients.push(grad);
    }
    
    // متوسط التدرجات
    const avgGradient = gradients[0].map((_, i) => 
      gradients.reduce((sum, g) => sum + g[i], 0) / gradients.length
    );
    
    // تحديث الأوزان
    this.weights = this.weights.map((w, i) => w - learningRate * avgGradient[i]);
    
    // تحديث التباينات (Bayesian Update)
    this.weightVariances = this.weightVariances.map((v, i) => {
      const grad = avgGradient[i];
      // زيادة التباين عند تدرج كبير (عدم يقين عالي)
      const varianceUpdate = Math.abs(grad) * 0.001;
      return Math.max(0.001, v + varianceUpdate);
    });
  }
  
  private async computeGradient(
    features: number[],
    weights: number[],
    error: number
  ): Promise<number[]> {
    const shift = Math.PI / 2;
    const gradients: number[] = [];
    
    for (let i = 0; i < weights.length; i++) {
      const weightsPlus = [...weights];
      weightsPlus[i] += shift;
      const predPlus = await this.runCircuitWithWeights(features, weightsPlus);
      
      const weightsMinus = [...weights];
      weightsMinus[i] -= shift;
      const predMinus = await this.runCircuitWithWeights(features, weightsMinus);
      
      const grad = ((predPlus - error) - (predMinus - error)) / 2;
      gradients.push(grad);
    }
    
    return gradients;
  }
  
  /**
   * ضبط عتبة عدم اليقين ديناميكياً
   */
  adjustUncertaintyThreshold(recentPerformance: number): void {
    if (recentPerformance < 0.4) {
      // أداء سيء: رفع العتبة (أكثر تحفظاً)
      this.uncertaintyThreshold = Math.min(0.3, this.uncertaintyThreshold * 1.1);
      this.minConfidence = Math.min(0.85, this.minConfidence * 1.05);
    } else if (recentPerformance > 0.65) {
      // أداء جيد: خفض العتبة قليلاً (أكثر جرأة)
      this.uncertaintyThreshold = Math.max(0.08, this.uncertaintyThreshold * 0.95);
      this.minConfidence = Math.max(0.55, this.minConfidence * 0.98);
    }
  }
  
  getWeights(): number[] {
    return [...this.weights];
  }
  
  setWeights(weights: number[]): void {
    this.weights = [...weights];
  }
}
