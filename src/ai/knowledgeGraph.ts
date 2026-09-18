// src/ai/knowledgeGraph.ts
export class KnowledgeGraphEngine {
  private graph: Map<string, Map<string, string[]>> = new Map();

  addRelation(entity: string, relationType: string, target: string) {
    if (!this.graph.has(entity)) this.graph.set(entity, new Map());
    const relations = this.graph.get(entity)!;
    if (!relations.has(relationType)) relations.set(relationType, []);
    relations.get(relationType)!.push(target);
  }

  getContextualInsights(entity: string): string[] {
    const insights: string[] = [];
    const relations = this.graph.get(entity);
    if (relations) {
      for (const [type, targets] of relations.entries()) {
        insights.push(`[${entity}] ${type} → ${targets.join(', ')}`);
      }
    }
    return insights;
  }
}
