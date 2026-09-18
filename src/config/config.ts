// src/config/config.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export interface BotConfig {
    symbol: string;
    timeframe: string;
    leverage: number;
    initialCapital: number;
    
    maxDailyLossPercent: number;
    maxDrawdownPercent: number;
    maxPositionSizePercent: number;
    maxOpenPositions: number;
    maxLeverage: number;
    dailyTradeLimit: number;
    cooldownAfterLoss: number;
    maxConsecutiveLosses: number;
    
    numQubits: number;
    numLayers: number;
    confidenceThreshold: number;
    
    stopLossPercent: number;
    takeProfitPercent: number;
    commissionPercent: number;
    
    alertIntervalHours: number;
    enableTelegram: boolean;
    enableDiscord: boolean;
    
    enableLogging: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
}

export const config: BotConfig = {
    symbol: process.env.SYMBOL || 'BTCUSDT',
    timeframe: process.env.TIMEFRAME || '1m',
    leverage: parseInt(process.env.LEVERAGE || '5'),
    initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '10000'),
    
    maxDailyLossPercent: parseFloat(process.env.MAX_DAILY_LOSS || '0.03'),
    maxDrawdownPercent: parseFloat(process.env.MAX_DRAWDOWN || '0.15'),
    maxPositionSizePercent: parseFloat(process.env.MAX_POSITION_SIZE || '0.02'),
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS || '3'),
    maxLeverage: parseInt(process.env.MAX_LEVERAGE || '10'),
    dailyTradeLimit: parseInt(process.env.DAILY_TRADE_LIMIT || '50'),
    cooldownAfterLoss: parseInt(process.env.COOLDOWN_AFTER_LOSS || '15'),
    maxConsecutiveLosses: parseInt(process.env.MAX_CONSECUTIVE_LOSSES || '5'),
    
    numQubits: parseInt(process.env.NUM_QUBITS || '8'),
    numLayers: parseInt(process.env.NUM_LAYERS || '3'),
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.15'),
    
    stopLossPercent: parseFloat(process.env.STOP_LOSS || '0.01'),
    takeProfitPercent: parseFloat(process.env.TAKE_PROFIT || '0.02'),
    commissionPercent: parseFloat(process.env.COMMISSION || '0.0004'),
    
    alertIntervalHours: parseInt(process.env.ALERT_INTERVAL_HOURS || '4'),
    enableTelegram: process.env.ENABLE_TELEGRAM === 'true',
    enableDiscord: process.env.ENABLE_DISCORD === 'true',
    
    enableLogging: process.env.ENABLE_LOGGING !== 'false',
    logLevel: (process.env.LOG_LEVEL || 'INFO') as any
};

export function validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!process.env.ENCRYPTION_KEY) errors.push('ENCRYPTION_KEY missing');
    if (!process.env.EXCHANGE_API_KEY) errors.push('EXCHANGE_API_KEY missing');
    if (!process.env.EXCHANGE_API_SECRET) errors.push('EXCHANGE_API_SECRET missing');
    
    if (config.leverage > config.maxLeverage) {
        errors.push(`Leverage ${config.leverage}x exceeds max ${config.maxLeverage}x`);
    }
    
    if (config.maxDailyLossPercent > 0.10) {
        errors.push('Max daily loss too high (> 10%)');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
