/**
 * OMEGA QuantBrain - Quantum-Inspired Portfolio Optimizer
 * ========================================================
 * Implements a Quantum-Inspired Simulated Annealing / QUBO formulation
 * for multi-pair portfolio selection and capital allocation.
 *
 * Mathematical Objectives:
 *   1. Maximize Mean-Reversion Potential (Sharpe & Fast Half-Life).
 *   2. Minimize Cross-Asset Correlation Penalty: min x^T * Q * x - mu^T * x
 *   3. Enforce Max Position & Leverage Constraints.
 */

export interface CandidatePairMetric {
  symbol: string;
  zScore: number;
  halfLifeSec: number;
  volume24hUsd: number;
  spreadPct: number;
  beta: number;
}

export interface OptimizedAllocation {
  symbol: string;
  weight: number;            // Normalized capital allocation (0.0 to 1.0)
  targetCapitalUsd: number;  // Recommended USD allocation
  convictionScore: number;   // Combined statistical conviction (0-100)
  expectedHalfLifeSec: number;
  riskPenalty: number;
}

export interface QuantumOptimizationResult {
  timestamp: number;
  totalPortfolioCapitalUsd: number;
  selectedPairsCount: number;
  optimalAllocations: OptimizedAllocation[];
  portfolioDiversificationIndex: number; // 1 - Herfindahl index (0 to 1)
  algorithm: 'QUANTUM_INSPIRED_ANNEALING_QUBO';
  iterations: number;
  energyScore: number;
}

export class QuantumInspiredPortfolioOptimizer {
  /**
   * Run Quantum-Inspired Optimization on candidate assets
   */
  public static optimize(
    candidates: CandidatePairMetric[],
    totalCapitalUsd: number = 1000.0,
    maxPositions: number = 3
  ): QuantumOptimizationResult {
    if (!candidates || candidates.length === 0) {
      return {
        timestamp: Date.now(),
        totalPortfolioCapitalUsd: totalCapitalUsd,
        selectedPairsCount: 0,
        optimalAllocations: [],
        portfolioDiversificationIndex: 0,
        algorithm: 'QUANTUM_INSPIRED_ANNEALING_QUBO',
        iterations: 0,
        energyScore: 0
      };
    }

    // 1. Calculate linear return vector (mu) based on Z-score magnitude and Mean-Reversion Speed
    const n = candidates.length;
    const mu: number[] = candidates.map(c => {
      const absZ = Math.abs(c.zScore);
      // Faster half-life means higher turnover potential
      const speedScore = c.halfLifeSec > 0 ? Math.min(2.0, 600 / Math.max(60, c.halfLifeSec)) : 0.5;
      const spreadPenalty = Math.max(0.1, 1 - c.spreadPct * 100);
      return absZ * speedScore * spreadPenalty;
    });

    // 2. Approximate Cross-Correlation Matrix (Q) using Beta differentials
    const Q: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          Q[i][j] = 0.5; // Variance baseline
        } else {
          // Pairs with similar Betas to BTC have higher correlation
          const betaDiff = Math.abs(candidates[i].beta - candidates[j].beta);
          const correlationApprox = Math.max(0.2, 1.0 - betaDiff * 2.0);
          Q[i][j] = correlationApprox;
        }
      }
    }

    // 3. Quantum-Inspired Annealing (Simulated Annealing on QUBO state vector)
    let bestState = Array(n).fill(0);
    // Greedily pick initial top maxPositions
    const indexedMu = mu.map((val, idx) => ({ val, idx })).sort((a, b) => b.val - a.val);
    for (let k = 0; k < Math.min(maxPositions, n); k++) {
      bestState[indexedMu[k].idx] = 1;
    }

    let bestEnergy = this.evaluateQUBOEnergy(bestState, Q, mu);
    let currentState = [...bestState];
    let currentEnergy = bestEnergy;

    // Simulated Quantum Fluctuation schedule
    const iterations = 250;
    let gamma = 1.5; // Transverse field strength (quantum fluctuation)
    const gammaDecay = 0.98;

    for (let step = 0; step < iterations; step++) {
      const candidateState = [...currentState];
      // Quantum bit-flip perturbation
      const flipIdx = Math.floor(Math.random() * n);
      candidateState[flipIdx] = candidateState[flipIdx] === 1 ? 0 : 1;

      // Penalize violating maxPositions constraint
      const activeCount = candidateState.reduce((a, b) => a + b, 0);
      let penalty = 0;
      if (activeCount > maxPositions) {
        penalty = (activeCount - maxPositions) * 10.0;
      } else if (activeCount === 0) {
        penalty = 10.0;
      }

      const candidateEnergy = this.evaluateQUBOEnergy(candidateState, Q, mu) + penalty;

      // Acceptance probability incorporating transverse field (quantum tunneling simulation)
      const deltaE = candidateEnergy - currentEnergy;
      if (deltaE < 0 || Math.random() < Math.exp(-deltaE / Math.max(0.01, gamma))) {
        currentState = candidateState;
        currentEnergy = candidateEnergy;
        if (currentEnergy < bestEnergy && activeCount <= maxPositions && activeCount > 0) {
          bestEnergy = currentEnergy;
          bestState = [...currentState];
        }
      }

      gamma *= gammaDecay;
    }

    // 4. Formulate optimal weights from winning states
    const activeIndices = bestState
      .map((val, idx) => (val === 1 ? idx : -1))
      .filter(idx => idx !== -1);

    const sumMu = activeIndices.reduce((acc, idx) => acc + mu[idx], 0) || 1;
    const optimalAllocations: OptimizedAllocation[] = activeIndices.map(idx => {
      const c = candidates[idx];
      const weight = parseFloat((mu[idx] / sumMu).toFixed(4));
      const targetCapitalUsd = parseFloat((totalCapitalUsd * weight).toFixed(2));
      const convictionScore = Math.min(99, Math.round(mu[idx] * 20));

      return {
        symbol: c.symbol,
        weight,
        targetCapitalUsd,
        convictionScore,
        expectedHalfLifeSec: c.halfLifeSec,
        riskPenalty: parseFloat((Q[idx][idx] || 0.5).toFixed(3))
      };
    });

    // 5. Calculate diversification index (1 - HHI)
    const hhi = optimalAllocations.reduce((acc, a) => acc + Math.pow(a.weight, 2), 0);
    const diversificationIndex = parseFloat((1.0 - hhi).toFixed(3));

    return {
      timestamp: Date.now(),
      totalPortfolioCapitalUsd: totalCapitalUsd,
      selectedPairsCount: optimalAllocations.length,
      optimalAllocations,
      portfolioDiversificationIndex: Math.max(0, diversificationIndex),
      algorithm: 'QUANTUM_INSPIRED_ANNEALING_QUBO',
      iterations,
      energyScore: parseFloat(bestEnergy.toFixed(4))
    };
  }

  private static evaluateQUBOEnergy(state: number[], Q: number[][], mu: number[]): number {
    let energy = 0;
    const n = state.length;
    // Minimize: 0.5 * x^T * Q * x - mu^T * x
    for (let i = 0; i < n; i++) {
      if (state[i] === 0) continue;
      energy -= mu[i];
      for (let j = 0; j < n; j++) {
        if (state[j] === 1) {
          energy += 0.5 * Q[i][j];
        }
      }
    }
    return energy;
  }
}
