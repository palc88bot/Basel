// src/ai/clarificationEngine.ts
export class ClarificationEngine {
  needsClarification(query: string, userContext: any): boolean {
    const wordCount = query.trim().split(/\s+/).length;
    // Ambiguous if very short and no context
    return wordCount <= 2 && (!userContext || !userContext.symbol);
  }

  generateClarificationQuestions(query: string, userContext: any): string[] {
    return [
      "هل يمكنك تحديد الأصل المالي (العملة) الذي ترغب في تحليله؟",
      "هل تبحث عن تقييم فني (Technical) أم تقييم كمي (Quantitative) مثل Z-Score؟"
    ];
  }

  formatClarificationQuestions(questions: string[]): string {
    let result = "عذراً، أرى أن طلبك عام جداً. لتقديم استشارة دقيقة، هل يمكنك توضيح:\n";
    questions.forEach(q => {
      result += `- ${q}\n`;
    });
    return result;
  }
}
