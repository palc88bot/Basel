// src/brain/quantum-evolution.ts
import { BayesianQuantumCircuit } from './bayesian-quantum';
import { MarketData } from '../data/data-buffer';
import { MarketRegime } from '../market/regime-detector';

export interface QuantumIndividual {
  id: string;
  circuit: BayesianQuantumCircuit;
  weights: number[];
  fitness: number;
  regime: MarketRegime;
  generation: number;
  parents?: string[];
  age: number;
}

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  eliteRatio: number;
  mutationRate: number;
  crossoverRate: number;
  quantumSuperposition: boolean;
  quantumTunneling: boolean;
}

export class QuantumEvolutionaryOptimizer {
  private population: QuantumIndividual[] = [];
  private config: EvolutionConfig;
  private generationCount: number = 0;
  private bestEver: QuantumIndividual | null = null;
  private fitnessHistory: number[] = [];
  private numQubits: number;
  private individualIdCounter: number = 0;
  
  constructor(numQubits: number, config?: Partial<EvolutionConfig>) {
    this.numQubits = numQubits;
    this.config = {
      populationSize: 50,
      generations: 100,
      eliteRatio: 0.1,
      mutationRate: 0.15,
      crossoverRate: 0.7,
      quantumSuperposition: true,
      quantumTunneling: true,
      ...config
    };
  }
  
  /**
   * عملية التطور الكاملة
   */
  async evolve(
    trainingData: MarketData[],
    regimeLabels: MarketRegime[],
    validationData?: MarketData[]
  ): Promise<BayesianQuantumCircuit> {
    console.log(`[QuantumEvolution] Starting evolution: ${this.config.populationSize} individuals × ${this.config.generations} generations`);
    
    // 1. تهيئة السكان الأولي
    this.initializePopulation(regimeLabels);
    
    // 2. التطور عبر الأجيال
    for (let gen = 0; gen < this.config.generations; gen++) {
      this.generationCount = gen;
      
      // تقييم اللياقة
      await this.evaluateFitness(trainingData, regimeLabels);
      
      // تسجيل الأفضل
      const best = this.getBestIndividual();
      if (best) {
        this.fitnessHistory.push(best.fitness);
        if (!this.bestEver || best.fitness > this.bestEver.fitness) {
          this.bestEver = { ...best };
        }
      }
      
      if (gen % 10 === 0) {
        const avgFitness = this.population.length > 0 
          ? this.population.reduce((s, i) => s + i.fitness, 0) / this.population.length 
          : 0;
        console.log(`  Gen ${gen}: Best = ${best?.fitness.toFixed(4) ?? '0'}, Avg = ${avgFitness.toFixed(4)}`);
      }
      
      // اختيار الآباء
      const parents = this.quantumTournamentSelect();
      
      // إنشاء الجيل التالي
      const offspring: QuantumIndividual[] = [];
      
      // Elitism
      const eliteCount = Math.floor(this.config.populationSize * this.config.eliteRatio);
      const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
      offspring.push(...sorted.slice(0, eliteCount).map(i => ({ ...i, age: i.age + 1 })));
      
      // Quantum Superposition Crossover
      while (offspring.length < this.config.populationSize) {
        let child: QuantumIndividual;
        
        if (Math.random() < this.config.crossoverRate && this.config.quantumSuperposition) {
          child = this.quantumSuperpositionCrossover(parents);
        } else {
          const p1 = parents[Math.floor(Math.random() * parents.length)] || this.population[0];
          child = this.cloneIndividual(p1);
        }
        
        // Quantum Mutation
        if (Math.random() < this.mutationRateForGen(gen)) {
          child = this.quantumMutation(child);
        }
        
        // Quantum Tunneling (الهروب من Local Optima)
        if (this.config.quantumTunneling && this.isStagnant()) {
          child = this.quantumTunneling(child);
        }
        
        offspring.push(child);
      }
      
      this.population = offspring.slice(0, this.config.populationSize);
    }
    
    // 3. Validation على البيانات غير المرئية
    if (validationData && validationData.length > 0) {
      await this.validateOnUnseen(validationData);
    }
    
    // 4. إرجاع أفضل دارة
    const best = this.getBestIndividual();
    if (!best) throw new Error('No valid individual found');
    
    const resultCircuit = new BayesianQuantumCircuit(this.numQubits);
    resultCircuit.setWeights(best.weights);
    
    console.log(`[QuantumEvolution] Evolution complete. Best fitness: ${best.fitness.toFixed(4)}`);
    
    return resultCircuit;
  }
  
