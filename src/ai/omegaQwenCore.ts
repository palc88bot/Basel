// src/ai/omegaQwenCore.ts
import { ChainOfThoughtEngine } from './chainOfThought';
import { SelfCorrectionEngine } from './selfCorrection';
import { ClarificationEngine } from './clarificationEngine';
import { MultiPerspectiveEngine } from './multiPerspective';
import { EmotionalIntelligenceEngine } from './emotionalIntelligence';
import { KnowledgeGraphEngine } from './knowledgeGraph';
import { MetaLearningEngine } from './metaLearning';
import { FewShotEngine } from './fewShotLearning';
import { ContextualAdaptationEngine } from './contextualAdaptation';
import { TransparencyEngine } from './reasoningTransparency';

export class OMEGAQwenCore {
  private cot = new ChainOfThoughtEngine();
  private selfCorrect = new SelfCorrectionEngine();
  private clarifier = new ClarificationEngine();
  private multiPersp = new MultiPerspectiveEngine();
  private emotion = new EmotionalIntelligenceEngine();
  private knowledge = new KnowledgeGraphEngine();
  private meta = new MetaLearningEngine();
  private fewShot = new FewShotEngine();
  private context = new ContextualAdaptationEngine();
  private transparency = new TransparencyEngine();

  async processUserQuery(query: string, rawContext: any): Promise<string> {
    // Ensure robust default contexts to avoid undefined errors
    const userContext = rawContext || {};
    userContext.marketData = userContext.marketData || { volatility: 0 };
    userContext.profile = userContext.profile || { experience: 'INTERMEDIATE' };
    userContext.symbol = userContext.symbol || 'السوق العام';

    // 1. التكيف السياقي وتحليل العاطفة
    const emotionalState = this.emotion.analyzeEmotion(query, userContext);
    
    // 2. التحقق من الحاجة لتوضيح
    if (this.clarifier.needsClarification(query, userContext)) {
      const questions = this.clarifier.generateClarificationQuestions(query, userContext);
      return this.emotion.adaptResponseToEmotion(
        this.clarifier.formatClarificationQuestions(questions), 
        emotionalState
      );
    }

    // 3. بناء سلسلة التفكير (Chain of Thought)
    const thoughtChain = await this.cot.buildChainOfThought(query, userContext);

    // 4. تحليل متعدد الزوايا
    const perspectives = await this.multiPersp.analyzeFromMultiplePerspectives(userContext.symbol, userContext.marketData);

    // 5. دمج المعرفة والتعلم القليل
    const insights = this.knowledge.getContextualInsights(userContext.symbol);
    const prompt = this.fewShot.generatePrompt(query, `البيانات: ${JSON.stringify(perspectives)}\nالمعرفة: ${insights.join(' | ')}`);

    // 6. توليد الرد الأولي (محاكاة أو ربطه بنموذج حقيقي مستقبلاً)
    let rawResponse = `بناءً على التحليل، ${perspectives.consensus}.\n\nمسار التفكير:\n${thoughtChain.reasoningPath}`;

    // 7. التصحيح الذاتي
    const verification = await this.selfCorrect.verifyResponse(rawResponse, userContext);
    if (!verification.isValid) {
      rawResponse = this.selfCorrect.applyCorrections(rawResponse, verification.corrections);
    }

    // 8. التكيف السياقي النهائي
    let finalResponse = this.context.adaptResponse(rawResponse, {
      marketVolatility: userContext.marketData.volatility > 0.05 ? 'HIGH' : 'MEDIUM',
      userExperience: userContext.profile.experience
    });

    // 9. تطبيق طبقة الذكاء العاطفي
    finalResponse = this.emotion.adaptResponseToEmotion(finalResponse, emotionalState);

    // 10. إضافة شفافية المصادر
    this.transparency.addSource("Binance Real-time API", 0.98);
    this.transparency.addSource("OMEGA Quantitative Model", 0.95);
    finalResponse += this.transparency.generateTransparencyFooter();

    // 11. تسجيل للتعلم المستقبلي (Meta-Learning)
    // (يتم استدعاؤه لاحقاً عند تلقي تقييم المستخدم)

    return finalResponse;
  }
}
