import { Qubit } from './qubit';
import { QuantumGates } from './gates';
import { Matrix, Complex } from 'mathjs';

export class QuantumCircuit {
    private qubits: Qubit[];
    private gates: Array<{ gate: Matrix; targetQubits: number[] }>;

    constructor(numQubits: number) {
        this.qubits = Array(numQubits).fill(null).map(() => Qubit.zero());
        this.gates = [];
    }

    addGate(gate: Matrix, targetQubit: number): void {
        this.gates.push({ gate, targetQubits: [targetQubit] });
    }

    rx(theta: number, targetQubit: number): void {
        this.addGate(QuantumGates.RX(theta), targetQubit);
    }

    ry(theta: number, targetQubit: number): void {
        this.addGate(QuantumGates.RY(theta), targetQubit);
    }

    rz(theta: number, targetQubit: number): void {
        this.addGate(QuantumGates.RZ(theta), targetQubit);
    }

    h(targetQubit: number): void {
        this.addGate(QuantumGates.H(), targetQubit);
    }

    cnot(controlQubit: number, targetQubit: number): void {
        this.gates.push({ 
            gate: QuantumGates.CNOT(), 
            targetQubits: [controlQubit, targetQubit] 
        });
    }

    rot(phi: number, theta: number, omega: number, targetQubit: number): void {
        this.addGate(QuantumGates.Rot(phi, theta, omega), targetQubit);
    }

    execute(): void {
        for (const { gate, targetQubits } of this.gates) {
            if (targetQubits.length === 1) {
                this.qubits[targetQubits[0]].applyGate(gate);
            } else if (targetQubits.length === 2) {
                this.applyCNOT(targetQubits[0], targetQubits[1]);
            }
        }
    }

    private applyCNOT(control: number, target: number): void {
        const controlState = this.qubits[control].getState();
        const prob1 = Math.pow(controlState[1].re, 2) + Math.pow(controlState[1].im, 2);
        
        if (prob1 > 0.5) {
            this.qubits[target].applyGate(QuantumGates.X());
        }
    }

    measure(): number[] {
        return this.qubits.map(qubit => qubit.measure());
    }

    expectationValue(): number {
        return this.qubits[0].expectationValue();
    }

    getStates(): Complex[][] {
        return this.qubits.map(q => q.getState());
    }

    reset(): void {
        this.qubits = Array(this.qubits.length).fill(null).map(() => Qubit.zero());
        this.gates = [];
    }

    getNumQubits(): number {
        return this.qubits.length;
    }
}
