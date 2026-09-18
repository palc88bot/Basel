import { complex, Matrix, matrix, multiply } from 'mathjs';

export class QuantumGates {
    static X(): Matrix {
        return matrix([
            [complex(0, 0), complex(1, 0)],
            [complex(1, 0), complex(0, 0)]
        ]);
    }

    static Y(): Matrix {
        return matrix([
            [complex(0, 0), complex(0, -1)],
            [complex(0, 1), complex(0, 0)]
        ]);
    }

    static Z(): Matrix {
        return matrix([
            [complex(1, 0), complex(0, 0)],
            [complex(0, 0), complex(-1, 0)]
        ]);
    }

    static H(): Matrix {
        const val = 1 / Math.sqrt(2);
        return matrix([
            [complex(val, 0), complex(val, 0)],
            [complex(val, 0), complex(-val, 0)]
        ]);
    }

    static RX(theta: number): Matrix {
        const cos = Math.cos(theta / 2);
        const sin = Math.sin(theta / 2);
        return matrix([
            [complex(cos, 0), complex(0, -sin)],
            [complex(0, -sin), complex(cos, 0)]
        ]);
    }

    static RY(theta: number): Matrix {
        const cos = Math.cos(theta / 2);
        const sin = Math.sin(theta / 2);
        return matrix([
            [complex(cos, 0), complex(-sin, 0)],
            [complex(sin, 0), complex(cos, 0)]
        ]);
    }

    static RZ(theta: number): Matrix {
        const phase1 = complex(Math.cos(-theta / 2), Math.sin(-theta / 2));
        const phase2 = complex(Math.cos(theta / 2), Math.sin(theta / 2));
        return matrix([
            [phase1, complex(0, 0)],
            [complex(0, 0), phase2]
        ]);
    }

    static CNOT(): Matrix {
        return matrix([
            [complex(1, 0), complex(0, 0), complex(0, 0), complex(0, 0)],
            [complex(0, 0), complex(1, 0), complex(0, 0), complex(0, 0)],
            [complex(0, 0), complex(0, 0), complex(0, 0), complex(1, 0)],
            [complex(0, 0), complex(0, 0), complex(1, 0), complex(0, 0)]
        ]);
    }

    static Rot(phi: number, theta: number, omega: number): Matrix {
        const rz1 = QuantumGates.RZ(phi);
        const ry = QuantumGates.RY(theta);
        const rz2 = QuantumGates.RZ(omega);
        
        const temp = multiply(ry, rz1) as Matrix;
        return multiply(rz2, temp) as Matrix;
    }
}
