// src/brain/meta-learner.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { MarketData } from '../data/data-buffer';
import { MarketRegime } from '../market/regime-detector';

export interface MetaTask {
  regime: MarketRegime;
  supportSet: MarketData[];   // بيانات للتكيف السريع (5-10 عينات)
  querySet: MarketData[];     // بيانات للاختبار
}

export interface MetaLearningConfig {
  innerLoopSteps: number;      // خطوات التكيف السريع
  outerLoopLR: number;         // معدل تعلم Meta
  innerLoopLR: number;         // معدل تعلم التكيف
  numTasks: number;            // عدد المهام في كل batch
  metaBatchSize: number;       // حجم batch للـ meta-update
}

export class MetaLearner {
  private metaWeights: number[];           // الأوزان الأساسية (Initial Point)
  private metaWeightVariances: number[];   // تباين الأوزان
  private config: MetaLearningConfig;
  private numQubits: number;
  private taskHistory: Array<{
    regime: MarketRegime;
    adaptationSpeed: number;
    finalLoss: number;
    timestamp: number;
  }> = [];
  
  constructor(numQubits: number, config?: Partial<MetaLearningConfig>) {
    this.numQubits = numQubits;
    this.config = {
      innerLoopSteps: 5,
      outerLoopLR: 0.001,
      innerLoopLR: 0.05,
      numTasks: 7,
      metaBatchSize: 4,
      ...config
    };
    
    // تهيئة Meta-Weights (نقطة بداية مثالية)
    const weightSize = numQubits * 3 * 3; // 3 layers × 3 rotations per qubit
    this.metaWeights = Array.from({ length: weightSize }, 
      () => (Math.random() - 0.5) * 0.1);
    this.metaWeightVariances = Array.from({ length: weightSize }, () => 0.01);
  }
  
  /**
   * التدريب Meta: تعلم نقطة بداية تتكيف بسرعة مع أي regime
   */
  async metaTrain(tasks: MetaTask[]): Promise<{
    avgAdaptationLoss: number;
    avgFinalLoss: number;
  }> {
    const metaGradient = new Array(this.metaWeights.length).fill(0);
    let totalAdaptationLoss = 0;
    let totalFinalLoss = 0;
    let taskCount = 0;
    
    // Outer Loop: لكل task (regime)
    for (const task of tasks) {
      // 1. حفظ الأوزان الأصلية
      const originalWeights = [...this.metaWeights];
      
      // 2. Inner Loop: تكيف سريع على support set
      let adaptedWeights = [...this.metaWeights];
      let adaptationLoss = 0;
      
      for (let step = 0; step < this.config.innerLoopSteps; step++) {
        // حساب التدرج على support set
        const gradient = await this.computeTaskGradient(
          adaptedWeights, 
          task.supportSet
        );
        
        // تحديث الأوزان (Inner Update)
        adaptedWeights = adaptedWeights.map((w, i) => 
          w - this.config.innerLoopLR * gradient[i]
        );
        
        adaptationLoss = await this.computeLoss(adaptedWeights, task.supportSet);
      }
      
      // 3. قياس الأداء على query set (ما لم يراه في التكيف)
      const queryLoss = await this.computeLoss(adaptedWeights, task.querySet);
      
      // 4. حساب Meta-Gradient (كيف تؤثر الأوزان الأصلية على query loss)
      const metaGrad = await this.computeMetaGradient(
        originalWeights,
        adaptedWeights,
        task.querySet
      );
      
      // تراكم Meta-Gradient
      for (let i = 0; i < metaGradient.length; i++) {
        metaGradient[i] += metaGrad[i];
      }
      
      totalAdaptationLoss += adaptationLoss;
      totalFinalLoss += queryLoss;
      taskCount++;
      
      // تسجيل التاريخ
      this.taskHistory.push({
        regime: task.regime,
        adaptationSpeed: adaptationLoss - queryLoss,
        finalLoss: queryLoss,
        timestamp: Date.now()
      });
    }
    
    // 5. تحديث Meta-Weights (Outer Update)
    if (taskCount > 0) {
      for (let i = 0; i < this.metaWeights.length; i++) {
        const avgGrad = metaGradient[i] / taskCount;
        this.metaWeights[i] -= this.config.outerLoopLR * avgGrad;
      }
    }
    
    return {
      avgAdaptationLoss: taskCount > 0 ? totalAdaptationLoss / taskCount : 0,
      avgFinalLoss: taskCount > 0 ? totalFinalLoss / taskCount : 0
    };
  }
  
  /**
   * التكيف السريع مع regime جديد (Few-Shot Adaptation)
   */
  async adaptToNewRegime(
    regime: MarketRegime,
    fewSamples: MarketData[],
    targetCircuit: BayesianQuantumCircuit
  ): Promise<{
    adaptedWeights: number[];
    adaptationSteps: number;
    finalLoss: number;
  }> {
    // بدء من Meta-Weights (نقطة البداية المثالية)
    let weights = [...this.metaWeights];
    let prevLoss = Infinity;
    let steps = 0;
    
    // تكيف سريع (5-10 خطوات فقط)
    for (let i = 0; i < this.config.innerLoopSteps * 2; i++) {
      const gradient = await this.computeTaskGradient(weights, fewSamples);
      weights = weights.map((w, j) => w - this.config.innerLoopLR * gradient[j]);
      
      const loss = await this.computeLoss(weights, fewSamples);
      steps++;
      
      // Early stopping إذا لم يتحسن
      if (prevLoss - loss < 0.001) break;
      prevLoss = loss;
    }
    
    // تطبيق الأوزان المتكيفة على الدارة المستهدفة
    targetCircuit.setWeights(weights);
    
    return {
      adaptedWeights: weights,
      adaptationSteps: steps,
      finalLoss: prevLoss
    };
  }
  
