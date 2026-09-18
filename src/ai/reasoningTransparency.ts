// src/ai/reasoningTransparency.ts
export interface DataSource {
  name: string;
  timestamp: number;
  reliability: number; // 0-1
}

export class TransparencyEngine {
  private sources: DataSource[] = [];

  addSource(name: string, reliability: number) {
    this.sources.push({ name, timestamp: Date.now(), reliability });
  }

  generateTransparencyFooter(): string {
    if (this.sources.length === 0) return '';
    
    let footer = "\n\n🔍 **مصادر البيانات والتحليل:**\n";
    this.sources.forEach(source => {
      const time = new Date(source.timestamp).toLocaleTimeString('ar-SA');
      const stars = '⭐'.repeat(Math.round(source.reliability * 5));
      footer += `├─ ${source.name} (تحديث: ${time}) ${stars}\n`;
    });
    footer += "└─ *تم توليد هذا التحليل بواسطة OMEGA-Qwen Core*";
    
    // Clear sources after generation for the next cycle
    this.sources = [];
    return footer;
  }
}