  /**
   * تهيئة السكان الأولي
   */
  private initializePopulation(regimeLabels: MarketRegime[]): void {
    const regimes = Array.from(new Set(regimeLabels));
    const effectiveRegimes = regimes.length > 0 ? regimes : ['SIDEWAYS' as MarketRegime];
    
    this.population = [];
    
    for (let i = 0; i < this.config.populationSize; i++) {
      const circuit = new BayesianQuantumCircuit(this.numQubits);
      const weights = circuit.getWeights();
      const regime = effectiveRegimes[i % effectiveRegimes.length];
      
      this.population.push({
        id: `ind_${this.individualIdCounter++}`,
        circuit,
        weights,
        fitness: 0,
        regime,
        generation: 0,
        age: 0
      });
    }
  }
  
  /**
   * تقييم اللياقة لكل فرد
   */
  private async evaluateFitness(
    data: MarketData[],
    regimeLabels: MarketRegime[]
  ): Promise<void> {
    for (const individual of this.population) {
      // تقييم على البيانات الخاصة بالـ regime
      const regimeData = data.filter((_, i) => regimeLabels[i] === individual.regime);
      
      if (regimeData.length === 0) {
        individual.fitness = 0;
        continue;
      }
      
      // 1. Accuracy
      let correct = 0;
      let totalPnl = 0;
      const predictions: Array<{ pred: number; target: number }> = [];
      const samples = regimeData.slice(0, 100);
      
      for (const sample of samples) {
        const features = this.extractFeatures(sample);
        const target = Math.tanh((sample.futureReturn || 0) * 100);
        
        // تقييم بأوزان الفرد
        const pred = await this.evaluateWithWeights(individual.weights, features);
        predictions.push({ pred, target });
        
        if (Math.sign(pred) === Math.sign(target)) correct++;
        totalPnl += pred * target; // Profit approximation
      }
      
      const accuracy = samples.length > 0 ? correct / samples.length : 0;
      
      // 2. Risk-Adjusted Return (Sharpe-like)
      const returns = predictions.map(p => p.pred * p.target);
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const stdReturn = returns.length > 0 ? Math.sqrt(
        returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length
      ) : 0;
      const sharpe = stdReturn > 0 ? avgReturn / stdReturn : 0;
      
      // 3. Drawdown Penalty
      let peak = 0;
      let maxDrawdown = 0;
      let cumReturn = 0;
      for (const r of returns) {
        cumReturn += r;
        peak = Math.max(peak, cumReturn);
        const dd = peak - cumReturn;
        maxDrawdown = Math.max(maxDrawdown, dd);
      }
      
      // 4. Complexity Penalty (L2 Regularization)
      const complexity = individual.weights.reduce((s, w) => s + w * w, 0);
      const complexityPenalty = complexity * 0.001;
      
      // 5. Fitness النهائي
      individual.fitness = 
        accuracy * 0.4 +
        Math.max(0, sharpe) * 0.3 +
        totalPnl * 0.2 -
        maxDrawdown * 0.05 -
        complexityPenalty;
      
      // مكافأة التنوع (عمر الفرد)
      individual.fitness += Math.min(0.05, individual.age * 0.005);
    }
  }
  
  /**
   * Quantum Tournament Selection
   */
  private quantumTournamentSelect(): QuantumIndividual[] {
    const selected: QuantumIndividual[] = [];
    const tournamentSize = 5;
    
    for (let i = 0; i < this.config.populationSize; i++) {
      // اختيار عشوائي + تراكب كمومي
      const candidates: QuantumIndividual[] = [];
      
      for (let j = 0; j < tournamentSize; j++) {
        candidates.push(this.population[Math.floor(Math.random() * this.population.length)] || this.population[0]);
      }
      
      // Quantum Selection: احتمالية الاختيار تتناسب مع اللياقة
      const totalFitness = candidates.reduce((s, c) => s + Math.max(0, c.fitness), 0);
      
      if (totalFitness === 0) {
        selected.push(candidates[Math.floor(Math.random() * candidates.length)]);
      } else {
        let r = Math.random() * totalFitness;
        let chosen = candidates[0];
        
        for (const c of candidates) {
          r -= Math.max(0, c.fitness);
          if (r <= 0) {
            chosen = c;
            break;
          }
        }
        
        selected.push(chosen);
      }
    }
    
    return selected;
  }
  
