/**
 * Extreme Z-Score Alert System for OMEGA Bot
 */

export enum ZScoreSeverity {
  NORMAL = 'normal',        // |Z| < 2
  ELEVATED = 'elevated',    // 2 <= |Z| < 3
  HIGH = 'high',            // 3 <= |Z| < 4
  EXTREME = 'extreme',      // 4 <= |Z| < 6
  CRITICAL = 'critical'      // |Z| >= 6
}

export enum ZScoreAlertType {
  EXTREME_ENTRY = 'extreme_entry',
  EXTREME_IN_POSITION = 'extreme_in_pos',
  RAPID_CHANGE = 'rapid_change',
  PERSISTENT_EXTREME = 'persistent_extreme',
  DIVERGENCE = 'divergence'
}

export interface ZScoreAlert {
  id: string;
  timestamp: number;
  symbol: string;
  zScore: number;
  severity: ZScoreSeverity;
  alertType: ZScoreAlertType;
  message: string;
  recommendation: string;
  acknowledged: boolean;
  acknowledgedAt?: number;
}

export interface ZAlertConfig {
  rapidChangeZThreshold?: number; // ΔZ in window (default 2.0)
  rapidChangeWindowSec?: number; // default 10s
  persistenceThresholdSec?: number; // default 60s
  cooldownSec?: number; // default 300s (5 min)
}

export class ExtremeZAlertSystem {
  private rapidChangeZThreshold: number;
  private rapidChangeWindowSec: number;
  private persistenceThresholdSec: number;
  private cooldownSec: number;

  private alertHistory: ZScoreAlert[] = [];
  private activeAlerts: Map<string, ZScoreAlert> = new Map();
  private zHistory: Map<string, Array<{ timestamp: number; zScore: number }>> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private callbacks: Array<(alert: ZScoreAlert) => void> = [];

  constructor(config: ZAlertConfig = {}) {
    this.rapidChangeZThreshold = config.rapidChangeZThreshold ?? 2.0;
    this.rapidChangeWindowSec = config.rapidChangeWindowSec ?? 10;
    this.persistenceThresholdSec = config.persistenceThresholdSec ?? 60;
    this.cooldownSec = config.cooldownSec ?? 300;
  }

  public addCallback(cb: (alert: ZScoreAlert) => void) {
    this.callbacks.push(cb);
  }

  public getSeverity(zScore: number): ZScoreSeverity {
    if (!Number.isFinite(zScore)) return ZScoreSeverity.NORMAL;
    const absZ = Math.abs(zScore);
    if (absZ >= 6.0) return ZScoreSeverity.CRITICAL;
    if (absZ >= 4.0) return ZScoreSeverity.EXTREME;
    if (absZ >= 3.0) return ZScoreSeverity.HIGH;
    if (absZ >= 2.0) return ZScoreSeverity.ELEVATED;
    return ZScoreSeverity.NORMAL;
  }

