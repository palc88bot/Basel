// src/ai/emotionalIntelligence.ts
export class EmotionalIntelligenceEngine {
  analyzeEmotion(query: string, userContext: any): any {
    const q = query.toLowerCase();
    if (q.includes('خسارة') || q.includes('تصفية') || q.includes('خائف')) return 'ANXIOUS';
    if (q.includes('ربح') || q.includes('نجاح') || q.includes('ممتاز')) return 'EXCITED';
    if (q.includes('لماذا') || q.includes('كيف') || q.includes('غريب')) return 'CONFUSED';
    return 'NEUTRAL';
  }

  adaptResponseToEmotion(response: string, emotion: any): string {
    switch (emotion) {
      case 'ANXIOUS':
        return `طمأنينة: خوارزميات إدارة المخاطر لدينا مصممة لحمايتك أولاً.\n\n${response}`;
      case 'EXCITED':
        return `أداء ممتاز! ومع ذلك، لِنحافظ على الانضباط الكمي الصارم.\n\n${response}`;
      case 'CONFUSED':
        return `دعني أبسّط لك الأمر خطوة بخطوة.\n\n${response}`;
      default:
        return response;
    }
  }
}