  /**
   * Quantum Superposition Crossover
   * دمج الأوزان في حالة تراكب كمومي
   */
  private quantumSuperpositionCrossover(parents: QuantumIndividual[]): QuantumIndividual {
    // اختيار 2-4 آباء للتراكب
    const numParents = Math.min(parents.length, 2 + Math.floor(Math.random() * 3));
    const selectedParents: QuantumIndividual[] = [];
    
    for (let i = 0; i < numParents; i++) {
      selectedParents.push(parents[Math.floor(Math.random() * parents.length)] || parents[0]);
    }
    
    // أوزان التراكب (Complex Amplitudes)
    const alphas = selectedParents.map(() => Math.random());
    const sum = alphas.reduce((a, b) => a + b, 0) || 1;
    const normalizedAlphas = alphas.map(a => a / sum);
    
    // تراكب الأوزان
    const weightLength = selectedParents[0]?.weights?.length || (this.numQubits * 3 * 3);
    const childWeights = new Array(weightLength).fill(0);
    
    for (let p = 0; p < selectedParents.length; p++) {
      const parent = selectedParents[p];
      const alpha = normalizedAlphas[p];
      
      for (let i = 0; i < childWeights.length; i++) {
        // Quantum Interference: تداخل كمومي
        const phase = Math.random() * Math.PI * 2;
        childWeights[i] += alpha * (parent.weights[i] || 0) * Math.cos(phase);
      }
    }
    
    // اختيار regime من أحد الآباء
    const regimeParent = selectedParents[Math.floor(Math.random() * selectedParents.length)] || selectedParents[0];
    
    return {
      id: `child_${this.individualIdCounter++}`,
      circuit: new BayesianQuantumCircuit(this.numQubits),
      weights: childWeights,
      fitness: 0,
      regime: regimeParent.regime,
      generation: this.generationCount + 1,
      parents: selectedParents.map(p => p.id),
      age: 0
    };
  }
  
  /**
   * Quantum Mutation
   */
  private quantumMutation(individual: QuantumIndividual): QuantumIndividual {
    const newWeights = [...individual.weights];
    
    // نوع الطفرة
    const mutationType = Math.random();
    
    if (mutationType < 0.4) {
      // Gaussian Mutation
      for (let i = 0; i < newWeights.length; i++) {
        if (Math.random() < 0.1) {
          const u1 = Math.max(1e-10, Math.random());
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          newWeights[i] += z * 0.1;
        }
      }
    } else if (mutationType < 0.7) {
      // Quantum Phase Mutation: تدوير في فضاء هيلبرت
      for (let i = 0; i < newWeights.length; i++) {
        if (Math.random() < 0.15) {
          const phase = (Math.random() - 0.5) * Math.PI * 0.5;
          newWeights[i] = newWeights[i] * Math.cos(phase) + Math.sin(phase) * 0.1;
        }
      }
    } else {
      // Jump Mutation: قفزات كبيرة (استكشاف)
      const jumpIdx = Math.floor(Math.random() * newWeights.length);
      newWeights[jumpIdx] = (Math.random() - 0.5) * 2;
    }
    
    return {
      ...individual,
      id: `mut_${this.individualIdCounter++}`,
      weights: newWeights,
      generation: this.generationCount + 1,
      parents: [individual.id]
    };
  }
  
