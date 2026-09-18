// src/brain/maintenance-scheduler.ts

import { BrainGateway } from './brain-gateway';

export class MaintenanceScheduler {
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private brain: BrainGateway,
    private intervalMs = 60_000
  ) {}

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.brain.runMaintenance().catch((error) => {
        console.error('[MaintenanceScheduler] maintenance failed:', error);
      });
    }, this.intervalMs);

    console.log('⏰ [MaintenanceScheduler] Supreme Quantum Mind maintenance scheduler started.');
  }

  stop(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = undefined;

    console.log('⏰ [MaintenanceScheduler] Supreme Quantum Mind maintenance scheduler stopped.');
  }
}
