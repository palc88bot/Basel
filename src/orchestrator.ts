// src/orchestrator.ts
import { EventEmitter } from 'events';
import { SupremeQuantumMind, SupremeDecision } from './brain/supreme-quantum-mind';
import { BrainGateway } from './brain/brain-gateway';
import { MaintenanceScheduler } from './brain/maintenance-scheduler';
import { brainConfig } from './config/brain.config';
import { MarketData } from './data/data-buffer';
import { MarketRegime } from './market/regime-detector';
import {
  BrainMarketInput,
  Candle,
  IExecutionEngine,
  IRiskManager,
  OrderBookSnapshot,
  TradeOutcome,
} from './brain/types';

export interface OrchestratorDependencies {
  symbol?: string;
  timeframe?: string;
  marketData?: EventEmitter;
  riskManager: IRiskManager;
  executionEngine: IExecutionEngine;
  getCandles: () => Candle[];
  getIndicators: () => Record<string, number>;
  getRegime?: () => string | undefined;
  getFundingRate?: () => number | undefined;
  getOpenInterest?: () => number | undefined;
  getOrderBook?: () => OrderBookSnapshot | undefined;
  mapTradeClosed?: (payload: any) => TradeOutcome;
}

export class Orchestrator extends EventEmitter {
  private brain: BrainGateway;
  private maintenance: MaintenanceScheduler;
  private running = false;

  private candleListener?: (payload: any) => void;
  private tradeClosedListener?: (payload: any) => void;

  constructor(private deps: OrchestratorDependencies) {
    super();
    this.brain = new BrainGateway(brainConfig);
    this.maintenance = new MaintenanceScheduler(this.brain, 60_000);
  }

  get brainGateway(): BrainGateway {
    return this.brain;
  }

  async start(): Promise<void> {
    console.log('[Orchestrator] 🚀 Starting event-driven Quantum Orchestrator...');
    await this.brain.init();
    this.maintenance.start();
    this.running = true;

    if (this.deps.marketData) {
      this.candleListener = (payload: any) => {
        this.handleCandle(payload).catch((error) => {
          console.error('[Orchestrator] handleCandle failed:', error);
        });
      };

      this.tradeClosedListener = (payload: any) => {
        const outcome = this.deps.mapTradeClosed
          ? this.deps.mapTradeClosed(payload)
          : (payload as TradeOutcome);

        this.handleTradeClosed(outcome).catch((error) => {
          console.error('[Orchestrator] handleTradeClosed failed:', error);
        });
      };

      this.deps.marketData.on('candle', this.candleListener);
      this.deps.marketData.on('tradeClosed', this.tradeClosedListener);
      console.log('[Orchestrator] Attached to marketData events.');
    }

    console.log('[Orchestrator] Started successfully.');
  }

  async stop(): Promise<void> {
    console.log('[Orchestrator] Stopping...');
    this.running = false;
    this.maintenance.stop();

    if (this.deps.marketData) {
      if (this.candleListener) {
        this.deps.marketData.removeListener('candle', this.candleListener);
      }
      if (this.tradeClosedListener) {
        this.deps.marketData.removeListener('tradeClosed', this.tradeClosedListener);
      }
    }

    await this.brain.saveState();
    console.log('[Orchestrator] Stopped.');
  }

  async handleCandle(candle?: Candle): Promise<void> {
    if (!this.running || !this.brain.isReady()) {
      return;
    }

    const candles = this.deps.getCandles();
    const activeCandle = candle ?? candles[candles.length - 1];

    if (!activeCandle) {
      console.warn('[Orchestrator] No active candle found.');
      return;
    }

    const input = this.buildMarketInput(activeCandle);
    const decision = await this.brain.decide(input);

    this.emit('brain:decision', decision);

    console.log('[Orchestrator] 🧠 Brain decision:', {
      action: decision.action,
      confidence: decision.confidence.toFixed(4),
      uncertainty: decision.uncertainty.toFixed(4),
      regime: decision.regime,
      reasons: decision.reasons,
    });

    if (decision.action === 'HOLD') {
      return;
    }

    const riskDecision = await this.deps.riskManager.evaluate({
      symbol: input.symbol,
      action: decision.action,
      confidence: decision.confidence,
      uncertainty: decision.uncertainty,
      positionSizeMultiplier: decision.positionSizeMultiplier,
      marketContext: input,
    });

    this.emit('risk:decision', riskDecision);

    if (!riskDecision.approved || !(riskDecision.positionSize > 0)) {
      console.log('[Orchestrator] ⚠️ Risk manager rejected trade:', riskDecision.reasons);
      return;
    }

    const executionResult = await this.deps.executionEngine.execute({
      symbol: input.symbol,
      action: decision.action,
      size: riskDecision.positionSize,
      confidence: decision.confidence,
      regime: decision.regime,
      metadata: {
        brainDecision: decision,
        riskReasons: riskDecision.reasons,
        inputTimestamp: input.timestamp,
      },
    });

    this.brain.registerTradeOpened();
    this.emit('execution:result', executionResult);
    console.log('[Orchestrator] ⚡ Trade executed:', executionResult);
  }

