// scripts/train-supreme.ts

import { SupremeQuantumMind } from '../src/brain/supreme-quantum-mind';
import { brainConfig } from '../src/config/brain.config';
import { MarketData } from '../src/data/data-buffer';
import { MarketRegime } from '../src/market/regime-detector';

/**
 * دالة توليد أو جلب البيانات التاريخية للتدريب الأولي
 */
async function loadHistoricalMarketData(): Promise<{ data: MarketData[]; regimes: MarketRegime[] }> {
  console.log('📥 Loading / generating historical market dataset for quantum calibration...');
  const data: MarketData[] = [];
  const regimes: MarketRegime[] = [];

  const possibleRegimes: MarketRegime[] = ['BULL', 'BEAR', 'HIGH_VOLATILITY', 'SIDEWAYS', 'TRENDING', 'ACCUMULATION'];

  for (let i = 0; i < 2000; i++) {
    const regime = possibleRegimes[Math.floor((i / 400) % possibleRegimes.length)];
    regimes.push(regime);

    data.push({
      rsi: 30 + Math.random() * 40,
      macdHistogram: (Math.random() - 0.5) * 2,
      bbPercentB: Math.random(),
      atrNormalized: 0.005 + Math.random() * 0.02,
      volumeDelta: (Math.random() - 0.5) * 1000,
      orderBookImbalance: (Math.random() - 0.5) * 0.8,
      momentum: (Math.random() - 0.5) * 0.05,
      priceAction: (Math.random() - 0.5) * 0.02,
      futureReturn: (Math.random() - 0.48) * 0.03,
    });
  }

  return { data, regimes };
}

async function main() {
  console.log('🚀 Starting Supreme Quantum Mind comprehensive offline training pipeline...');

  const { data, regimes } = await loadHistoricalMarketData();

  if (!Array.isArray(data) || data.length < 500) {
    console.error('Not enough historical data. Minimum recommended: 500 samples.');
    process.exit(1);
  }

  console.log(`Loaded ${data.length} historical quantum data samples.`);

  const brain = new SupremeQuantumMind();

  console.log('🧬 Running Comprehensive Quantum Initialization Training...');
  await brain.initializeTraining(data, regimes);

  console.log('✅ Supreme Quantum Mind offline training & regime-adaptation finished successfully.');
}

main().catch((error) => {
  console.error('Training failed:', error);
  process.exit(1);
});
