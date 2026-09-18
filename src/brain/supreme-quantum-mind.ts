// src/brain/supreme-quantum-mind.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { SelfReflection, TradeDecision } from './self-reflection';
import { ContinualLearner } from './continual-learner';
import { QuantumEnsemble } from './quantum-ensemble';
import { MetaLearner } from './meta-learner';
import { FeatureEvolution } from './feature-evolution';
import { QuantumEvolutionaryOptimizer } from './quantum-evolution';
import { MarketData } from '../data/data-buffer';
import { MarketRegime } from '../market/regime-detector';

export interface SupremeDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  uncertainty: number;
  prediction: number;
  selectedExpert: string;
  evolvedFeatures: string[];
  reasoning: string;
  shouldTrade: boolean;
  metaAdapted: boolean;
}

export interface SupremeConfig {
  enableMetaLearning: boolean;
  enableFeatureEvolution: boolean;
  enableQuantumEvolution: boolean;
  enableContinualLearning: boolean;
  enableSelfReflection: boolean;
  enableEnsemble: boolean;
  enableBayesian: boolean;
}

export class SupremeQuantumMind {
  // الطبقات السبع
  private ensemble: QuantumEnsemble;
  private selfReflection: SelfReflection;
  private continualLearner: ContinualLearner;
  private metaLearner: MetaLearner;
  private featureEvolution: FeatureEvolution;
  private quantumEvolution: QuantumEvolutionaryOptimizer;
  private bayesianCircuit: BayesianQuantumCircuit;
  
  private numQubits: number = 8;
  private config: SupremeConfig;
  
  // عدادات التكيف
  private tradeCounter: number = 0;
  private lastMetaTraining: number = 0;
  private lastFeatureEvolution: number = 0;
  private lastQuantumEvolution: number = 0;
  private lastContinualLearning: number = 0;
  
  // فترات التحديث
  private readonly META_TRAINING_INTERVAL = 86400000;      // يوم
  private readonly FEATURE_EVOLUTION_INTERVAL = 604800000; // أسبوع
  private readonly QUANTUM_EVOLUTION_INTERVAL = 259200000; // 3 أيام
  private readonly CONTINUAL_LEARNING_INTERVAL = 3600000;  // ساعة
  private readonly REFLECTION_INTERVAL = 25;                // كل 25 صفقة
  
  constructor(config?: Partial<SupremeConfig>) {
    this.config = {
      enableMetaLearning: true,
      enableFeatureEvolution: true,
      enableQuantumEvolution: true,
      enableContinualLearning: true,
      enableSelfReflection: true,
      enableEnsemble: true,
      enableBayesian: true,
      ...config
    };
    
    // تهيئة كل الطبقات
    this.bayesianCircuit = new BayesianQuantumCircuit(this.numQubits);
    this.selfReflection = new SelfReflection(this.bayesianCircuit);
    this.continualLearner = new ContinualLearner(this.bayesianCircuit);
    this.ensemble = new QuantumEnsemble(this.numQubits);
    this.metaLearner = new MetaLearner(this.numQubits);
    this.featureEvolution = new FeatureEvolution();
    this.quantumEvolution = new QuantumEvolutionaryOptimizer(this.numQubits);
  }
  
  /**
   * التدريب الأولي الشامل
   */
  async initializeTraining(
    historicalData: MarketData[],
    regimeLabels: MarketRegime[]
  ): Promise<void> {
    console.log('🧠 [SupremeMind] Starting comprehensive initialization...');
    
    // 1. Feature Evolution (اكتشاف الميزات)
    if (this.config.enableFeatureEvolution) {
      console.log('  📊 Evolving features...');
      await this.featureEvolution.evolve(historicalData);
      this.lastFeatureEvolution = Date.now();
    }
    
    // 2. Meta-Learning (تعلم نقطة البداية)
    if (this.config.enableMetaLearning) {
      console.log('  🎓 Meta-learning across regimes...');
      const tasks = MetaLearner.createTasksFromData(
        historicalData, 
        regimeLabels,
        7
      );
      await this.metaLearner.metaTrain(tasks);
      this.lastMetaTraining = Date.now();
    }
    
    // 3. Quantum Evolution (تطوير العقول)
    if (this.config.enableQuantumEvolution) {
      console.log('  🧬 Quantum evolution of experts...');
      
      // تقسيم البيانات حسب regime
      const regimes = Array.from(new Set(regimeLabels));
      
      for (const regime of regimes) {
        const regimeData = historicalData.filter((_, i) => regimeLabels[i] === regime);
        if (regimeData.length < 50) continue;
        
        // Train/Test split
        const splitIdx = Math.floor(regimeData.length * 0.7);
        const trainData = regimeData.slice(0, splitIdx);
        const testData = regimeData.slice(splitIdx);
        
        // تطوير عقل متخصص
        await this.quantumEvolution.evolve(
          trainData,
          regimeData.map(() => regime),
          testData
        );
        
        // تسجيل الأداء
        console.log(`    ✓ ${regime}: fitness = ${this.quantumEvolution.getEvolutionStats().bestFitness.toFixed(4)}`);
      }
      
      this.lastQuantumEvolution = Date.now();
    }
    
    console.log('✅ [SupremeMind] Initialization complete');
  }
  
