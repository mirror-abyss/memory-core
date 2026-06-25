import type {
  PressureLevel,
  TokenBudget,
  TokenBudgetConfig,
  TokenBudgetManager,
} from '../types';

/** Rough characters-per-token ratio for the default heuristic estimator. */
const CHARS_PER_TOKEN = 4;

const WARNING_RATIO = 0.75;
const CRITICAL_RATIO = 0.9;

/**
 * §4.4 — token budgeting as pure functions. The reference implementation uses
 * fixed layer weights and a character-count heuristic for estimation. Implementers
 * that need tokenizer-accurate counts supply their own estimator (see
 * ContextAssemblerConfig.tokenEstimator).
 */
export class DefaultTokenBudgetManager implements TokenBudgetManager {
  allocate(config: TokenBudgetConfig, currentUsage: Record<string, number>): TokenBudget {
    const reserved = config.reservedTokens ?? 0;
    const total = Math.max(0, config.contextWindowSize - config.maxOutputTokens - reserved);

    const weightSum = Object.values(config.layerWeights).reduce((a, b) => a + b, 0);
    const allocations: Record<string, number> = {};

    if (weightSum > 0) {
      for (const [layer, weight] of Object.entries(config.layerWeights)) {
        const share = Math.floor((total * weight) / weightSum);
        const used = currentUsage[layer] ?? 0;
        // The allocation is the layer's fair share; never report negative headroom.
        allocations[layer] = Math.max(0, share - used);
      }
    }

    return { allocations, reserved, total };
  }

  computePressure(budget: TokenBudget, usedTokens: number): PressureLevel {
    if (budget.total <= 0) return 'critical';
    const ratio = usedTokens / budget.total;
    if (ratio >= CRITICAL_RATIO) return 'critical';
    if (ratio >= WARNING_RATIO) return 'warning';
    return 'normal';
  }

  estimateTokens(text: string): number {
    if (text.length === 0) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  truncateToFit(text: string, maxTokens: number): string {
    if (maxTokens <= 0) return '';
    if (this.estimateTokens(text) <= maxTokens) return text;
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const marker = '…';
    if (maxChars <= marker.length) return text.slice(0, maxChars);
    return text.slice(0, maxChars - marker.length) + marker;
  }
}
