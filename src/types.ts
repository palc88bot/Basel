export interface MarketTick {
  timestamp: number;
  priceA: number;
  priceB: number;
  beta: number;
  spread: number;
  zScore: number;
  halfLife: number;
  lstmUp: number;
  lstmNeutral: number;
  lstmDown: number;
  confidence: number;
}

export interface Position {
  id: string;
  pair: string;
  direction: 'LONG_A_SHORT_B' | 'SHORT_A_LONG_B' | 'LONG' | 'SHORT';
  entryPriceA: number;
  entryPriceB?: number;
  beta?: number;
  sizeUsd: number;
  leverage: number;
  entryTime: number;
  currentZ?: number;
  pnl: number;
  pnlPercentage: number;
  status: 'OPEN' | 'CLOSED';
  exitReason?: string;
  assignedTentacle?: string;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  estFeesPaidUsd?: number;
}

export interface BotConfig {
  initialEquity: number;
  walletBalance: number;
  assetA: string;
  assetB: string;
  kalmanDelta: number;
  kalmanVe: number;
  kalmanVw: number;
  minHalfLife: number;
  maxHalfLife: number;
  entryZ: number;
  exitZ: number;
  stopZ: number;
  minConfidence: number;
  maxPositionPct: number;
  maxLeverage: number;
  useKelly: boolean;
  timeLimitSeconds: number;
  // Tentacle flags
  enableStatArb: boolean;
  enableDCA: boolean;
  enableGrid: boolean;
  // DCA params
  dcaAmountUsd: number;
  dcaDropThreshold: number;
  // Grid params
  gridLevels: number;
  gridSpacingPct: number;
  // Adaptive Capital Settings
  makerFeeRate: number; // e.g. 0.0002 (0.02%)
  takerFeeRate: number; // e.g. 0.00055 (0.055%)
  minExchangeNotionalUsd: number; // e.g. 5.0
  autoAdaptMicroWallets: boolean;
}

export interface FuturesPair {
  symbol: string;
  nameAr: string;
  price: number;
  change24h: number;
  volume24hUsd: number;
  fundingRate: number; // e.g. 0.0001
  spreadPct: number; // e.g. 0.015%
  zScore: number;
  halfLifeSec: number;
  isCalibrated?: boolean;
  isHalfLifeValid?: boolean;
  beta?: number;
  spread?: number;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  signalReasonAr: string;
  activeTentacle: 'تحكيم إحصائي' | 'شبكة ديناميكية' | 'DCA تراكمي' | 'مراقبة سيولة';
  minNotionalUsd: number;
  recommendedLeverage: number;
  liquidityRank: number;
  statusGroup?: 'READY' | 'PREPARED' | 'BACKGROUND';
  isSafeTradeable?: boolean;
  filterReason?: string;
}

export interface CapitalAdaptationProfile {
  tier: 'MICRO' | 'STANDARD' | 'ADVANCED' | 'WHALE';
  tierNameAr: string;
  walletBalance: number;
  usableMargin: number;
  minOrderNotional: number;
  recommendedLeverage: number;
  maxRiskPerTradeUsd: number;
  maxRiskPerTradePct: number;
  positionSizeUsd: number;
  estimatedMakerFeeUsd: number;
  estimatedTakerFeeUsd: number;
  estimatedSpreadCostUsd: number;
  totalRoundtripFeeUsd: number;
  breakEvenTargetPct: number;
  takeProfitPct: number;
  takeProfitUsd: number;
  stopLossPct: number;
  stopLossUsd: number;
  liquidationSafetyBufferPct: number;
  adaptiveAdviceAr: string;
}

export interface BrainPulseState {
  bpm: number;
  synapticLoad: number;
  latencyMicroseconds: number;
  breathingPhase: 'شهيق' | 'تأمل وحساب' | 'زفير واستقرار';
  stateLabelAr: string;
  internalThoughts: string[];
  currentFocus: string;
}

export interface BacktestResult {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
  equityCurve: { time: string; equity: number }[];
  trades: {
    id: string;
    entryTime: string;
    exitTime: string;
    direction: string;
    entryZ: number;
    exitZ: number;
    pnl: number;
    reason: string;
  }[];
}

export interface HyperoptTrial {
  trialNumber: number;
  sharpe: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  params: {
    entryZ: number;
    exitZ: number;
    stopZ: number;
    minHalfLife: number;
    maxHalfLife: number;
    maxPositionPct: number;
    kalmanWeight: number;
    lstmWeight: number;
  };
}

export interface HyperoptResult {
  bestTrial: HyperoptTrial;
  totalTrials: number;
  durationMs: number;
  trials: HyperoptTrial[];
}

export interface AlertLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  channel: 'TELEGRAM' | 'WEBHOOK' | 'SYSTEM';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'omega';
  text: string;
  timestamp: string;
}

export interface TentacleStatus {
  id: string;
  name: string;
  arabicName: string;
  type: 'TRADING_MODE' | 'ANALYZER' | 'EXECUTOR' | 'RISK_GUARD';
  enabled: boolean;
  status: 'RUNNING' | 'PAUSED' | 'IDLE' | 'ERROR';
  description: string;
  metrics: string;
}

export interface ExecutionTelemetry {
  executor: {
    connectorName: string;
    testnet: boolean;
    hasApiKey: boolean;
    connected: boolean;
    activeOrdersCount: number;
  };
  rateLimiter: {
    backoffActive: boolean;
    backoffRemainingSec: number;
    consecutiveFailures: number;
    endpoints: Record<string, {
      currentWeight: number;
      maxWeight: number;
      remaining: number;
      utilization: number;
    }>;
  };
  adaptiveMetrics: {
    safetyMarginPct: number;
    successfulRequests: number;
    failedRequests: number;
    successRatePct: number;
  };
  orderTracker: {
    totalOrders: number;
    successfulOrders: number;
    failedOrders: number;
    activeOrders: number;
    successRatePct: number;
  };
  activeOrders: Array<{
    orderId: string;
    clientOrderId: string;
    tradingPair: string;
    side: 'BUY' | 'SELL';
    amount: number;
    price: number;
    state: string;
    filledAmount: number;
    averageFillPrice: number;
    createdAt: number;
  }>;
  recentOrders: Array<any>;
  reconciliation: {
    isRunning: boolean;
    reconcileIntervalSec: number;
    discrepancyThresholdUsd: number;
    discrepancyPctThreshold: number;
    totalReconciliations: number;
    avgDiscrepancyUsd: number;
    maxDiscrepancyUsd: number;
    lastReconcileTimestamp: number;
    totalTradesRecorded: number;
    lastSnapshot: {
      timestamp: number;
      exchangeBalance: number;
      botBalance: number;
      discrepancy: number;
      discrepancyPct: number;
      matched: boolean;
    } | null;
  };
  balanceHistory: Array<{
    timestamp: number;
    exchangeBalance: number;
    botBalance: number;
    discrepancy: number;
    discrepancyPct: number;
    matched: boolean;
  }>;
}

export interface VaultPublicStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  cipher: string;
  storageLocation: string;
  storedKeys: string[];
  maskedPreview: Record<string, string>;
  lastUpdated: string | null;
}