  public check(
    symbol: string,
    zScore: number,
    positionOpen: boolean = false,
    extraInfo?: { volume24hUsd?: number; spreadPct?: number; pairZ?: number }
  ): ZScoreAlert[] {
    if (!Number.isFinite(zScore)) return [];
    const now = Date.now();
    const newAlerts: ZScoreAlert[] = [];

    if (!this.zHistory.has(symbol)) {
      this.zHistory.set(symbol, []);
    }
    const history = this.zHistory.get(symbol)!;
    history.push({ timestamp: now, zScore });
    if (history.length > 500) history.shift();

    const severity = this.getSeverity(zScore);

    // 1. Check Extreme Z
    if (severity === ZScoreSeverity.EXTREME || severity === ZScoreSeverity.CRITICAL) {
      const alertKey = `${symbol}_extreme`;
      if (this.canAlert(alertKey, now)) {
        const direction = zScore > 0 ? '📈 SHORT Signal (Overbought)' : '📉 LONG Signal (Oversold)';
        let msg = `🚨 EXTREME Z-SCORE DETECTED!\nCoin: ${symbol}\nZ-Score: ${zScore > 0 ? '+' : ''}${zScore.toFixed(2)} (${severity.toUpperCase()})\nDirection: ${direction}\n`;
        if (positionOpen) {
          msg += `⚠️ Position CURRENTLY OPEN - High volatility alert!\n`;
        }
        if (extraInfo?.volume24hUsd) {
          msg += `24h Volume: $${(extraInfo.volume24hUsd / 1e6).toFixed(1)}M\n`;
        }

        const recommendation = this.getRecommendation(severity, positionOpen);
        const alert: ZScoreAlert = {
          id: `ALT-Z-${Date.now().toString().slice(-6)}`,
          timestamp: now,
          symbol,
          zScore,
          severity,
          alertType: positionOpen ? ZScoreAlertType.EXTREME_IN_POSITION : ZScoreAlertType.EXTREME_ENTRY,
          message: msg,
          recommendation,
          acknowledged: false
        };

        this.recordAlert(alert, alertKey, now);
        newAlerts.push(alert);
      }
    }

    // 2. Rapid Change Check
    const targetTime = now - this.rapidChangeWindowSec * 1000;
    const oldRec = history.slice().reverse().find(r => r.timestamp <= targetTime);
    if (oldRec) {
      const deltaZ = zScore - oldRec.zScore;
      if (Math.abs(deltaZ) >= this.rapidChangeZThreshold) {
        const alertKey = `${symbol}_rapid`;
        if (this.canAlert(alertKey, now)) {
          const msg = `⚡ RAPID Z-SCORE SPIKE!\nCoin: ${symbol}\nZ shift: ${deltaZ > 0 ? '+' : ''}${deltaZ.toFixed(2)} in ${this.rapidChangeWindowSec}s (from ${oldRec.zScore.toFixed(2)} to ${zScore.toFixed(2)}).\n`;
          const rec = '🔍 Rapid Z surge indicates volume shock or liquidity event. Proceed with strict stop loss.';
          const alert: ZScoreAlert = {
            id: `ALT-ZR-${Date.now().toString().slice(-6)}`,
            timestamp: now,
            symbol,
            zScore,
            severity: ZScoreSeverity.HIGH,
            alertType: ZScoreAlertType.RAPID_CHANGE,
            message: msg,
            recommendation: rec,
            acknowledged: false
          };
          this.recordAlert(alert, alertKey, now);
          newAlerts.push(alert);
        }
      }
    }

    // 3. Persistent Extreme Check
    const extremeStart = history.slice().reverse().find(r => Math.abs(r.zScore) < 3.0);
    const durationSec = extremeStart ? (now - extremeStart.timestamp) / 1000 : 0;
    if (durationSec >= this.persistenceThresholdSec && (severity === ZScoreSeverity.HIGH || severity === ZScoreSeverity.EXTREME || severity === ZScoreSeverity.CRITICAL)) {
      const alertKey = `${symbol}_persistent`;
      if (this.canAlert(alertKey, now)) {
        const msg = `⏰ PERSISTENT EXTREME Z-SCORE!\nCoin: ${symbol}\nZ-Score stays at ${zScore.toFixed(2)} for ${durationSec.toFixed(0)}s.\n`;
        const rec = '🛑 PERSISTENT SPIKE: Cointegration breakdown or regime shift. Consider pausing auto-trade on this coin.';
        const alert: ZScoreAlert = {
          id: `ALT-ZP-${Date.now().toString().slice(-6)}`,
          timestamp: now,
          symbol,
          zScore,
          severity,
          alertType: ZScoreAlertType.PERSISTENT_EXTREME,
          message: msg,
          recommendation: rec,
          acknowledged: false
        };
        this.recordAlert(alert, alertKey, now);
        newAlerts.push(alert);
      }
    }

    // Dispatch callbacks
    for (const alert of newAlerts) {
      this.callbacks.forEach(cb => cb(alert));
    }

    return newAlerts;
  }

  private canAlert(alertKey: string, now: number): boolean {
    const last = this.lastAlertTime.get(alertKey) || 0;
    return now - last >= this.cooldownSec * 1000;
  }

  private recordAlert(alert: ZScoreAlert, alertKey: string, now: number) {
    this.alertHistory.push(alert);
    this.activeAlerts.set(alert.symbol, alert);
    this.lastAlertTime.set(alertKey, now);
    if (this.alertHistory.length > 500) this.alertHistory.shift();
  }

  public getRecommendation(severity: ZScoreSeverity, positionOpen: boolean): string {
    if (severity === ZScoreSeverity.CRITICAL) {
      return '🚨 CRITICAL RISK: DO NOT ENTER new position. Close or hedge existing position immediately.';
    }
    if (severity === ZScoreSeverity.EXTREME) {
      return positionOpen
        ? '⚠️ HIGH VOLATILITY: Position in place. Tighten trailing stop loss or take partial profit.'
        : '⚠️ EXTREME DISPERSE: Statistical mean reversion opportunity ready with strict position sizing.';
    }
    if (severity === ZScoreSeverity.HIGH) {
      return '🔍 ELEVATED DISPERSION: Use max 3x-5x leverage and 5% allocation.';
    }
    return '✅ NORMAL MARKET CONDITIONS.';
  }

  public acknowledgeAlert(symbol: string): boolean {
    const alert = this.activeAlerts.get(symbol);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      return true;
    }
    return false;
  }

  public getActiveAlerts(): ZScoreAlert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.acknowledged);
  }

  public getAlertHistory(limit: number = 50): ZScoreAlert[] {
    return this.alertHistory.slice(-limit);
  }
}
