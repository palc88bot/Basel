import { Complex, complex, Matrix, matrix, multiply } from 'mathjs';

/**
 * الكيوبت الكمومي - الوحدة الأساسية للمعلومات الكمومية
 * الحالة: |ψ⟩ = α|0⟩ + β|1⟩
 * حيث |α|² + |β|² = 1
 */
export class Qubit {
    private state: Complex[]; // [α, β]

    constructor(alpha: Complex = complex(1, 0), beta: Complex = complex(0, 0)) {
        this.state = [alpha, beta];
        this.normalize();
    }

    /**
     * تطبيع الحالة الكمومية (Normalization)
     */
    private normalize(): void {
        const norm = Math.sqrt(
            Math.pow(this.state[0].re, 2) + Math.pow(this.state[0].im, 2) +
            Math.pow(this.state[1].re, 2) + Math.pow(this.state[1].im, 2)
        );
        
        if (norm > 0) {
            this.state[0] = complex(this.state[0].re / norm, this.state[0].im / norm);
            this.state[1] = complex(this.state[1].re / norm, this.state[1].im / norm);
        }
    }

    /**
     * تطبيق بوابة كمومية على الكيوبت
     */
    applyGate(gate: Matrix): void {
        const stateMatrix = matrix([[this.state[0]], [this.state[1]]]);
        const newState = multiply(gate, stateMatrix) as Matrix;
        
        this.state[0] = newState.get([0, 0]) as Complex;
        this.state[1] = newState.get([1, 0]) as Complex;
        
        this.normalize();
    }

    /**
     * قياس الكيوبت (Measurement)
     */
    measure(): number {
        const prob0 = Math.pow(this.state[0].re, 2) + Math.pow(this.state[0].im, 2);
        return Math.random() < prob0 ? 0 : 1;
    }

    /**
     * القيمة المتوقعة (Expectation Value)
     */
    expectationValue(): number {
        const prob0 = Math.pow(this.state[0].re, 2) + Math.pow(this.state[0].im, 2);
        const prob1 = Math.pow(this.state[1].re, 2) + Math.pow(this.state[1].im, 2);
        return prob0 - prob1;
    }

    getState(): Complex[] {
        return [...this.state];
    }

    static zero(): Qubit {
        return new Qubit(complex(1, 0), complex(0, 0));
    }

    static one(): Qubit {
        return new Qubit(complex(0, 0), complex(1, 0));
    }

    static plus(): Qubit {
        const val = complex(1 / Math.sqrt(2), 0);
        return new Qubit(val, val);
    }
}
