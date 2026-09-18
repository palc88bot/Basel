// src/brain/feature-evolution.ts
import { MarketData } from '../data/data-buffer';

export interface EvolvedFeature {
  id: string;
  formula: string;
  compute: (data: MarketData) => number;
  importance: number;
  mutualInfo: number;
  generation: number;
  parents?: string[];
}

export interface FeaturePopulation {
  features: EvolvedFeature[];
  generation: number;
  bestFitness: number;
}

export class FeatureEvolution {
  private baseFeatures: Map<string, (d: MarketData) => number> = new Map();
  private evolvedFeatures: EvolvedFeature[] = [];
  private population: FeaturePopulation[] = [];
  private maxFeatures: number = 24;       // 8 أساسية + 16 مكتشفة
  private populationSize: number = 100;
  private generations: number = 50;
  private mutationRate: number = 0.2;
  private crossoverRate: number = 0.7;
  private featureIdCounter: number = 0;
  
  constructor() {
    this.initializeBaseFeatures();
  }
  
  /**
   * تهيئة الميزات الأساسية (8 حواس)
   */
  private initializeBaseFeatures(): void {
    this.baseFeatures.set('rsi', d => d.rsi / 100);
    this.baseFeatures.set('macd', d => d.macdHistogram / 100);
    this.baseFeatures.set('bb', d => d.bbPercentB);
    this.baseFeatures.set('atr', d => d.atrNormalized);
    this.baseFeatures.set('volume', d => d.volumeDelta);
    this.baseFeatures.set('ob', d => d.orderBookImbalance);
    this.baseFeatures.set('momentum', d => d.momentum);
    this.baseFeatures.set('price', d => d.priceAction);
    
    // تحويل الميزات الأساسية إلى EvolvedFeature
    let idx = 0;
    for (const [name, compute] of this.baseFeatures) {
      this.evolvedFeatures.push({
        id: `base_${idx++}`,
        formula: name,
        compute,
        importance: 1.0,
        mutualInfo: 0,
        generation: 0
      });
    }
  }
  
  /**
   * عملية التطور الكاملة
   */
  async evolve(data: MarketData[]): Promise<EvolvedFeature[]> {
    console.log(`[FeatureEvolution] Starting evolution with ${data.length} samples`);
    
    // 1. إنشاء الجيل الأول (Population Initialization)
    let currentPop = this.createInitialPopulation();
    
    // 2. التطور عبر الأجيال
    for (let gen = 0; gen < this.generations; gen++) {
      // تقييم اللياقة
      const fitnesses = await this.evaluateFitness(currentPop, data);
      
      // تسجيل الجيل
      const bestFitness = Math.max(...fitnesses.map(f => f.fitness));
      this.population.push({
        features: [...currentPop],
        generation: gen,
        bestFitness
      });
      
      if (gen % 10 === 0) {
        console.log(`  Gen ${gen}: Best Fitness = ${bestFitness.toFixed(4)}`);
      }
      
      // اختيار الآباء
      const parents = this.tournamentSelect(currentPop, fitnesses);
      
      // إنشاء الجيل التالي
      const offspring: EvolvedFeature[] = [];
      
      // Elitism: أفضل 10% ينتقلون مباشرة
      const eliteCount = Math.floor(this.populationSize * 0.1);
      const sorted = currentPop.map((f, i) => ({ f, fitness: fitnesses[i].fitness }))
        .sort((a, b) => b.fitness - a.fitness)
        .slice(0, eliteCount)
        .map(x => x.f);
      offspring.push(...sorted);
      
      // Crossover + Mutation
      while (offspring.length < this.populationSize) {
        const p1 = parents[Math.floor(Math.random() * parents.length)] || currentPop[0];
        const p2 = parents[Math.floor(Math.random() * parents.length)] || currentPop[0];
        
        let child: EvolvedFeature;
        
        if (Math.random() < this.crossoverRate) {
          child = this.crossover(p1, p2, gen + 1);
        } else {
          child = { ...p1, generation: gen + 1 };
        }
        
        if (Math.random() < this.mutationRate) {
          child = this.mutate(child, gen + 1);
        }
        
        offspring.push(child);
      }
      
      currentPop = offspring;
    }
    
    // 3. اختيار أفضل الميزات النهائية
    const finalFitnesses = await this.evaluateFitness(currentPop, data);
    const ranked = currentPop.map((f, i) => ({
      feature: f,
      fitness: finalFitnesses[i]?.fitness ?? 0,
      mutualInfo: finalFitnesses[i]?.mutualInfo ?? 0
    }))
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, this.maxFeatures);
    
