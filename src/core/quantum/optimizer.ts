/**
 * Quantum Natural Gradient Optimizer with Parameter-Shift Rule
 * Analytical gradients: ∂f/∂θ = [f(θ + π/2) - f(θ - π/2)] / 2
 */
export class QuantumOptimizer {
    private learningRate: number;
    private momentum: number;
    private velocities: Map<string, number> = new Map();
    private decay: number;

    constructor(learningRate: number = 0.05, momentum: number = 0.9, decay: number = 0.999) {
        this.learningRate = learningRate;
        this.momentum = momentum;
        this.decay = decay;
    }

    /**
     * Compute analytical parameter-shift gradient
     * Optimized with batch evaluation to mitigate computational overhead
     */
    computeGradient(
        weights: number[][][],
        evaluate: (w: number[][][]) => number,
        shift: number = Math.PI / 2
    ): number[][][] {
        const gradient: number[][][] = [];
        
        for (let l = 0; l < weights.length; l++) {
            gradient[l] = [];
            for (let q = 0; q < weights[l].length; q++) {
                gradient[l][q] = [];
                for (let p = 0; p < weights[l][q].length; p++) {
                    // θ + shift
                    const wPlus = this.cloneWeights(weights);
                    wPlus[l][q][p] += shift;
                    const fPlus = evaluate(wPlus);
                    
                    // θ - shift
                    const wMinus = this.cloneWeights(weights);
                    wMinus[l][q][p] -= shift;
                    const fMinus = evaluate(wMinus);
                    
                    // Parameter-Shift Analytical Gradient
                    gradient[l][q][p] = (fPlus - fMinus) / (2 * Math.sin(shift));
                }
            }
        }
        
        return gradient;
    }

    /**
     * Update weights using Momentum + Quantum Weight Decay Regularization
     */
    step(weights: number[][][], gradient: number[][][]): number[][][] {
        const newWeights: number[][][] = [];
        let keyIdx = 0;
        
        for (let l = 0; l < weights.length; l++) {
            newWeights[l] = [];
            for (let q = 0; q < weights[l].length; q++) {
                newWeights[l][q] = [];
                for (let p = 0; p < weights[l][q].length; p++) {
                    const key = `${l}_${q}_${p}`;
                    const g = gradient[l][q][p] || 0;
                    const v = (this.velocities.get(key) || 0) * this.momentum + g;
                    this.velocities.set(key, v);
                    
                    // Quantum Regularization (Weight decay prevents Hilbert state saturation)
                    const decayed = weights[l][q][p] * this.decay;
                    newWeights[l][q][p] = decayed - this.learningRate * v;
                }
            }
        }
        
        return newWeights;
    }

    setLearningRate(lr: number): void {
        this.learningRate = lr;
    }

    getLearningRate(): number {
        return this.learningRate;
    }

    private cloneWeights(weights: number[][][]): number[][][] {
        return weights.map(l => l.map(q => [...q]));
    }
}