  /**
   * اتخاذ قرار تداول
   */
  async decide(
    marketData: MarketData,
    regime: MarketRegime = 'SIDEWAYS'
  ): Promise<SupremeDecision> {
    // 1. استخراج الميزات (المطورة + الأساسية)
    const features = this.featureEvolution.extractFeatures(marketData);
    
    // 2. التكيف السريع مع الـ regime الحالي (Meta-Learning)
    let metaAdapted = false;
    if (this.config.enableMetaLearning) {
      await this.metaLearner.adaptToNewRegime(
        regime,
        [marketData],
        this.bayesianCircuit
      );
      metaAdapted = true;
    }
    
    // 3. الحصول على قرار من Ensemble
    let finalPrediction = 0;
    let finalConfidence = 0;
    let finalUncertainty = 1;
    let shouldTrade = false;
    let selectedExpert = regime as string;
    
    if (this.config.enableEnsemble) {
      const ensembleDecision = await this.ensemble.decide(features, regime, marketData);
      finalPrediction = ensembleDecision.finalPrediction;
      finalConfidence = ensembleDecision.finalConfidence;
      finalUncertainty = ensembleDecision.finalUncertainty;
      shouldTrade = ensembleDecision.shouldTrade;
      selectedExpert = ensembleDecision.selectedExpert;
    } else if (this.config.enableBayesian) {
      const bayesianPred = await this.bayesianCircuit.predictWithUncertainty(features);
      finalPrediction = bayesianPred.prediction;
      finalConfidence = bayesianPred.confidence;
      finalUncertainty = bayesianPred.uncertainty;
      shouldTrade = bayesianPred.shouldTrade;
    }
    
    // 4. Self-Reflection: تعديل العتبة
    if (this.config.enableSelfReflection) {
      const threshold = this.selfReflection.getConfidenceThreshold();
      shouldTrade = shouldTrade && finalConfidence >= threshold;
    }
    
    // 5. تحديد الإجراء
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (shouldTrade) {
      action = finalPrediction > 0 ? 'BUY' : 'SELL';
    }
    
    // 6. بناء التفسير
    const reasoning = this.buildReasoning({
      prediction: finalPrediction,
      confidence: finalConfidence,
      uncertainty: finalUncertainty,
      selectedExpert,
      metaAdapted
    });
    
    return {
      action,
      confidence: finalConfidence,
      uncertainty: finalUncertainty,
      prediction: finalPrediction,
      selectedExpert,
      evolvedFeatures: this.featureEvolution.getTopFeatures(8).map(f => f.formula),
      reasoning,
      shouldTrade,
      metaAdapted
    };
  }
  
