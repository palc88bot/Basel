// src/brain/brain-gateway.ts

import fs from 'fs';
import path from 'path';
import { SupremeQuantumMind, SupremeDecision } from './supreme-quantum-mind';
import { JsonlLogger } from './jsonl-logger';
import { MarketData } from '../data/data-buffer';
import { MarketRegime } from '../market/regime-detector';
import {
  BrainAction,
  BrainConfig,
  BrainDecision,
  BrainMarketInput,
  TradeOutcome,
} from './types';

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class BrainGateway {
  private brain: SupremeQuantumMind;
  private ready = false;
  private maintenanceRunning = false;
  private lastDecisionMap = new Map<string, SupremeDecision>();
  private lastMarketDataMap = new Map<string, MarketData>();

  private lastMaintenance = {
    hourly: 0,
    daily: 0,
    quantumEvolution: 0,
    featureEvolution: 0,
  };

  private tradeCount = 0;
  private tradeTimestamps: number[] = [];

  private decisionLogger: JsonlLogger;
  private tradeLogger: JsonlLogger;

  constructor(private config: BrainConfig) {
    this.decisionLogger = new JsonlLogger(config.storage.decisionsPath);
    this.tradeLogger = new JsonlLogger(config.storage.tradesPath);
    this.brain = new SupremeQuantumMind();
  }

  isReady(): boolean {
    return this.ready && this.config.enabled;
  }

  async init(): Promise<void> {
    if (!this.config.enabled) {
      console.warn('[BrainGateway] Brain disabled by config.');
      return;
    }

    try {
      if (typeof window === 'undefined') {
        const stateDir = path.dirname(this.config.storage.statePath);
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }
        if (!fs.existsSync(this.config.storage.modelsPath)) {
          fs.mkdirSync(this.config.storage.modelsPath, { recursive: true });
        }
      }

      await this.loadStateIfExists();

      const now = Date.now();
      this.lastMaintenance = {
        hourly: now,
        daily: now,
        quantumEvolution: now,
        featureEvolution: now,
      };

      this.ready = true;
      console.log('🧠 [BrainGateway] Supreme Quantum Mind Gateway initialized successfully.');
    } catch (error) {
      this.ready = false;
      console.error('[BrainGateway] Initialization failed:', error);
    }
  }

  async decide(input: BrainMarketInput): Promise<BrainDecision> {
    if (!this.isReady()) {
      return this.safeHold('Brain not ready');
    }

    try {
      const validation = this.validateInput(input);
      if (!validation.ok) {
        return this.safeHold(validation.reason);
      }

      // تحويل BrainMarketInput إلى MarketData
      const marketData: MarketData = this.transformToMarketData(input);
      const regime: MarketRegime = (input.regime?.toUpperCase() as MarketRegime) || 'SIDEWAYS';

      const supremeDecision = await this.brain.decide(marketData, regime);

      // حفظ آخر قرار وبيانات سوق لربطها بالصفقات اللاحقة
      this.lastDecisionMap.set(input.symbol, supremeDecision);
      this.lastMarketDataMap.set(input.symbol, marketData);

      const normalized = this.normalizeDecision(supremeDecision, regime);
      const guarded = this.applyGuards(normalized, input);

      await this.decisionLogger.write({
        type: 'brain_decision',
        symbol: input.symbol,
        timeframe: input.timeframe,
        price: input.price,
        decision: guarded,
      });

      return guarded;
    } catch (error) {
      console.error('[BrainGateway] decide() failed:', error);
      return this.safeHold('Brain decision exception');
    }
  }

  async recordTradeOutcome(outcome: TradeOutcome): Promise<void> {
    if (!this.isReady()) return;

    try {
      await this.tradeLogger.write({
        type: 'trade_outcome',
        outcome,
      });

      const lastDecision = this.lastDecisionMap.get(outcome.symbol);
      const lastMarketData = this.lastMarketDataMap.get(outcome.symbol) || {
        rsi: 50,
        macdHistogram: 0,
        bbPercentB: 0.5,
        atrNormalized: 0.01,
        volumeDelta: 0,
        orderBookImbalance: 0,
        momentum: 0,
        priceAction: 0,
      };

      if (lastDecision) {
        await this.brain.recordTradeResult(
          lastDecision,
          lastMarketData,
          outcome.pnl,
          outcome.entryPrice,
          outcome.exitPrice
        );
      }

      this.tradeCount += 1;

      await this.saveState();
    } catch (error) {
      console.error('[BrainGateway] recordTradeOutcome() failed:', error);
    }
  }

  registerTradeOpened(timestamp = Date.now()): void {
    this.tradeTimestamps.push(timestamp);
    this.trimTradeTimestamps();
  }

  async runMaintenance(now = Date.now()): Promise<void> {
    if (!this.isReady() || this.maintenanceRunning) return;

    this.maintenanceRunning = true;

    try {
      const { learning } = this.config;

      if (this.isDue(this.lastMaintenance.hourly, learning.continualLearningIntervalMs, now)) {
        this.lastMaintenance.hourly = now;
      }

      if (this.isDue(this.lastMaintenance.daily, learning.metaLearningIntervalMs, now)) {
        this.lastMaintenance.daily = now;
      }

      if (
        this.isDue(
          this.lastMaintenance.quantumEvolution,
          learning.quantumEvolutionIntervalMs,
          now
        )
      ) {
        this.lastMaintenance.quantumEvolution = now;
      }

      if (
        this.isDue(
          this.lastMaintenance.featureEvolution,
          learning.featureEvolutionIntervalMs,
          now
        )
      ) {
        this.lastMaintenance.featureEvolution = now;
      }

      await this.saveState();
    } catch (error) {
      console.error('[BrainGateway] runMaintenance() failed:', error);
    } finally {
      this.maintenanceRunning = false;
    }
  }

  async saveState(): Promise<void> {
    if (!this.isReady()) return;

    try {
      if (typeof window === 'undefined') {
        const stateDir = path.dirname(this.config.storage.statePath);
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }
        const statePayload = {
          tradeCount: this.tradeCount,
          lastMaintenance: this.lastMaintenance,
          savedAt: new Date().toISOString(),
        };
        fs.writeFileSync(this.config.storage.statePath, JSON.stringify(statePayload, null, 2));
      }
    } catch (error) {
      console.error('[BrainGateway] saveState() failed:', error);
    }
  }

  private async loadStateIfExists(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        if (fs.existsSync(this.config.storage.statePath)) {
          const raw = fs.readFileSync(this.config.storage.statePath, 'utf8');
          const parsed = JSON.parse(raw);
          this.tradeCount = parsed.tradeCount || 0;
          if (parsed.lastMaintenance) {
            this.lastMaintenance = parsed.lastMaintenance;
          }
          console.log('🧠 [BrainGateway] Loaded previous brain state.');
        }
      }
    } catch {
      // no prior state file
    }
  }

  private transformToMarketData(input: BrainMarketInput): MarketData {
    const ind = input.indicators || {};
    return {
      rsi: ind.rsi ?? 50,
      macdHistogram: ind.macdHistogram ?? ind.macd ?? 0,
      bbPercentB: ind.bbPercentB ?? 0.5,
      atrNormalized: ind.atrNormalized ?? ind.atr ?? 0.01,
      volumeDelta: ind.volumeDelta ?? 0,
      orderBookImbalance: ind.orderBookImbalance ?? 0,
      momentum: ind.momentum ?? 0,
      priceAction: ind.priceAction ?? 0,
    };
  }

  private validateInput(input: BrainMarketInput): { ok: boolean; reason: string } {
    if (!input) {
      return { ok: false, reason: 'Empty market input' };
    }

    if (typeof input.price !== 'number' || !Number.isFinite(input.price)) {
      return { ok: false, reason: 'Invalid price' };
    }

    if (!input.indicators || typeof input.indicators !== 'object') {
      return { ok: false, reason: 'Invalid indicators object' };
    }

    return { ok: true, reason: '' };
  }

  private normalizeDecision(raw: SupremeDecision, regime: string): BrainDecision {
    const action = raw.action;
    const confidence = clamp(toNumber(raw.confidence), 0, 1);
    const uncertainty = clamp(toNumber(raw.uncertainty ?? (1 - confidence)), 0, 1);
    const positionSizeMultiplier = clamp(
      raw.shouldTrade ? 1 + confidence * 0.5 : 0,
      0,
      3
    );

    const reasons: string[] = [raw.reasoning || `Expert: ${raw.selectedExpert}`];
    if (raw.evolvedFeatures && raw.evolvedFeatures.length > 0) {
      reasons.push(`Evolved: ${raw.evolvedFeatures.slice(0, 3).join(', ')}`);
    }

    return {
      action,
      confidence,
      uncertainty,
      regime,
      positionSizeMultiplier,
      reasons,
      modelVersion: 'supreme-quantum-mind-v1',
      timestamp: Date.now(),
      raw: raw as unknown as Record<string, unknown>,
    };
  }

  private applyGuards(decision: BrainDecision, input: BrainMarketInput): BrainDecision {
    let action = decision.action;
    const reasons = [...decision.reasons];
    let positionSizeMultiplier = decision.positionSizeMultiplier;

    if (action !== 'HOLD') {
      if (decision.confidence < this.config.decision.minConfidence) {
        action = 'HOLD';
        reasons.push(
          `Confidence ${decision.confidence.toFixed(4)} below threshold ${this.config.decision.minConfidence}`
        );
      }

      if (decision.uncertainty > this.config.decision.maxUncertainty) {
        action = 'HOLD';
        reasons.push(
          `Uncertainty ${decision.uncertainty.toFixed(4)} above threshold ${this.config.decision.maxUncertainty}`
        );
      }

      if (
        this.config.decision.requireRegimeConfirmation &&
        (!decision.regime || decision.regime === 'UNKNOWN')
      ) {
        action = 'HOLD';
        reasons.push('Regime confirmation required but regime is unknown');
      }

      if (
        Array.isArray(this.config.decision.allowedRegimes) &&
        this.config.decision.allowedRegimes.length > 0 &&
        !this.config.decision.allowedRegimes.includes(decision.regime)
      ) {
        action = 'HOLD';
        reasons.push(`Regime ${decision.regime} not allowed by config`);
      }

      if (!this.withinTradeRateLimit()) {
        action = 'HOLD';
        reasons.push('Max trades per hour reached');
      }
    }

    if (action === 'HOLD') {
      positionSizeMultiplier = 0;
    }

    if (action !== decision.action) {
      reasons.push(`Original action was ${decision.action}`);
    }

    return {
      ...decision,
      action,
      positionSizeMultiplier,
      reasons,
    };
  }

  private withinTradeRateLimit(): boolean {
    const limit = this.config.decision.maxTradesPerHour;
    if (limit <= 0) return true;

    this.trimTradeTimestamps();

    return this.tradeTimestamps.length < limit;
  }

  private trimTradeTimestamps(): void {
    const oneHourMs = 60 * 60 * 1000;
    const now = Date.now();

    this.tradeTimestamps = this.tradeTimestamps.filter(
      (ts) => now - ts < oneHourMs
    );
  }

  private isDue(lastRun: number, intervalMs: number, now: number): boolean {
    return intervalMs > 0 && now - lastRun >= intervalMs;
  }

  private safeHold(reason: string): BrainDecision {
    return {
      action: 'HOLD',
      confidence: 0,
      uncertainty: 1,
      regime: 'UNKNOWN',
      positionSizeMultiplier: 0,
      reasons: [reason],
      modelVersion: 'safe-mode',
      timestamp: Date.now(),
    };
  }
}
