import { QuantumFeatureMap } from './featureMap';
import { ThinkingLayer } from './thinkingLayer';

export class QuantumMind {
    private static instance: QuantumMind;
    private numQubits: number;
    private numLayers: number;
    private featureMap: QuantumFeatureMap;
    private thinkingLayers: ThinkingLayer[];

    constructor(numQubits: number = 8, numLayers: number = 3) {
        this.numQubits = numQubits;
        this.numLayers = numLayers;
        this.featureMap = new QuantumFeatureMap(numQubits);
        
        this.thinkingLayers = Array(numLayers).fill(null).map(
            () => new ThinkingLayer(numQubits)
        );
    }

    public static getInstance(): QuantumMind {
        if (!QuantumMind.instance) {
            QuantumMind.instance = new QuantumMind(8, 3);
        }
        return QuantumMind.instance;
    }

    think(features: number[]): number {
        const circuit = this.featureMap.encode(features);

        for (const layer of this.thinkingLayers) {
            layer.apply(circuit);
        }

        circuit.execute();
        return circuit.expectationValue();
    }

    decide(features: number[]): { decision: number; confidence: number; label: string; HilbertEnergy: number } {
        const prediction = this.think(features);
        
        const threshold = 0.1;
        
        let decision: number;
        let label: string;
        if (prediction > threshold) {
            decision = 1;
            label = 'شراء 🟢 (Long Spread)';
        } else if (prediction < -threshold) {
            decision = -1;
            label = 'بيع 🔴 (Short Spread)';
        } else {
            decision = 0;
            label = 'انتظار ⚪ (Neutral)';
        }

        return {
            decision,
            confidence: parseFloat((Math.abs(prediction) * 100).toFixed(2)),
            label,
            HilbertEnergy: parseFloat((prediction * 1.618).toFixed(4))
        };
    }

    thinkWithWeights(features: number[], weights: number[][][]): number {
        const circuit = this.featureMap.encode(features);

        for (let i = 0; i < this.numLayers; i++) {
            const w = weights && weights[i] ? weights[i] : this.thinkingLayers[i].getWeights();
            const tempLayer = new ThinkingLayer(this.numQubits, w);
            tempLayer.apply(circuit);
        }

        circuit.execute();
        return circuit.expectationValue();
    }

    getAllWeights(): number[][][] {
        return this.thinkingLayers.map(layer => layer.getWeights());
    }

    updateAllWeights(weights: number[][][]): void {
        for (let i = 0; i < this.thinkingLayers.length; i++) {
            if (weights[i]) {
                this.thinkingLayers[i].updateWeights(weights[i]);
            }
        }
    }

    getNumQubits(): number {
        return this.numQubits;
    }

    getNumLayers(): number {
        return this.numLayers;
    }
}
