// src/ai/dataFlowEngine.ts

import { OmegaMind } from './omegaMind';

export class DataFlowEngine {
  private mind: OmegaMind;
  private isRunning: boolean = false;
  private cycleInterval: number = 5000; // 5 seconds

  constructor(mind: OmegaMind) {
    this.mind = mind;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log('[DataFlowEngine] Started');

    while (this.isRunning) {
      try {
        await this.runCycle();
      } catch (error) {
        console.error('[DataFlowEngine] Cycle error:', error);
      }
      await new Promise(resolve => setTimeout(resolve, this.cycleInterval));
    }
  }

  stop(): void {
    this.isRunning = false;
    console.log('[DataFlowEngine] Stopped');
  }

  private async runCycle(): Promise<void> {
    await this.perceive();
    const decision = await this.mind.think();
    if (decision) {
      await this.mind.act(decision);
    }

    const state = this.mind.getState();
    if (state.action.executedActions.length > 0) {
      const lastAction = state.action.executedActions[state.action.executedActions.length - 1];
      this.mind.learn({
        id: `EXP-${Date.now()}`,
        timestamp: Date.now(),
        type: 'SUCCESS',
        details: { action: lastAction },
        lessons: [],
        outcome: 'WIN',
      });
    }
  }

  private async perceive(): Promise<void> {
    try {
      // Mock fetch or actual backend call to get system data
      const res = await fetch('http://localhost:3000/api/quant/diagnose-positions').catch(() => null);
      const data = res ? await res.json() : { diagnosis: [] };
      
      const positions = data.diagnosis || [];
      const mockPrices = new Map<string, number>();
      positions.forEach((p: any) => mockPrices.set(p.symbol, p.currentPrice));

      this.mind.perceive({
        marketData: {
          prices: mockPrices,
          volumes: new Map(),
          orderBooks: new Map(),
          fundingRates: new Map(),
        },
        systemHealth: {
          apiLatency: 15,
          memoryUsage: 200,
          errorRate: 0,
          uptime: 3600,
        },
      });
    } catch (e) {
      console.warn('Failed to perceive market data in background cycle', e);
    }
  }

  async processUserMessage(message: string): Promise<string> {
    this.mind.perceive({
      userIntent: {
        currentQuery: message,
        historicalQueries: [],
        detectedEmotion: 'neutral',
        expertiseLevel: 'intermediate',
      },
    });

    const decision = await this.mind.think();
    if (decision) {
      await this.mind.act(decision);
    }

    return decision?.reasoning || 'تمت المعالجة الداخليّة';
  }
}