  /**
   * حساب التدرج لمهمة معينة
   */
  private async computeTaskGradient(
    weights: number[],
    data: MarketData[]
  ): Promise<number[]> {
    const gradients = new Array(weights.length).fill(0);
    const shift = Math.PI / 2;
    
    if (!data || data.length === 0) return gradients;

    // عينات عشوائية للكفاءة
    const samples = data.slice(0, Math.min(data.length, 20));
    
    for (const sample of samples) {
      const features = this.extractFeatures(sample);
      const target = this.computeTarget(sample);
      
      for (let i = 0; i < weights.length; i++) {
        // Parameter-Shift Rule
        const wPlus = [...weights];
        wPlus[i] += shift;
        const predPlus = await this.evaluateWithWeights(wPlus, features);
        
        const wMinus = [...weights];
        wMinus[i] -= shift;
        const predMinus = await this.evaluateWithWeights(wMinus, features);
        
        const lossPlus = Math.pow(predPlus - target, 2);
        const lossMinus = Math.pow(predMinus - target, 2);
        
        gradients[i] += (lossPlus - lossMinus) / 2;
      }
    }
    
    // متوسط على العينات
    return gradients.map(g => g / samples.length);
  }
  
  /**
   * حساب Meta-Gradient (Higher-Order)
   */
  private async computeMetaGradient(
    originalWeights: number[],
    _adaptedWeights: number[],
    queryData: MarketData[]
  ): Promise<number[]> {
    // تقريب: Meta-Gradient ≈ Gradient على query set من الأوزان الأصلية
    return await this.computeTaskGradient(originalWeights, queryData);
  }
  
  /**
   * حساب الخسارة
   */
  private async computeLoss(weights: number[], data: MarketData[]): Promise<number> {
    if (!data || data.length === 0) return 0;
    let totalLoss = 0;
    const samples = data.slice(0, Math.min(data.length, 20));
    
    for (const sample of samples) {
      const features = this.extractFeatures(sample);
      const target = this.computeTarget(sample);
      const pred = await this.evaluateWithWeights(weights, features);
      totalLoss += Math.pow(pred - target, 2);
    }
    
    return totalLoss / samples.length;
  }
  
  /**
   * تقييم بأوزان محددة
   */
  private async evaluateWithWeights(
    weights: number[],
    features: number[]
  ): Promise<number> {
    // محاكاة مبسطة للدارة الكمومية
    let output = 0;
    let weightIdx = 0;
    
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < features.length; i++) {
        const angle = features[i] + (weights[weightIdx++] || 0);
        output += Math.sin(angle) * Math.cos(weights[weightIdx++] || 0);
        weightIdx++;
      }
    }
    
    return Math.tanh(output / (features.length || 1));
  }
  
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
  
  private computeTarget(data: MarketData): number {
    return Math.tanh((data.futureReturn || 0) * 100);
  }
  
  /**
   * إنشاء Meta-Tasks من البيانات التاريخية
   */
  static createTasksFromData(
    data: MarketData[],
    regimeLabels: MarketRegime[],
    _numTasks: number = 7
  ): MetaTask[] {
    const tasks: MetaTask[] = [];
    const regimeGroups = new Map<MarketRegime, MarketData[]>();
    
    // تجميع البيانات حسب regime
    data.forEach((d, i) => {
      const regime = regimeLabels[i] || 'SIDEWAYS';
      if (!regimeGroups.has(regime)) {
        regimeGroups.set(regime, []);
      }
      regimeGroups.get(regime)!.push(d);
    });
    
    // إنشاء task لكل regime
    for (const [regime, groupData] of regimeGroups) {
      if (groupData.length < 10) continue;
      
      // تقسيم إلى support (30%) و query (70%)
      const splitIdx = Math.max(1, Math.floor(groupData.length * 0.3));
      const shuffled = [...groupData].sort(() => Math.random() - 0.5);
      
      tasks.push({
        regime,
        supportSet: shuffled.slice(0, splitIdx),
        querySet: shuffled.slice(splitIdx)
      });
    }
    
    return tasks;
  }
  
  getMetaWeights(): number[] {
    return [...this.metaWeights];
  }
  
  setMetaWeights(weights: number[]): void {
    this.metaWeights = [...weights];
  }
  
  getAdaptationStats(): {
    avgSpeed: number;
    bestRegimes: MarketRegime[];
    worstRegimes: MarketRegime[];
  } {
    if (this.taskHistory.length === 0) {
      return { avgSpeed: 0, bestRegimes: [], worstRegimes: [] };
    }
    
    const avgSpeed = this.taskHistory.reduce((s, t) => s + t.adaptationSpeed, 0) 
      / this.taskHistory.length;
    
    // ترتيب حسب سرعة التكيف
    const byRegime = new Map<MarketRegime, number[]>();
    this.taskHistory.forEach(t => {
      if (!byRegime.has(t.regime)) byRegime.set(t.regime, []);
      byRegime.get(t.regime)!.push(t.adaptationSpeed);
    });
    
    const regimeAvg = Array.from(byRegime.entries()).map(([r, speeds]) => ({
      regime: r,
      avg: speeds.reduce((a, b) => a + b, 0) / speeds.length
    }));
    
    regimeAvg.sort((a, b) => b.avg - a.avg);
    
    return {
      avgSpeed,
      bestRegimes: regimeAvg.slice(0, 3).map(r => r.regime),
      worstRegimes: regimeAvg.slice(-3).map(r => r.regime)
    };
  }
}
