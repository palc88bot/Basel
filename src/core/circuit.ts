// src/core/circuit.ts
export class QuantumCircuit {
  constructor(numQubits: number) {}
  addGate(type: 'RY' | 'RZ' | 'RX' | 'CNOT', targets: number[], params?: number[]) {}
  async execute(): Promise<{ expectationZ: number }> {
    // Minimal simulation
    return { expectationZ: Math.random() * 2 - 1 };
  }
}
