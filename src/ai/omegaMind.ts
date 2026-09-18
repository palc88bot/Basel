// src/ai/omegaMind.ts

/**
 * OMEGA MIND - The Complete Mental Architecture
 * العقل الكامل للبوت مع جميع الطبقات المعرفية
 */

export type CognitiveState = {
  perception: PerceptionState;
  cognition: CognitionState;
  action: ActionState;
  metaCognition: MetaCognitionState;
};

export type PerceptionState = {
  marketData: {
    prices: Map<string, number>;
    volumes: Map<string, number>;
    orderBooks: Map<string, any>;
    fundingRates: Map<string, number>;
  };
  userIntent: {
    currentQuery: string;
    historicalQueries: string[];
    detectedEmotion: 'neutral' | 'excited' | 'worried' | 'confused';
    expertiseLevel: 'beginner' | 'intermediate' | 'expert';
  };
  systemHealth: {
    apiLatency: number;
    memoryUsage: number;
    errorRate: number;
    uptime: number;
  };
};

export type CognitionState = {
  activeAnalysis: {
    symbol: string;
    zScore: number;
    halfLife: number;
    volatility: number;
    confidence: number;
  } | null;
  riskAssessment: {
    portfolioRisk: number;
    correlationRisk: number;
    liquidityRisk: number;
    marketRegime: 'trending' | 'ranging' | 'volatile' | 'calm';
  };
  memoryRecall: {
    relevantExperiences: Experience[];
    learnedPatterns: Pattern[];
    activeKnowledge: Knowledge[];
  };
};

export type ActionState = {
  pendingActions: Action[];
  executedActions: Action[];
  blockedActions: Action[];
  nextDecision: Decision | null;
};

export type MetaCognitionState = {
  selfAwareness: {
    currentMood: string;
    confidenceLevel: number;
    knowledgeGaps: string[];
    recentMistakes: Mistake[];
  };
  learningState: {
    lessonsLearned: Lesson[];
    adaptationRate: number;
    knowledgeBase: KnowledgeBase;
  };
};

export interface Experience {
  id: string;
  timestamp: number;
  type: 'TRADE' | 'ANALYSIS' | 'ERROR' | 'SUCCESS';
  symbol?: string;
  outcome: 'WIN' | 'LOSS' | 'NEUTRAL';
  details: any;
  lessons: string[];
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  successRate: number;
  conditions: string[];
  lastSeen: number;
}

export interface Knowledge {
  id: string;
  category: 'QUANT' | 'RISK' | 'EXECUTION' | 'MARKET' | 'PSYCHOLOGY';
  title: string;
  content: string;
  source: string;
  confidence: number;
  lastUpdated: number;
}

export interface Action {
  id: string;
  type: 'ANALYZE' | 'TRADE' | 'ALERT' | 'LEARN' | 'ADAPT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  payload: any;
  timestamp: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
}

export interface Decision {
  id: string;
  reasoning: string;
  alternatives: string[];
  chosenAction: string;
  confidence: number;
  timestamp: number;
}

export interface Mistake {
  id: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  rootCause: string;
  lesson: string;
  timestamp: number;
  fixed: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  source: string;
  applied: boolean;
  effectiveness: number;
}

export interface KnowledgeBase {
  quantKnowledge: Knowledge[];
  riskKnowledge: Knowledge[];
  executionKnowledge: Knowledge[];
  marketKnowledge: Knowledge[];
  psychologyKnowledge: Knowledge[];
}

export class OmegaMind {
  private state: CognitiveState;
  private experienceLog: Experience[] = [];
  private patternLibrary: Pattern[] = [];
  private mistakeLog: Mistake[] = [];
  private lessonLibrary: Lesson[] = [];

  constructor() {
    this.state = {
      perception: {
        marketData: {
          prices: new Map(),
          volumes: new Map(),
          orderBooks: new Map(),
          fundingRates: new Map(),
        },
        userIntent: {
          currentQuery: '',
          historicalQueries: [],
          detectedEmotion: 'neutral',
          expertiseLevel: 'intermediate',
        },
        systemHealth: {
          apiLatency: 0,
          memoryUsage: 0,
          errorRate: 0,
          uptime: 0,
        },
      },
      cognition: {
        activeAnalysis: null,
        riskAssessment: {
          portfolioRisk: 0,
          correlationRisk: 0,
          liquidityRisk: 0,
          marketRegime: 'ranging',
        },
        memoryRecall: {
          relevantExperiences: [],
          learnedPatterns: [],
          activeKnowledge: [],
        },
      },
      action: {
        pendingActions: [],
        executedActions: [],
        blockedActions: [],
        nextDecision: null,
      },
      metaCognition: {
        selfAwareness: {
          currentMood: 'confident',
          confidenceLevel: 0.7,
          knowledgeGaps: [],
          recentMistakes: [],
        },
        learningState: {
          lessonsLearned: [],
          adaptationRate: 0.5,
          knowledgeBase: {
            quantKnowledge: [],
            riskKnowledge: [],
            executionKnowledge: [],
            marketKnowledge: [],
            psychologyKnowledge: [],
          },
        },
      },
    };
  }