  /**
   * تسجيل نتيجة صفقة
   */
  async recordTradeResult(
    decision: SupremeDecision,
    marketData: MarketData,
    pnl: number,
    entryPrice: number,
    exitPrice: number
  ): Promise<void> {
    this.tradeCounter++;
    
    // 1. تسجيل في Self-Reflection
    if (this.config.enableSelfReflection) {
      const tradeDecision: TradeDecision = {
        timestamp: Date.now(),
        features: this.featureEvolution.extractFeatures(marketData),
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
    }
    
    // 2. تدريب العقل المتخصص
    if (this.config.enableEnsemble) {
      const target = Math.tanh(pnl * 100);
      await this.ensemble.trainExpert(
        decision.selectedExpert,
        this.featureEvolution.extractFeatures(marketData),
        target,
        0.01
      );
    }
    
    // 3. تحديثات دورية
    await this.performPeriodicUpdates(marketData);
  }
  
  /**
   * التحديثات الدورية
   */
  private async performPeriodicUpdates(marketData: MarketData): Promise<void> {
    const now = Date.now();
    
    // Self-Reflection كل 25 صفقة
    if (this.config.enableSelfReflection && 
        this.tradeCounter % this.REFLECTION_INTERVAL === 0) {
      const insights = await this.selfReflection.reflect();
      console.log(`🪞 [Reflection] ${insights.length} insights applied`);
    }
    
    // Continual Learning كل ساعة
    if (this.config.enableContinualLearning && 
        now - this.lastContinualLearning > this.CONTINUAL_LEARNING_INTERVAL) {
      await this.continualLearner.learnIncremental([marketData]);
      this.lastContinualLearning = now;
      console.log('🔄 [Continual Learning] Updated');
    }
    
    // Quantum Evolution كل 3 أيام
    if (this.config.enableQuantumEvolution && 
        now - this.lastQuantumEvolution > this.QUANTUM_EVOLUTION_INTERVAL) {
      console.log('🧬 [Quantum Evolution] Triggered (needs data buffer)');
      this.lastQuantumEvolution = now;
    }
    
    // Feature Evolution كل أسبوع
    if (this.config.enableFeatureEvolution && 
        now - this.lastFeatureEvolution > this.FEATURE_EVOLUTION_INTERVAL) {
      console.log('📊 [Feature Evolution] Triggered (needs data buffer)');
      this.lastFeatureEvolution = now;
    }
    
    // Meta-Learning كل يوم
    if (this.config.enableMetaLearning && 
        now - this.lastMetaTraining > this.META_TRAINING_INTERVAL) {
      console.log('🎓 [Meta-Learning] Triggered (needs data buffer)');
      this.lastMetaTraining = now;
    }
  }
  
  /**
   * بناء تفسير للقرار
   */
  private buildReasoning(info: any): string {
    const parts: string[] = [];
    
    parts.push(`Expert: ${info.selectedExpert}`);
    parts.push(`Conf: ${(info.confidence * 100).toFixed(1)}%`);
    parts.push(`Uncert: ${info.uncertainty.toFixed(3)}`);
    
    if (info.metaAdapted) {
      parts.push('Meta-Adapted: ✓');
    }
    
    const direction = info.prediction > 0 ? 'BULLISH' : 'BEARISH';
    parts.push(`Signal: ${direction} (${info.prediction.toFixed(3)})`);
    
    return parts.join(' | ');
  }
  
  /**
   * إحصائيات شاملة
   */
  getFullStats(): any {
    return {
      tradeCounter: this.tradeCounter,
      performance: this.config.enableSelfReflection 
        ? this.selfReflection.getPerformanceStats() 
        : null,
      experts: this.config.enableEnsemble 
        ? Object.fromEntries(this.ensemble.getExpertStats()) 
        : null,
      metaLearning: this.config.enableMetaLearning 
        ? this.metaLearner.getAdaptationStats() 
        : null,
      features: this.config.enableFeatureEvolution 
        ? this.featureEvolution.getTopFeatures(8).map(f => ({
            formula: f.formula,
            importance: f.importance,
            mutualInfo: f.mutualInfo
          }))
        : null,
      evolution: this.config.enableQuantumEvolution 
        ? this.quantumEvolution.getEvolutionStats() 
        : null,
      continual: this.config.enableContinualLearning 
        ? this.continualLearner.getTrainingStats() 
        : null
    };
  }
  
  /**
   * حفظ الحالة
   */
  async saveState(): Promise<any> {
    return {
      tradeCounter: this.tradeCounter,
      lastMetaTraining: this.lastMetaTraining,
      lastFeatureEvolution: this.lastFeatureEvolution,
      lastQuantumEvolution: this.lastQuantumEvolution,
      lastContinualLearning: this.lastContinualLearning,
      bayesianWeights: this.bayesianCircuit.getWeights(),
      metaWeights: this.metaLearner.getMetaWeights(),
      topFeatures: this.featureEvolution.getTopFeatures(24).map(f => f.formula)
    };
  }
  
  /**
   * استعادة الحالة
   */
  async loadState(state: any): Promise<void> {
    this.tradeCounter = state.tradeCounter || 0;
    this.lastMetaTraining = state.lastMetaTraining || 0;
    this.lastFeatureEvolution = state.lastFeatureEvolution || 0;
    this.lastQuantumEvolution = state.lastQuantumEvolution || 0;
    this.lastContinualLearning = state.lastContinualLearning || 0;
    
    if (state.bayesianWeights) {
      this.bayesianCircuit.setWeights(state.bayesianWeights);
    }
    if (state.metaWeights) {
      this.metaLearner.setMetaWeights(state.metaWeights);
    }
  }
}
