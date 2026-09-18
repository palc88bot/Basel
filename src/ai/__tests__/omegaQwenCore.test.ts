import { OMEGAQwenCore } from '../omegaQwenCore';
import { SelfCorrectionEngine } from '../selfCorrection';
import { ContextualAdaptationEngine } from '../contextualAdaptation';
import { ClarificationEngine } from '../clarificationEngine';

describe('OMEGA Qwen Core - Unit & Integration Tests', () => {
  
  // 1. اختبار محرك التصحيح الذاتي
  describe('SelfCorrectionEngine', () => {
    it('يجب أن يكتشف العبارات المالية الخطرة ويصححها', async () => {
      const engine = new SelfCorrectionEngine();
      const dangerousResponse = 'هذه فرصة ذهبية ومضمونة للربح، Z-Score = 3.0';
      const context = { zScore: 3.0 };
      
      const result = await engine.verifyResponse(dangerousResponse, context);
      
      expect(result.isValid).toBe(false);
      expect(result.corrections).toBeDefined();
    });
  });

  // 2. اختبار محرك التكيف السياقي (تبسيط المصطلحات للمبتدئين)
  describe('ContextualAdaptationEngine', () => {
    it('يجب أن يبسط المصطلحات المعقدة عندما يكون المستخدم مبتدئاً', () => {
      const engine = new ContextualAdaptationEngine();
      const rawResponse = 'يشير Z-Score العالي إلى أن عملية Ornstein-Uhlenbeck تتنبأ بالارتداد.';
      
      const adapted = engine.adaptResponse(rawResponse, {
        marketVolatility: 'MEDIUM',
        userExperience: 'BEGINNER'
      });
      
      expect(adapted).toContain('مقياس الانحراف عن المتوسط (Z-Score)');
      expect(adapted).toContain('نموذج الارتداد للمتوسط');
    });
  });

  // 3. اختبار محرك الأسئلة التوضيحية
  describe('ClarificationEngine', () => {
    it('يجب أن يطلب توضيحاً إذا كان السؤال غامضاً جداً', () => {
      const engine = new ClarificationEngine();
      const vagueQuery = 'ما'; // query very short
      const context = { };
      
      const needsClarification = engine.needsClarification(vagueQuery, context);
      expect(needsClarification).toBe(true);
      
      const questions = engine.generateClarificationQuestions(vagueQuery, context);
      expect(questions.length).toBeGreaterThan(0);
    });
  });

  // 4. اختبار تكاملي (Integration Test) للمحرك المركزي
  describe('OMEGAQwenCore Integration', () => {
    it('يجب أن يعالج الاستعلام بنجاح ويضيف تذييل الشفافية', async () => {
      const core = new OMEGAQwenCore();
      const mockQuery = 'هل يجب أن أشتري BTCUSDT الآن؟';
      const mockContext = {
        symbol: 'BTCUSDT',
        profile: { experience: 'INTERMEDIATE' },
        marketData: { volatility: 0.02, trend: 'up', zScore: 1.2 }
      };

      const response = await core.processUserQuery(mockQuery, mockContext);

      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(50);
      expect(response).toContain('مصادر البيانات والتحليل');
    });
  });
});
