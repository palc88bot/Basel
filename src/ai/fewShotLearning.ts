// src/ai/fewShotLearning.ts
export interface Example {
  input: string;
  output: string;
}

export class FewShotEngine {
  private examples: Example[] = [];

  addExample(input: string, output: string) {
    if (this.examples.length >= 5) this.examples.shift(); // الاحتفاظ بآخر 5 أمثلة فقط
    this.examples.push({ input, output });
  }

  generatePrompt(userQuery: string, basePrompt: string): string {
    let prompt = basePrompt + "\n\nأمثلة على النمط المطلوب:\n";
    this.examples.forEach((ex, i) => {
      prompt += `مثال ${i + 1}:\nالسؤال: ${ex.input}\nالرد: ${ex.output}\n---\n`;
    });
    prompt += `\nالآن، أجب على السؤال التالي بنفس النمط:\nالسؤال: ${userQuery}`;
    return prompt;
  }
}