  /**
   * الإدراك: استقبال البيانات من البيئة
   */
  perceive(data: Partial<PerceptionState>): void {
    // تحديث بيانات السوق
    if (data.marketData) {
      this.state.perception.marketData = {
        ...this.state.perception.marketData,
        ...data.marketData,
      };
    }

    // تحديث نية المستخدم
    if (data.userIntent) {
      this.state.perception.userIntent = {
        ...this.state.perception.userIntent,
        ...data.userIntent,
      };

      // كشف العاطفة من نص الرسالة
      this.detectEmotion(data.userIntent.currentQuery);
    }

    // تحديث صحة النظام
    if (data.systemHealth) {
      this.state.perception.systemHealth = {
        ...this.state.perception.systemHealth,
        ...data.systemHealth,
      };
    }
  }

  /**
   * التفكير: معالجة البيانات واتخاذ القرارات
   */
  async think(): Promise<Decision | null> {
    this.recallRelevantExperiences();
    this.assessRisks();
    const alternatives = this.generateAlternatives();
    const evaluated = this.evaluateAlternatives(alternatives);
    const decision = this.makeDecision(evaluated);
    this.state.action.nextDecision = decision;
    return decision;
  }

  /**
   * الفعل: تنفيذ القرار
   */
  async act(decision: Decision): Promise<void> {
    const action: Action = {
      id: `ACT-${Date.now()}`,
      type: this.inferActionType(decision),
      priority: 'MEDIUM',
      payload: decision,
      timestamp: Date.now(),
      status: 'EXECUTING',
    };

    this.state.action.pendingActions.push(action);

    try {
      await this.executeAction(action);
      action.status = 'COMPLETED';
      this.state.action.executedActions.push(action);

      this.logExperience({
        id: `EXP-${Date.now()}`,
        timestamp: Date.now(),
        type: 'SUCCESS',
        details: { action, decision },
        lessons: [],
        outcome: 'WIN',
      });
    } catch (error) {
      action.status = 'FAILED';
      this.state.action.blockedActions.push(action);

      this.logMistake({
        id: `MST-${Date.now()}`,
        description: `Failed to execute action: ${action.type}`,
        impact: 'MEDIUM',
        rootCause: error instanceof Error ? error.message : 'Unknown',
        lesson: 'Need better error handling',
        timestamp: Date.now(),
        fixed: false,
      });
    }
  }

  /**
   * التعلم: استخراج الدروس من التجارب
   */
  learn(experience: Experience): void {
    const analysis = this.analyzeExperience(experience);
    const lessons = this.extractLessons(analysis);

    lessons.forEach(lesson => {
      this.lessonLibrary.push(lesson);
      this.state.metaCognition.learningState.lessonsLearned.push(lesson);
    });

    this.discoverPatterns();
    this.updateAdaptationRate();
  }

  injectKnowledge(knowledge: Knowledge): void {
    const category = knowledge.category;
    switch (category) {
      case 'QUANT':
        this.state.metaCognition.learningState.knowledgeBase.quantKnowledge.push(knowledge);
        break;
      case 'RISK':
        this.state.metaCognition.learningState.knowledgeBase.riskKnowledge.push(knowledge);
        break;
      case 'EXECUTION':
        this.state.metaCognition.learningState.knowledgeBase.executionKnowledge.push(knowledge);
        break;
      case 'MARKET':
        this.state.metaCognition.learningState.knowledgeBase.marketKnowledge.push(knowledge);
        break;
      case 'PSYCHOLOGY':
        this.state.metaCognition.learningState.knowledgeBase.psychologyKnowledge.push(knowledge);
        break;
    }
  }

  private detectEmotion(text: string): void {
    const emotionKeywords = {
      excited: ['رائع', 'ممتاز', 'فرصة', 'ربح', '🚀', '💰'],
      worried: ['خسارة', 'خطر', 'مشكلة', 'خطأ', '⚠️', '🛡️'],
      confused: ['كيف', 'لماذا', 'ما هو', 'لا أفهم', 'شرح', '❓'],
    };

    let detectedEmotion: 'neutral' | 'excited' | 'worried' | 'confused' = 'neutral';
    let maxScore = 0;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const score = keywords.filter(kw => text.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion as any;
      }
    }

