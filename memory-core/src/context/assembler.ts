import type {
  AssembledContext,
  AssemblyContext,
  AssemblyInput,
  ContextAssemblerConfig,
  ContextLayer,
  ContextProvider,
  PressureLevel,
} from '../types';
import { DefaultTokenBudgetManager } from './token-budget';

const LAYER_RANK: Record<ContextLayer, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

/** Stable ordering: layer ascending (L0 first), then priority ascending (0 highest). */
function compareProviders(a: ContextProvider, b: ContextProvider): number {
  const byLayer = LAYER_RANK[a.layer] - LAYER_RANK[b.layer];
  return byLayer !== 0 ? byLayer : a.priority - b.priority;
}

/**
 * §4.3 — assembles a system prompt from layered context providers plus the caller's
 * operational content and conversation history.
 *
 * Resolves two §4.3 errata fixed in spec 0.2.0 (rulings by the ContextProvider design
 * owner; data schema unchanged):
 *  - `assemble` returns `Promise<AssembledContext>`: it must await the frozen §4.1
 *    `ContextProvider.render(): Promise<string | null>`. The async provider hook is
 *    load-bearing by design (providers do I/O), so a synchronous assembler is not
 *    possible — there is no second solution.
 *  - `agentDid` is sourced from `ContextAssemblerConfig` (construction-time), since it
 *    is a stable per-assembler identity rather than a per-call input.
 */
export class DefaultContextAssembler {
  private readonly budget = new DefaultTokenBudgetManager();
  private readonly providers: ContextProvider[];
  private readonly estimate: (text: string) => number;
  private readonly agentDid: string;

  constructor(private readonly config: ContextAssemblerConfig) {
    this.agentDid = config.agentDid;
    // Freeze provider order at construction (§4.1: immutable at runtime).
    this.providers = [...config.providers].sort(compareProviders);
    this.estimate = config.tokenEstimator ?? ((t: string) => this.budget.estimateTokens(t));
  }

  async assemble(input: AssemblyInput): Promise<AssembledContext> {
    const sanitize = this.config.sanitizer?.sanitize.bind(this.config.sanitizer);

    const operationalContent = sanitize
      ? sanitize(input.operationalContext)
      : input.operationalContext;

    const history = input.conversationHistory.map((t) => ({
      role: t.role,
      content: sanitize ? sanitize(t.content) : t.content,
    }));

    const historyTokens = history.reduce((sum, t) => sum + this.estimate(t.content), 0);
    const operationalTokens = this.estimate(operationalContent);
    const currentTokenUsage = historyTokens + operationalTokens;

    const provisionalBudget = this.budget.allocate(
      {
        contextWindowSize: this.config.contextWindowSize,
        maxOutputTokens: input.maxOutputTokens ?? 0,
        layerWeights: { system: 1 },
      },
      {},
    );
    const pressureLevel: PressureLevel = this.budget.computePressure(
      provisionalBudget,
      currentTokenUsage,
    );

    const ctx: AssemblyContext = {
      purpose: input.purpose,
      agentDid: this.agentDid,
      contextWindowSize: this.config.contextWindowSize,
      currentTokenUsage,
      pressureLevel,
    };

    const breakdown: Record<string, number> = {};
    const renderedProviders: string[] = [];
    const blocks: string[] = [];

    for (const provider of this.providers) {
      if (!provider.shouldRender(ctx)) continue;
      const rendered = await provider.render(ctx);
      if (rendered === null || rendered.length === 0) continue;
      blocks.push(rendered);
      renderedProviders.push(provider.providerId);
      breakdown[provider.providerId] = this.estimate(rendered);
    }

    const systemPrompt = blocks.join('\n\n');
    breakdown.operational = operationalTokens;
    breakdown.history = historyTokens;

    const systemTokens = this.estimate(systemPrompt);
    const totalTokens = systemTokens + operationalTokens + historyTokens;

    return {
      systemPrompt,
      operationalContent,
      conversationHistory: history,
      metadata: {
        totalTokens,
        breakdown,
        pressureLevel,
        // The provider-built system prompt is stable across turns, hence cacheable.
        cacheableTokens: systemTokens,
        renderedProviders,
      },
    };
  }
}
