// src/ai/metaLearning.ts
export interface Feedback {
  recommendationId: string;
  wasSuccessful: boolean;
  userRating: 1 | 2 | 3 | 4 | 5;
}

export class MetaLearningEngine {
  private strategyScores: Map<string, number> = new Map();

  recordFeedback(strategyName: string, feedback: Feedback) {
    const currentScore = this.strategyScores.get(strategyName) || 0;
    const reward = feedback.wasSuccessful ? (feedback.userRating / 5) : -0.5;
    this.strategyScores.set(strategyName, currentScore + reward);
  }

  getBestStrategy(availableStrategies: string[]): string {
    if (!availableStrategies || availableStrategies.length === 0) return 'DEFAULT';
    return availableStrategies.reduce((best, current) => {
      const currentScore = this.strategyScores.get(current) || 0;
      const bestScore = this.strategyScores.get(best) || 0;
      return currentScore > bestScore ? current : best;
    });
  }
}
