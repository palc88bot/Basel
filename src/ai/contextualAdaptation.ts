// src/ai/contextualAdaptation.ts
export interface ContextConfig {
  marketVolatility: 'LOW' | 'MEDIUM' | 'HIGH';
  userExperience: 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
}

export class ContextualAdaptationEngine {
  adaptResponse(rawResponse: string, context: ContextConfig): string {
    let adapted = rawResponse;

    // 1. التكيف مع تقلب السوق
    if (context.marketVolatility === 'HIGH') {
      adapted = `⚠️ **تنبيه تقلب عالي:** السوق يتحرك بسرعة.\n\n${adapted}\n\n💡 *نصيحة:* استخدم أوامر Stop-loss ضيقة.`;
    }

    // 2. التكيف مع خبرة المستخدم
    if (context.userExperience === 'BEGINNER') {
      adapted = adapted.replace(/Z-Score|Ornstein-Uhlenbeck|Kalman/gi, (match) => {
        const glossary: Record<string, string> = {
          'Z-Score': 'مقياس الانحراف عن المتوسط (Z-Score)',
          'Ornstein-Uhlenbeck': 'نموذج الارتداد للمتوسط',
          'Kalman': 'مرشح كالمان (أداة تنبؤ)'
        };
        return glossary[match] || match;
      });
    }

    return adapted;
  }
}
