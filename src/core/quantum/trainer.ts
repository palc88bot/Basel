import { QuantumMind } from './quantumMind';
import { QuantumOptimizer } from './optimizer';
import { Kline, OrderBookSnapshot } from './binanceWs';
import { QuantumTechnicalIndicators } from './indicators';

export interface QuantumTrainingSample {
    features: number[];
    label: number; // +1 (buy), -1 (sell), 0 (hold)
}

export interface TrainingConfig {
    epochs: number;
    batchSize: number;
    learningRate: number;
    lookaheadPeriod: number;
    profitThreshold: number;
    validationSplit: number;
    maxGradientBatches?: number;
}

export interface TrainingMetricsResult {
    finalLoss: number;
    trainAccuracy: number;
    valAccuracy: number;
    weights: number[][][];
    totalEpochs: number;
    history: Array<{ epoch: number; trainLoss: number; valLoss: number; trainAcc: number; valAcc: number }>;
}

/**
 * Quantum Trainer Engine for Hilbert Space Variational Quantum Circuits
 */
export class QuantumTrainer {
    private mind: QuantumMind;
    private optimizer: QuantumOptimizer;
    private config: TrainingConfig;

    constructor(mind: QuantumMind, config: Partial<TrainingConfig> = {}) {
        this.mind = mind;
        this.config = {
            epochs: config.epochs || 20,
            batchSize: config.batchSize || 16,
            learningRate: config.learningRate || 0.04,
            lookaheadPeriod: config.lookaheadPeriod || 5,
            profitThreshold: config.profitThreshold || 0.002,
            validationSplit: config.validationSplit || 0.2,
            maxGradientBatches: config.maxGradientBatches || 4
        };
        this.optimizer = new QuantumOptimizer(this.config.learningRate);
    }

    /**
     * Build training dataset from kline records and book snapshots
     */
    buildDataset(klines: Kline[], books?: OrderBookSnapshot[]): QuantumTrainingSample[] {
        const samples: QuantumTrainingSample[] = [];
        const minLookahead = this.config.lookaheadPeriod;
        
        const startIdx = Math.min(25, Math.floor(klines.length / 4));
        for (let i = startIdx; i < klines.length - minLookahead; i++) {
            const pastKlines = klines.slice(0, i + 1);
            const book = books && books[i] ? books[i] : null;
            
            const features = QuantumTechnicalIndicators.extractFeatures(pastKlines, book);
            
            const currentPrice = klines[i].close;
            const futurePrices = klines.slice(i + 1, i + 1 + minLookahead).map(k => k.close);
            const maxFuture = Math.max(...futurePrices);
            const minFuture = Math.min(...futurePrices);
            
            const upMove = (maxFuture - currentPrice) / (currentPrice || 1);
            const downMove = (currentPrice - minFuture) / (currentPrice || 1);
            
            let label = 0;
            if (upMove > this.config.profitThreshold && upMove > downMove * 1.3) {
                label = 1;
            } else if (downMove > this.config.profitThreshold && downMove > upMove * 1.3) {
                label = -1;
            }
            
            samples.push({ features, label });
        }
        
        return samples;
    }

    /**
     * Quantum Loss Function: Mean Squared Error with Quantum Regularization
     */
    loss(weights: number[][][], samples: QuantumTrainingSample[]): number {
        if (samples.length === 0) return 0;
        let totalLoss = 0;
        
        for (const sample of samples) {
            const prediction = this.mind.thinkWithWeights(sample.features, weights);
            const target = sample.label;
            
            if (target === 0) {
                totalLoss += prediction * prediction;
            } else {
                const error = 1 - target * prediction;
                totalLoss += Math.max(0, error) ** 2;
            }
        }
        
        // Quantum Regularization (Weight decay prevents saturation)
        let reg = 0;
        for (const layer of weights) {
            for (const qubit of layer) {
                for (const w of qubit) {
                    reg += w * w;
                }
            }
        }
        
        return totalLoss / samples.length + 0.0005 * reg;
    }

    /**
     * Classification Accuracy
     */
    accuracy(weights: number[][][], samples: QuantumTrainingSample[]): number {
        if (samples.length === 0) return 1;
        let correct = 0;
        for (const sample of samples) {
            const prediction = this.mind.thinkWithWeights(sample.features, weights);
            const predictedLabel = Math.abs(prediction) < 0.08 ? 0 : Math.sign(prediction);
            if (predictedLabel === sample.label) correct++;
        }
        return correct / samples.length;
    }

    /**
     * Execute training loop with early stopping
     */
    async train(
        klines: Kline[], 
        books?: OrderBookSnapshot[],
        onEpochProgress?: (epoch: number, total: number, trainLoss: number, valLoss: number) => void
    ): Promise<TrainingMetricsResult> {
        const samples = this.buildDataset(klines, books);
        if (samples.length === 0) {
            return {
                finalLoss: 0,
                trainAccuracy: 0,
                valAccuracy: 0,
                weights: this.mind.getAllWeights(),
                totalEpochs: 0,
                history: []
            };
        }
        
        const splitIdx = Math.floor(samples.length * (1 - this.config.validationSplit));
        const trainSamples = samples.slice(0, splitIdx);
        const valSamples = samples.slice(splitIdx);
        
        let weights = this.mind.getAllWeights();
        let bestWeights = weights;
        let bestValLoss = Infinity;
        let patienceCounter = 0;
        const patience = 6;
        const history: Array<{ epoch: number; trainLoss: number; valLoss: number; trainAcc: number; valAcc: number }> = [];

        for (let epoch = 0; epoch < this.config.epochs; epoch++) {
            // Shuffle
            const shuffled = [...trainSamples].sort(() => Math.random() - 0.5);
            
            // Sub-sampling mini-batches for parameter-shift efficiency
            const maxBatches = this.config.maxGradientBatches || 3;
            let batchCount = 0;

            for (let i = 0; i < shuffled.length && batchCount < maxBatches; i += this.config.batchSize) {
                const batch = shuffled.slice(i, i + this.config.batchSize);
                batchCount++;
                
                const gradient = this.optimizer.computeGradient(
                    weights,
                    (w) => this.loss(w, batch)
                );
                
                weights = this.optimizer.step(weights, gradient);
            }
            
            const trainLoss = this.loss(weights, trainSamples);
            const valLoss = this.loss(weights, valSamples.length > 0 ? valSamples : trainSamples);
            const trainAcc = this.accuracy(weights, trainSamples);
            const valAcc = this.accuracy(weights, valSamples.length > 0 ? valSamples : trainSamples);
            
            history.push({ epoch: epoch + 1, trainLoss, valLoss, trainAcc, valAcc });
            
            if (onEpochProgress) {
                onEpochProgress(epoch + 1, this.config.epochs, trainLoss, valLoss);
            }
            
            // Early stopping check
            if (valLoss < bestValLoss) {
                bestValLoss = valLoss;
                bestWeights = weights;
                patienceCounter = 0;
            } else {
                patienceCounter++;
                if (patienceCounter >= patience) {
                    break;
                }
            }
        }
        
        this.mind.updateAllWeights(bestWeights);
        const finalTrainAcc = this.accuracy(bestWeights, trainSamples);
        const finalValAcc = this.accuracy(bestWeights, valSamples.length > 0 ? valSamples : trainSamples);
        
        return {
            finalLoss: bestValLoss,
            trainAccuracy: finalTrainAcc,
            valAccuracy: finalValAcc,
            weights: bestWeights,
            totalEpochs: history.length,
            history
        };
    }
}