    // تحديث الأهمية
    this.evolvedFeatures = ranked.map((r) => ({
      ...r.feature,
      importance: r.fitness,
      mutualInfo: r.mutualInfo
    }));
    
    console.log(`[FeatureEvolution] Evolution complete. Top features:`);
    this.evolvedFeatures.slice(0, 10).forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.formula} (MI: ${f.mutualInfo.toFixed(4)})`);
    });
    
    return this.evolvedFeatures;
  }
  
  /**
   * إنشاء الجيل الأول
   */
  private createInitialPopulation(): EvolvedFeature[] {
    const population: EvolvedFeature[] = [];
    const baseNames = Array.from(this.baseFeatures.keys());
    
    // 1. الميزات الأساسية
    for (const [name, compute] of this.baseFeatures) {
      population.push({
        id: `base_${this.featureIdCounter++}`,
        formula: name,
        compute,
        importance: 1.0,
        mutualInfo: 0,
        generation: 0
      });
    }
    
    // 2. تركيبات ثنائية (Binary Combinations)
    for (let i = 0; i < baseNames.length; i++) {
      for (let j = i + 1; j < baseNames.length; j++) {
        const f1 = baseNames[i];
        const f2 = baseNames[j];
        const c1 = this.baseFeatures.get(f1)!;
        const c2 = this.baseFeatures.get(f2)!;
        
        // عمليات مختلفة
        const operations = [
          { op: '+', fn: (d: MarketData) => c1(d) + c2(d) },
          { op: '-', fn: (d: MarketData) => c1(d) - c2(d) },
          { op: '*', fn: (d: MarketData) => c1(d) * c2(d) },
          { op: '/', fn: (d: MarketData) => {
            const v = c2(d);
            return Math.abs(v) < 1e-6 ? 0 : c1(d) / v;
          }},
          { op: 'diff', fn: (d: MarketData) => Math.abs(c1(d) - c2(d)) }
        ];
        
        for (const { op, fn } of operations) {
          population.push({
            id: `gen_${this.featureIdCounter++}`,
            formula: `(${f1} ${op} ${f2})`,
            compute: fn,
            importance: 0.5,
            mutualInfo: 0,
            generation: 0
          });
        }
      }
    }
    
    // 3. ميزات غير خطية (Non-linear)
    for (const name of baseNames) {
      const c = this.baseFeatures.get(name)!;
      const transforms = [
        { op: 'sin', fn: (d: MarketData) => Math.sin(c(d) * Math.PI) },
        { op: 'abs', fn: (d: MarketData) => Math.abs(c(d)) },
        { op: 'square', fn: (d: MarketData) => Math.pow(c(d), 2) },
        { op: 'sign', fn: (d: MarketData) => Math.sign(c(d)) * Math.sqrt(Math.abs(c(d))) }
      ];
      
      for (const { op, fn } of transforms) {
        population.push({
          id: `gen_${this.featureIdCounter++}`,
          formula: `${op}(${name})`,
          compute: fn,
          importance: 0.5,
          mutualInfo: 0,
          generation: 0
        });
      }
    }
    
    // 4. ملء الباقي بعشوائية
    while (population.length < this.populationSize) {
      const i = Math.floor(Math.random() * baseNames.length);
      const j = Math.floor(Math.random() * baseNames.length);
      if (i === j) continue;
      
      const f1 = baseNames[i];
      const f2 = baseNames[j];
      const c1 = this.baseFeatures.get(f1)!;
      const c2 = this.baseFeatures.get(f2)!;
      
      const w1 = Math.random();
      const w2 = Math.random();
      
      population.push({
        id: `rand_${this.featureIdCounter++}`,
        formula: `(${w1.toFixed(2)}*${f1} + ${w2.toFixed(2)}*${f2})`,
        compute: (d: MarketData) => w1 * c1(d) + w2 * c2(d),
        importance: 0.3,
        mutualInfo: 0,
        generation: 0
      });
    }
    
    return population.slice(0, this.populationSize);
  }
  
  /**
   * تقييم اللياقة (Fitness Evaluation)
   */
  private async evaluateFitness(
    population: EvolvedFeature[],
    data: MarketData[]
  ): Promise<Array<{ fitness: number; mutualInfo: number }>> {
    const results: Array<{ fitness: number; mutualInfo: number }> = [];
    
    if (!data || data.length === 0) {
      return population.map(() => ({ fitness: 0, mutualInfo: 0 }));
    }

    // حساب targets (العائد المستقبلي)
    const targets = data.map(d => Math.tanh((d.futureReturn || 0) * 100));
    
    for (const feature of population) {
      try {
        // حساب قيم الميزة
        const values = data.map(d => {
          try {
            const v = feature.compute(d);
            return isFinite(v) ? v : 0;
          } catch {
            return 0;
          }
        });
        
        // 1. Mutual Information مع الهدف
        const mi = this.computeMutualInformation(values, targets);
        
        // 2. Correlation مع الهدف
        const corr = this.computeCorrelation(values, targets);
        
        // 3. عقاب التعقيد (Occam's Razor)
        const complexityPenalty = this.computeComplexityPenalty(feature);
        
        // 4. عقاب التكرار (Redundancy)
        const redundancyPenalty = this.computeRedundancy(feature, population);
        
        // اللياقة النهائية
        const fitness = (Math.abs(mi) * 0.5 + Math.abs(corr) * 0.5) 
          * (1 - complexityPenalty) 
          * (1 - redundancyPenalty);
        
        results.push({
          fitness: Math.max(0, fitness),
          mutualInfo: mi
        });
      } catch {
        results.push({ fitness: 0, mutualInfo: 0 });
      }
    }
    
    return results;
  }
  
  /**
   * حساب Mutual Information
   */
  private computeMutualInformation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    
    // Discretization إلى bins
    const bins = 10;
    const xMin = Math.min(...x);
    const xMax = Math.max(...x);
    const yMin = Math.min(...y);
    const yMax = Math.max(...y);
    
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    
    // Joint histogram
    const joint = Array.from({ length: bins }, () => new Array(bins).fill(0));
    const xMarginal = new Array(bins).fill(0);
    const yMarginal = new Array(bins).fill(0);
    
    for (let i = 0; i < n; i++) {
      const xi = Math.min(bins - 1, Math.floor((x[i] - xMin) / xRange * bins));
      const yi = Math.min(bins - 1, Math.floor((y[i] - yMin) / yRange * bins));
      joint[xi][yi]++;
      xMarginal[xi]++;
      yMarginal[yi]++;
    }
    
    // MI = Σ p(x,y) log(p(x,y) / (p(x)p(y)))
    let mi = 0;
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        if (joint[i][j] === 0) continue;
        const pxy = joint[i][j] / n;
        const px = xMarginal[i] / n;
        const py = yMarginal[j] / n;
        if (px > 0 && py > 0) {
          mi += pxy * Math.log(pxy / (px * py));
        }
      }
    }
    
    return mi;
  }
  
  /**
   * حساب Correlation
   */
  private computeCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;
    
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const xd = x[i] - xMean;
      const yd = y[i] - yMean;
      num += xd * yd;
      dx += xd * xd;
      dy += yd * yd;
    }
    
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
  }
  
  /**
   * عقاب التعقيد
   */
  private computeComplexityPenalty(feature: EvolvedFeature): number {
    // كل عملية تضيف 0.05 للعقوبة
    const ops = (feature.formula.match(/[\+\-\*\/\(\)]/g) || []).length;
    return Math.min(0.5, ops * 0.05);
  }
  
  /**
   * عقاب التكرار
   */
  private computeRedundancy(
    feature: EvolvedFeature,
    population: EvolvedFeature[]
  ): number {
    // عقاب إذا كانت الصيغة مشابهة لصيغ أخرى
    const similar = population.filter(f => 
      f.id !== feature.id && f.formula === feature.formula
    ).length;
    return Math.min(0.5, similar * 0.1);
  }
  
  /**
   * Tournament Selection
   */
  private tournamentSelect(
    population: EvolvedFeature[],
    fitnesses: Array<{ fitness: number; mutualInfo: number }>,
    tournamentSize: number = 5
  ): EvolvedFeature[] {
    const selected: EvolvedFeature[] = [];
    
    for (let i = 0; i < this.populationSize; i++) {
      let bestIdx = 0;
      let bestFitness = -Infinity;
      
      for (let j = 0; j < tournamentSize; j++) {
        const idx = Math.floor(Math.random() * population.length);
        const fit = fitnesses[idx]?.fitness ?? -Infinity;
        if (fit > bestFitness) {
          bestFitness = fit;
          bestIdx = idx;
        }
      }
      
      selected.push(population[bestIdx] || population[0]);
    }
    
    return selected;
  }
  
  /**
   * Crossover (Symbolic Crossover)
   */
  private crossover(
    p1: EvolvedFeature,
    p2: EvolvedFeature,
    generation: number
  ): EvolvedFeature {
    const w = Math.random();
    
    return {
      id: `cross_${this.featureIdCounter++}`,
      formula: `(${w.toFixed(2)}*[${p1.formula}] + ${(1 - w).toFixed(2)}*[${p2.formula}])`,
      compute: (d: MarketData) => {
        const v1 = p1.compute(d);
        const v2 = p2.compute(d);
        return w * v1 + (1 - w) * v2;
      },
      importance: 0.5,
      mutualInfo: 0,
      generation,
      parents: [p1.id, p2.id]
    };
  }
  
  /**
   * Mutation
   */
  private mutate(feature: EvolvedFeature, generation: number): EvolvedFeature {
    const mutationType = Math.random();
    
    if (mutationType < 0.3) {
      // Mutation 1: إضافة عملية رياضية
      const ops = ['sin', 'cos', 'abs', 'sqrt', 'square'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      
      return {
        id: `mut_${this.featureIdCounter++}`,
        formula: `${op}(${feature.formula})`,
        compute: (d: MarketData) => {
          const v = feature.compute(d);
          switch (op) {
            case 'sin': return Math.sin(v * Math.PI);
            case 'cos': return Math.cos(v * Math.PI);
            case 'abs': return Math.abs(v);
            case 'sqrt': return Math.sqrt(Math.abs(v)) * Math.sign(v);
            case 'square': return v * v;
            default: return v;
          }
        },
        importance: feature.importance,
        mutualInfo: 0,
        generation,
        parents: [feature.id]
      };
    } else if (mutationType < 0.6) {
      // Mutation 2: خلط مع ميزة أساسية
      const baseNames = Array.from(this.baseFeatures.keys());
      const baseName = baseNames[Math.floor(Math.random() * baseNames.length)];
      const baseCompute = this.baseFeatures.get(baseName)!;
      const w = Math.random();
      
      return {
        id: `mut_${this.featureIdCounter++}`,
        formula: `(${w.toFixed(2)}*[${feature.formula}] + ${(1 - w).toFixed(2)}*${baseName})`,
        compute: (d: MarketData) => w * feature.compute(d) + (1 - w) * baseCompute(d),
        importance: feature.importance,
        mutualInfo: 0,
        generation,
        parents: [feature.id, `base_${baseName}`]
      };
    } else {
      // Mutation 3: تغيير طفيف في الأوزان
      const perturbation = (Math.random() - 0.5) * 0.2;
      
      return {
        id: `mut_${this.featureIdCounter++}`,
        formula: `(${(1 + perturbation).toFixed(2)}*[${feature.formula}])`,
        compute: (d: MarketData) => (1 + perturbation) * feature.compute(d),
        importance: feature.importance,
        mutualInfo: 0,
        generation,
        parents: [feature.id]
      };
    }
  }
  
  /**
   * استخراج الميزات من مصفوفة بيانات السوق
   */
  extractAllFeatures(data: MarketData[]): number[][] {
    return data.map(d => 
      this.evolvedFeatures.map(f => {
        try {
          const v = f.compute(d);
          return isFinite(v) ? v : 0;
        } catch {
          return 0;
        }
      })
    );
  }
  
  /**
   * استخراج ميزات لنقطة واحدة
   */
  extractFeatures(data: MarketData): number[] {
    return this.evolvedFeatures.map(f => {
      try {
        const v = f.compute(data);
        return isFinite(v) ? v : 0;
      } catch {
        return 0;
      }
    });
  }
  
  getTopFeatures(n: number = 16): EvolvedFeature[] {
    return [...this.evolvedFeatures]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, n);
  }
  
  getEvolutionHistory(): FeaturePopulation[] {
    return this.population;
  }
  
  getNumFeatures(): number {
    return this.evolvedFeatures.length;
  }
}
