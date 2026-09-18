/**
 * Telegram & Webhook Notification Engine
 * Sends instant alerts for trades, daily PnL summaries, and circuit breaker events.
 */

import axios from 'axios';

export interface NotificationConfig {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  webhookEnabled: boolean;
  webhookUrl: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private config: NotificationConfig = {
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    webhookEnabled: false,
    webhookUrl: ''
  };

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public updateConfig(newConfig: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): NotificationConfig {
    return { ...this.config };
  }

  public async sendTradeAlert(tradeData: {
    symbolA: string;
    symbolB: string;
    action: 'BUY_LEG_A_SELL_LEG_B' | 'SELL_LEG_A_BUY_LEG_B' | 'EXIT_ALL';
    zScore: number;
    halfLifeSec: number;
    expectedPnlUsd: number;
  }): Promise<boolean> {
    const msg = `🚀 *إشارة تحكيم إحصائي فورية (Omega Arb Alert)*\n\n` +
      `• *الأزواج:* \`${tradeData.symbolA}\` / \`${tradeData.symbolB}\`\n` +
      `• *الإجراء:* ${tradeData.action}\n` +
      `• *مؤشر Z-Score:* \`${tradeData.zScore > 0 ? '+' : ''}${tradeData.zScore.toFixed(2)}\`\n` +
      `• *عمر النصف:* \`${tradeData.halfLifeSec}s\`\n` +
      `• *الربح المتوقع:* \`+$${tradeData.expectedPnlUsd.toFixed(2)}\`\n\n` +
      `⚡ *الحالة:* جاري التنفيذ الذري السريع عبر الـ API`;

    return this.dispatch(msg);
  }

  public async sendCircuitBreakerAlert(reason: string): Promise<boolean> {
    const msg = `🚨 *تحذير حارس الطوارئ (Circuit Breaker Tripped)*\n\n` +
      `• *السبب:* ${reason}\n` +
      `• *الوقت:* ${new Date().toLocaleTimeString('ar-SA')}\n` +
      `• *الإجراء:* تم تعليق فتح الصفقات وجاري الحفاظ على رأس المال.`;

    return this.dispatch(msg);
  }

  public async sendDailySummaryAlert(summary: {
    totalTrades: number;
    winRatePct: number;
    netPnlUsd: number;
    equityUsd: number;
  }): Promise<boolean> {
    const msg = `📊 *التقرير اليومي لأداء بوت التحكيم الكمي*\n\n` +
      `• *إجمالي الصفقات:* \`${summary.totalTrades}\`\n` +
      `• *نسبة النجاح:* \`${summary.winRatePct}%\`\n` +
      `• *صافي الأرباح:* \`${summary.netPnlUsd >= 0 ? '+' : ''}$${summary.netPnlUsd.toFixed(2)}\`\n` +
      `• *رأس المال الحالي:* \`$${summary.equityUsd.toFixed(2)}\`\n\n` +
      `🛡️ *الأداء الإحصائي:* مستقر وزمن الاستجابة فوري.`;

    return this.dispatch(msg);
  }

  private async dispatch(markdownMessage: string): Promise<boolean> {
    let sent = false;

    // Telegram Dispatch
    if (this.config.telegramEnabled && this.config.telegramBotToken && this.config.telegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;
        await axios.post(url, {
          chat_id: this.config.telegramChatId,
          text: markdownMessage,
          parse_mode: 'Markdown'
        });
        sent = true;
      } catch (err) {
        console.error('Telegram notification error:', err);
      }
    }

    // Webhook Dispatch
    if (this.config.webhookEnabled && this.config.webhookUrl) {
      try {
        await axios.post(this.config.webhookUrl, {
          text: markdownMessage,
          timestamp: new Date().toISOString()
        });
        sent = true;
      } catch (err) {
        console.error('Webhook notification error:', err);
      }
    }

    return sent;
  }
}
