// src/config/brain.config.ts

import { BrainConfig } from '../brain/types';

export const brainConfig: BrainConfig = {
  enabled: true,

  // paper فقط في البداية
  mode: 'paper',

  symbol: 'BTCUSDT',
  timeframe: '1m',

  decision: {
    minConfidence: 0.65,
    maxUncertainty: 0.35,
    maxTradesPerHour: 5,
    requireRegimeConfirmation: true,

    // إذا أردت السماح لكل الأنظمة، اتركه undefined
    allowedRegimes: undefined,
  },

  learning: {
    reflectionEveryNTrades: 25,

    // كل ساعة
    continualLearningIntervalMs: 60 * 60 * 1000,

    // كل يوم
    metaLearningIntervalMs: 24 * 60 * 60 * 1000,

    // كل 3 أيام
    quantumEvolutionIntervalMs: 3 * 24 * 60 * 60 * 1000,

    // كل أسبوع
    featureEvolutionIntervalMs: 7 * 24 * 60 * 60 * 1000,
  },

  storage: {
    statePath: './storage/supreme-quantum-mind/state.json',
    decisionsPath: './storage/logs/brain-decisions.jsonl',
    tradesPath: './storage/logs/brain-trades.jsonl',
    modelsPath: './storage/models',
  },
};
