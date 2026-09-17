/**
 * OMEGA QuantBrain - Signal Decision Record (Audit Trail)
 * =======================================================
 * Logs every quantitative evaluation, filter pass/fail, and trade execution decision.
 * Provides transparent institutional traceability for every scanned asset.
 */

export interface DecisionRecord {
  id: string;
  timestamp: number;
  formattedTime: string;
  symbol: string;
  price: number;
  zScore: number;
  halfLifeSec: number;
  spreadPct: number;
  decision: 'ENTER_LONG' | 'ENTER_SHORT' | 'PREPARED_WATCH' | 'REJECTED';
  rejectionReason?: string;
  executionOutcome?: 'EXECUTED_LIVE' | 'EXECUTED_PAPER' | 'BLOCKED_BY_RISK' | 'MONITORING_ONLY';
  metrics: {
    isCalibrated: boolean;
    isHalfLifeValid: boolean;
    isSafeFilterPass: boolean;
    volume24hUsd: number;
  };
}

export class SignalDecisionRecorder {
  private records: DecisionRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords: number = 200) {
    this.maxRecords = maxRecords;
  }

  public recordDecision(record: Omit<DecisionRecord, 'id' | 'formattedTime'>): DecisionRecord {
    const fullRecord: DecisionRecord = {
      ...record,
      id: `DEC-${record.timestamp}-${record.symbol}`,
      formattedTime: new Date(record.timestamp).toLocaleTimeString('ar-SA')
    };

    this.records.unshift(fullRecord);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }

    return fullRecord;
  }

  public getRecentDecisions(limit: number = 50, filterSymbol?: string): DecisionRecord[] {
    let list = this.records;
    if (filterSymbol) {
      list = list.filter(r => r.symbol === filterSymbol);
    }
    return list.slice(0, limit);
  }

  public getStats(): {
    totalEvaluations: number;
    acceptedLongs: number;
    acceptedShorts: number;
    preparedCount: number;
    rejectedCount: number;
  } {
    let longs = 0;
    let shorts = 0;
    let prepared = 0;
    let rejected = 0;

    for (const r of this.records) {
      if (r.decision === 'ENTER_LONG') longs++;
      else if (r.decision === 'ENTER_SHORT') shorts++;
      else if (r.decision === 'PREPARED_WATCH') prepared++;
      else rejected++;
    }

    return {
      totalEvaluations: this.records.length,
      acceptedLongs: longs,
      acceptedShorts: shorts,
      preparedCount: prepared,
      rejectedCount: rejected
    };
  }

  public clear(): void {
    this.records = [];
  }
}
