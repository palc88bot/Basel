/**
 * Multi-Exchange Collateral Guard & Auto-Rebalancing Engine
 * Protects against liquidation risks by monitoring margin levels across venues and dynamically rebalancing.
 */

export interface ExchangeCollateral {
  exchangeName: string;
  totalEquityUsd: number;
  usedMarginUsd: number;
  availableMarginUsd: number;
  marginLevelPct: number;
  liquidationRiskScore: number; // 0 (Safe) - 100 (High Risk)
}

export interface RebalanceAction {
  sourceExchange: string;
  targetExchange: string;
  transferAmountUsd: number;
  reason: string;
  recommended: boolean;
}

export class CollateralGuard {
  private static instance: CollateralGuard;

  private constructor() {}

  public static getInstance(): CollateralGuard {
    if (!CollateralGuard.instance) {
      CollateralGuard.instance = new CollateralGuard();
    }
    return CollateralGuard.instance;
  }

  public evaluateCollateralState(exchanges: {
    name: string;
    equity: number;
    usedMargin: number;
  }[]): {
    collateralList: ExchangeCollateral[];
    rebalanceAction: RebalanceAction | null;
    overallLiquidationRisk: 'SAFE' | 'WARNING' | 'CRITICAL';
  } {
    const collateralList: ExchangeCollateral[] = exchanges.map(ex => {
      const avail = Math.max(0, ex.equity - ex.usedMargin);
      const marginLevelPct = ex.usedMargin > 0 ? (ex.equity / ex.usedMargin) * 100 : 999;
      
      let riskScore = 0;
      if (marginLevelPct < 150) riskScore = 85;
      else if (marginLevelPct < 250) riskScore = 45;
      else riskScore = 10;

      return {
        exchangeName: ex.name,
        totalEquityUsd: ex.equity,
        usedMarginUsd: ex.usedMargin,
        availableMarginUsd: avail,
        marginLevelPct: parseFloat(marginLevelPct.toFixed(1)),
        liquidationRiskScore: riskScore
      };
    });

    // Check for imbalance needing auto-rebalancing
    let rebalanceAction: RebalanceAction | null = null;

    if (collateralList.length >= 2) {
      const sorted = [...collateralList].sort((a, b) => a.availableMarginUsd - b.availableMarginUsd);
      const lowestAvail = sorted[0];
      const highestAvail = sorted[sorted.length - 1];

      const diff = highestAvail.availableMarginUsd - lowestAvail.availableMarginUsd;
      if (diff > 1000 && lowestAvail.availableMarginUsd < 500) {
        const transferAmt = parseFloat((diff / 2).toFixed(2));
        rebalanceAction = {
          sourceExchange: highestAvail.exchangeName,
          targetExchange: lowestAvail.exchangeName,
          transferAmountUsd: transferAmt,
          reason: `موازنة التوزيع لمنع مخاطر التصفية على منصة ${lowestAvail.exchangeName}`,
          recommended: true
        };
      }
    }

    const maxRisk = Math.max(...collateralList.map(c => c.liquidationRiskScore), 0);
    let overallLiquidationRisk: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (maxRisk >= 80) overallLiquidationRisk = 'CRITICAL';
    else if (maxRisk >= 40) overallLiquidationRisk = 'WARNING';

    return {
      collateralList,
      rebalanceAction,
      overallLiquidationRisk
    };
  }
}