  /**
   * Quantum Tunneling: الهروب من Local Optima
   */
  private quantumTunneling(individual: QuantumIndividual): QuantumIndividual {
    const newWeights = [...individual.weights];
    
    // احتمال العبور يتناسب مع "ارتفاع الحاجز" (ضعف اللياقة)
    const tunnelingProb = Math.max(0.1, 1 - individual.fitness);
    
    if (Math.random() < tunnelingProb) {
      // عبور كمومي: إعادة تعيين عشوائية لجزء من الأوزان
      const numToReset = Math.floor(newWeights.length * 0.3);
      const indices = Array.from({ length: newWeights.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, numToReset);
      
      for (const idx of indices) {
        newWeights[idx] = (Math.random() - 0.5) * 0.5;
      }
    }
    
    return {
      ...individual,
      id: `tunnel_${this.individualIdCounter++}`,
      weights: newWeights,
      generation: this.generationCount + 1,
      parents: [individual.id]
    };
  }
  
  /**
   * Clone Individual
   */
  private cloneIndividual(individual: QuantumIndividual): QuantumIndividual {
    return {
      ...individual,
      id: `clone_${this.individualIdCounter++}`,
      weights: [...individual.weights],
      generation: this.generationCount + 1,
      age: individual.age + 1
    };
  }
  
  /**
   * معدل الطفرة المتكيف
   */
  private mutationRateForGen(gen: number): number {
    // تقليل الطفرة مع التقدم (استكشاف → استغلال)
    const decay = Math.exp(-gen / (this.config.generations * 0.3));
    return this.config.mutationRate * decay + 0.02;
  }
  
  /**
   * كشف الركود
   */
  private isStagnant(): boolean {
    if (this.fitnessHistory.length < 10) return false;
    
    const recent = this.fitnessHistory.slice(-10);
    const improvement = recent[recent.length - 1] - recent[0];
    
    return improvement < 0.01;
  }
  
  /**
   * الحصول على أفضل فرد
   */
  private getBestIndividual(): QuantumIndividual | null {
    if (this.population.length === 0) return null;
    return this.population.reduce((best, ind) => 
      ind.fitness > best.fitness ? ind : best
    );
  }
  
  /**
   * تقييم بأوزان محددة
   */
  private async evaluateWithWeights(weights: number[], features: number[]): Promise<number> {
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
  
  /**
   * Validation على بيانات غير مرئية
   */
  private async validateOnUnseen(data: MarketData[]): Promise<void> {
    console.log('[QuantumEvolution] Validating on unseen data...');
    
    let totalCorrect = 0;
    let totalSamples = 0;
    
    for (const individual of this.population.slice(0, 10)) {
      let correct = 0;
      const samples = data.slice(0, 50);
      
      for (const sample of samples) {
        const features = this.extractFeatures(sample);
        const target = Math.tanh((sample.futureReturn || 0) * 100);
        const pred = await this.evaluateWithWeights(individual.weights, features);
        
        if (Math.sign(pred) === Math.sign(target)) correct++;
      }
      
      totalCorrect += correct;
      totalSamples += samples.length;
    }
    
    const validationAccuracy = totalSamples > 0 ? totalCorrect / totalSamples : 0;
    console.log(`  Validation Accuracy: ${(validationAccuracy * 100).toFixed(2)}%`);
    
    // عقاب الأفراد الذين overfit
    for (const ind of this.population) {
      const overfitRatio = ind.fitness / (validationAccuracy + 0.01);
      if (overfitRatio > 2) {
        ind.fitness *= 0.7; // عقاب 30%
      }
    }
  }
  
  /**
   * الحصول على أفضل دارة
   */
  getBestCircuit(): BayesianQuantumCircuit | null {
    if (!this.bestEver) return null;
    
    const circuit = new BayesianQuantumCircuit(this.numQubits);
    circuit.setWeights(this.bestEver.weights);
    return circuit;
  }
  
  getEvolutionStats(): {
    generations: number;
    bestFitness: number;
    avgFitness: number;
    populationDiversity: number;
    fitnessHistory: number[];
  } {
    const fitnesses = this.population.map(i => i.fitness);
    const avg = fitnesses.length > 0 ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length : 0;
    const best = fitnesses.length > 0 ? Math.max(...fitnesses) : 0;
    
    // قياس التنوع (Standard Deviation)
    const variance = fitnesses.length > 0 
      ? fitnesses.reduce((s, f) => s + Math.pow(f - avg, 2), 0) / fitnesses.length 
      : 0;
    const diversity = Math.sqrt(variance);
    
    return {
      generations: this.generationCount,
      bestFitness: best,
      avgFitness: avg,
      populationDiversity: diversity,
      fitnessHistory: [...this.fitnessHistory]
    };
  }
}
