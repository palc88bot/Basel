import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "./omegaPersona";
import { OMEGAQwenOrchestrator } from "./omegaQwenOrchestrator";

// Short term memory interface
export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export class OmegaCopilot {
  private memory: ChatMessage[] = [];
  private ai: GoogleGenAI | null = null;
  private readonly MAX_HISTORY = 20;
  private orchestrator: OMEGAQwenOrchestrator;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    this.orchestrator = OMEGAQwenOrchestrator.getInstance();
  }

  public getOrchestrator(): OMEGAQwenOrchestrator {
    return this.orchestrator;
  }

  public updateApiKey(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async chat(userMessage: string, systemContextData: any): Promise<string> {
    if (!this.ai) {
      throw new Error("API Key for Gemini is not configured.");
    }

    try {
      // 1. Process query via Orchestrator cognitive engines for context adaptation and thought chaining
      const enrichedUserMessage = await this.orchestrator.process(userMessage, systemContextData);

      const systemInstruction = buildSystemPrompt(systemContextData);

      // Create history
      const history = [...this.memory];

      const response = await this.ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: enrichedUserMessage }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 2048,
        }
      });

      const responseText = response.text || 'لا يوجد استجابة من المودل.';

      // Save to memory
      this.memory.push({ role: 'user', parts: [{ text: userMessage }] });
      this.memory.push({ role: 'model', parts: [{ text: responseText }] });

      // Maintain max history
      if (this.memory.length > this.MAX_HISTORY) {
        this.memory = this.memory.slice(this.memory.length - this.MAX_HISTORY);
      }

      return responseText;
    } catch (err: any) {
      console.error("[OmegaCopilot] Error generating chat response:", err);
      throw err;
    }
  }

  public clearMemory() {
    this.memory = [];
  }
}
