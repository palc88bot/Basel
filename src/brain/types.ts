// src/brain/types.ts

export type BrainAction = 'BUY' | 'SELL' | 'HOLD';

export type BrainMode = 'paper' | 'live' | 'training' | 'backtest';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookSnapshot {
  bidPrice: number;
  askPrice: number;
  bidQty: number;
  askQty: number;
}

export interface BrainMarketInput {
  symbol: string;
  timeframe: string;
  timestamp: number;
  price: number;
  candles: Candle[];
  indicators: Record<string, number>;
  regime?: string;
  fundingRate?: number;
  openInterest?: number;
  orderBook?: OrderBookSnapshot;
  metadata?: Record<string, unknown>;
}

export interface BrainDecision {
  action: BrainAction;
  confidence: number;
  uncertainty: number;
  regime: string;
  positionSizeMultiplier: number;
  reasons: string[];
  modelVersion: string;
  timestamp: number;
  raw?: Record<string, unknown>;
}

export interface TradeOutcome {
  tradeId: string;
  symbol: string;
  action: BrainAction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  fees: number;
  slippage: number;
  durationMs: number;
  confidence: number;
  uncertainty: number;
  regime: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BrainDecisionConfig {
  minConfidence: number;
  maxUncertainty: number;
  maxTradesPerHour: number;
  requireRegimeConfirmation: boolean;
  allowedRegimes?: string[];
}

export interface BrainLearningConfig {
  reflectionEveryNTrades: number;
  continualLearningIntervalMs: number;
  metaLearningIntervalMs: number;
  quantumEvolutionIntervalMs: number;
  featureEvolutionIntervalMs: number;
}

export interface BrainStorageConfig {
  statePath: string;
  decisionsPath: string;
  tradesPath: string;
  modelsPath: string;
}

export interface BrainConfig {
  enabled: boolean;
  mode: BrainMode;
  symbol: string;
  timeframe: string;
  decision: BrainDecisionConfig;
  learning: BrainLearningConfig;
  storage: BrainStorageConfig;
  [key: string]: unknown;
}

export interface RiskEvaluation {
  approved: boolean;
  positionSize: number;
  reasons: string[];
}

export interface IRiskManager {
  evaluate(input: {
    symbol: string;
    action: BrainAction;
    confidence: number;
    uncertainty: number;
    positionSizeMultiplier: number;
    marketContext: BrainMarketInput;
  }): Promise<RiskEvaluation>;
}

export interface IExecutionEngine {
  execute(order: {
    symbol: string;
    action: BrainAction;
    size: number;
    confidence: number;
    regime: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ tradeId: string; [key: string]: unknown }>;
}
