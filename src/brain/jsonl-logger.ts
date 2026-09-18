// src/brain/jsonl-logger.ts

import fs from 'fs';
import path from 'path';

export class JsonlLogger {
  private ready: Promise<void>;

  constructor(private filePath: string) {
    this.ready = this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (e) {
      console.warn('[JsonlLogger] Directory check error (harmless in browser):', e);
    }
  }

  async write(record: Record<string, unknown>): Promise<void> {
    try {
      await this.ready;

      const line = JSON.stringify({
        ...record,
        loggedAt: new Date().toISOString(),
      });

      if (typeof window === 'undefined') {
        await fs.promises.appendFile(this.filePath, `${line}\n`, 'utf8');
      } else {
        // Fallback for client side storage
        const key = `brain_log_${path.basename(this.filePath)}`;
        const existing = localStorage.getItem(key) || '';
        const lines = existing ? existing.split('\n') : [];
        lines.push(line);
        if (lines.length > 500) lines.shift();
        localStorage.setItem(key, lines.join('\n'));
      }
    } catch (error) {
      console.error(`[JsonlLogger] Failed writing to ${this.filePath}:`, error);
    }
  }
}