  async handleTradeClosed(trade: TradeOutcome): Promise<void> {
    if (!trade) return;
    await this.brain.recordTradeOutcome(trade);
    this.emit('trade:closed', trade);
    console.log('[Orchestrator] 📝 Trade outcome recorded:', trade.tradeId);
  }

  private buildMarketInput(candle: Candle): BrainMarketInput {
    const candles = this.deps.getCandles();

    return {
      symbol: this.deps.symbol ?? brainConfig.symbol,
      timeframe: this.deps.timeframe ?? brainConfig.timeframe,
      timestamp: candle.timestamp,
      price: candle.close,
      candles: candles.slice(-1000),
      indicators: this.deps.getIndicators(),
      regime: this.deps.getRegime?.(),
      fundingRate: this.deps.getFundingRate?.(),
      openInterest: this.deps.getOpenInterest?.(),
      orderBook: this.deps.getOrderBook?.(),
    };
  }
}

export interface OrchestratorStatus {
  isRunning: boolean;
  activeRegime: MarketRegime;
  totalDecisions: number;
  lastDecision: SupremeDecision | null;
  performance: {
    winRate: number;
    totalTrades: number;
    avgPnl: number;
  };
  mindStats: any;
}

export class QuantumTradingOrchestrator {
  private static instance: QuantumTradingOrchestrator | null = null;
  private supremeMind: SupremeQuantumMind;
  private isRunning: boolean = false;
  private timer: any = null;
  private activeRegime: MarketRegime = 'SIDEWAYS';
  private totalDecisions: number = 0;
  private lastDecision: SupremeDecision | null = null;

  constructor() {
    this.supremeMind = new SupremeQuantumMind({
      enableMetaLearning: true,
      enableFeatureEvolution: true,
      enableQuantumEvolution: true,
      enableContinualLearning: true,
      enableSelfReflection: true,
      enableEnsemble: true,
      enableBayesian: true
    });
  }

  public static getInstance(): QuantumTradingOrchestrator {
    if (!QuantumTradingOrchestrator.instance) {
      QuantumTradingOrchestrator.instance = new QuantumTradingOrchestrator();
    }
    return QuantumTradingOrchestrator.instance;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Orchestrator] 🚀 7-Layer Supreme Quantum Trading Orchestrator started.');
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Orchestrator] 🛑 Quantum Trading Orchestrator stopped.');
  }

  public setRegime(regime: MarketRegime): void {
    this.activeRegime = regime;
  }

  public getRegime(): MarketRegime {
    return this.activeRegime;
  }

  public getSupremeMind(): SupremeQuantumMind {
    return this.supremeMind;
  }

  public async processMarketTick(marketData: MarketData, detectedRegime?: MarketRegime): Promise<SupremeDecision> {
    const regime = detectedRegime || this.activeRegime;
    this.activeRegime = regime;

    const decision = await this.supremeMind.decide(marketData, regime);
    this.lastDecision = decision;
    this.totalDecisions++;

    return decision;
  }

  public async recordTradeResult(
    decision: SupremeDecision,
    marketData: MarketData,
    pnl: number,
    entryPrice: number,
    exitPrice: number
  ): Promise<void> {
    await this.supremeMind.recordTradeResult(decision, marketData, pnl, entryPrice, exitPrice);
  }

  public getStatus(): OrchestratorStatus {
    const fullStats = this.supremeMind.getFullStats();
    return {
      isRunning: this.isRunning,
      activeRegime: this.activeRegime,
      totalDecisions: this.totalDecisions,
      lastDecision: this.lastDecision,
      performance: {
        winRate: fullStats?.performance?.winRate || 0,
        totalTrades: fullStats?.performance?.totalTrades || 0,
        avgPnl: fullStats?.performance?.avgPnl || 0
      },
      mindStats: fullStats
    };
  }
}
