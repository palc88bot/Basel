import { OMEGAQwenCore } from './omegaQwenCore';

/**
 * OMEGA_Qwen_Orchestrator
 * The central brain orchestrating all cognitive engines to form the ultimate Qwen-like mastermind.
 */
export class OMEGAQwenOrchestrator {
  private static instance: OMEGAQwenOrchestrator;
  public core: OMEGAQwenCore;

  private constructor() {
    this.core = new OMEGAQwenCore();
  }

  public static getInstance(): OMEGAQwenOrchestrator {
    if (!OMEGAQwenOrchestrator.instance) {
      OMEGAQwenOrchestrator.instance = new OMEGAQwenOrchestrator();
    }
    return OMEGAQwenOrchestrator.instance;
  }

  async process(query: string, context: any): Promise<string> {
    return await this.core.processUserQuery(query, context);
  }
}

export const omegaOrchestrator = OMEGAQwenOrchestrator.getInstance();