    this.state.perception.userIntent.detectedEmotion = detectedEmotion;
  }

  private recallRelevantExperiences(): void {
    const currentQuery = this.state.perception.userIntent.currentQuery;
    const relevant = this.experienceLog.filter(exp => {
      return exp.details?.symbol && currentQuery.includes(exp.details.symbol);
    });
    this.state.cognition.memoryRecall.relevantExperiences = relevant.slice(-10);
  }

  private assessRisks(): void {
    const positions = this.state.perception.marketData.prices.size;
    this.state.cognition.riskAssessment.portfolioRisk = Math.min(1, positions / 10);
    this.state.cognition.riskAssessment.correlationRisk = 0.3;
    this.state.cognition.riskAssessment.liquidityRisk = 0.2;
    this.state.cognition.riskAssessment.marketRegime = 'ranging';
  }

  private generateAlternatives(): string[] {
    return [
      'تحليل العملة المطلوبة',
      'تقديم نصيحة عامة',
      'تحذير من المخاطر',
      'اقتراح استراتيجية',
    ];
  }

  private evaluateAlternatives(alternatives: string[]): Array<{ action: string; score: number }> {
    return alternatives.map(action => ({
      action,
      score: Math.random(),
    }));
  }

  private makeDecision(evaluated: Array<{ action: string; score: number }>): Decision {
    const best = evaluated.reduce((a, b) => (a.score > b.score ? a : b));
    return {
      id: `DEC-${Date.now()}`,
      reasoning: `Based on analysis, chose: ${best.action}`,
      alternatives: evaluated.map(e => e.action),
      chosenAction: best.action,
      confidence: best.score,
      timestamp: Date.now(),
    };
  }

  private analyzeExperience(experience: Experience): any {
    return {
      outcome: experience.outcome,
      context: experience.details,
      duration: Date.now() - experience.timestamp,
    };
  }

  private extractLessons(analysis: any): Lesson[] {
    const lessons: Lesson[] = [];
    if (analysis.outcome === 'LOSS') {
      lessons.push({
        id: `LSN-${Date.now()}`,
        title: 'تعلم من الخسارة',
        content: 'تحليل سبب الخسارة وتجنب تكراره',
        source: 'Experience',
        applied: false,
        effectiveness: 0,
      });
    }
    return lessons;
  }

  private discoverPatterns(): void {}

  private updateAdaptationRate(): void {
    const totalLessons = this.lessonLibrary.length;
    const appliedLessons = this.lessonLibrary.filter(l => l.applied).length;
    this.state.metaCognition.learningState.adaptationRate = 
      totalLessons > 0 ? appliedLessons / totalLessons : 0;
  }

  private logExperience(experience: Experience): void {
    this.experienceLog.push(experience);
    if (this.experienceLog.length > 1000) {
      this.experienceLog = this.experienceLog.slice(-1000);
    }
  }

  private logMistake(mistake: Mistake): void {
    this.mistakeLog.push(mistake);
    this.state.metaCognition.selfAwareness.recentMistakes.push(mistake);

    if (this.state.metaCognition.selfAwareness.recentMistakes.length > 10) {
      this.state.metaCognition.selfAwareness.recentMistakes = 
        this.state.metaCognition.selfAwareness.recentMistakes.slice(-10);
    }
  }

  private async executeAction(action: Action): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private inferActionType(decision: Decision): Action['type'] {
    if (decision.chosenAction.includes('تحليل')) return 'ANALYZE';
    if (decision.chosenAction.includes('تداول')) return 'TRADE';
    if (decision.chosenAction.includes('تحذير')) return 'ALERT';
    return 'LEARN';
  }

  getState(): CognitiveState {
    return this.state;
  }

  getKnowledgeBase(): KnowledgeBase {
    return this.state.metaCognition.learningState.knowledgeBase;
  }

  exportMind(): string {
    return JSON.stringify({
      state: this.state,
      experienceLog: this.experienceLog,
      patternLibrary: this.patternLibrary,
      mistakeLog: this.mistakeLog,
      lessonLibrary: this.lessonLibrary,
    }, null, 2);
  }

  importMind(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.state = parsed.state;
      this.experienceLog = parsed.experienceLog || [];
      this.patternLibrary = parsed.patternLibrary || [];
      this.mistakeLog = parsed.mistakeLog || [];
      this.lessonLibrary = parsed.lessonLibrary || [];
    } catch (error) {
      console.error('[OmegaMind] Failed to import mind:', error);
    }
  }
}
