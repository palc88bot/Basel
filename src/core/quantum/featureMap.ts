import { QuantumCircuit } from './circuit';

/**
 * الحواس الكمومية - تحويل بيانات السوق إلى حالات كمومية
 */
export class QuantumFeatureMap {
    private numQubits: number;

    constructor(numQubits: number) {
        this.numQubits = numQubits;
    }

    encode(features: number[]): QuantumCircuit {
        if (features.length !== this.numQubits) {
            // Trim or pad if length differs
            features = features.slice(0, this.numQubits);
            while (features.length < this.numQubits) {
                features.push(0);
            }
        }

        const circuit = new QuantumCircuit(this.numQubits);

        // حاسة 1: Angle Encoding
        for (let i = 0; i < this.numQubits; i++) {
            circuit.ry(features[i] * Math.PI, i);
        }

        // حاسة 2: Entanglement
        for (let i = 0; i < this.numQubits; i++) {
            circuit.cnot(i, (i + 1) % this.numQubits);
        }

        // حاسة 3: Phase Encoding
        for (let i = 0; i < this.numQubits; i++) {
            circuit.rz(features[i] * Math.PI / 2, i);
        }

        // حاسة 4: Deep Entanglement
        for (let i = 0; i < this.numQubits - 1; i += 2) {
            circuit.cnot(i, i + 1);
        }

        return circuit;
    }
}
