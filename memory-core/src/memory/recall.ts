import type {
  CardIndex,
  CardSearchOptions,
  EpisodicCard,
  RecallEngine,
  RecallQuery,
  RecallResult,
  RecallStrategy,
} from '../types';
import { formatCard } from '../context/providers';
import { DefaultTokenBudgetManager } from '../context/token-budget';

/**
 * §5.3 — the reference keyword recall strategy. Delegates to the index's scored
 * keyword search. `vector` and `hybrid` strategies are optional advanced capabilities
 * not shipped here.
 */
export class KeywordRecallStrategy implements RecallStrategy {
  readonly type = 'keyword' as const;

  search(index: CardIndex, query: RecallQuery): EpisodicCard[] {
    const opts: CardSearchOptions = {
      keywords: query.keywords,
      participant: query.participant,
      timeRange: query.timeRange,
      maxResults: query.maxResults,
    };
    return index.search(opts);
  }
}

/**
 * §5.3 — recall engine: runs a strategy against the index, formats the result, and
 * trims to the query's token budget when one is given.
 */
export class DefaultRecallEngine implements RecallEngine {
  private readonly estimate: (text: string) => number;

  constructor(
    private readonly index: CardIndex,
    private readonly strategy: RecallStrategy = new KeywordRecallStrategy(),
    tokenEstimator?: (text: string) => number,
  ) {
    const budget = new DefaultTokenBudgetManager();
    this.estimate = tokenEstimator ?? ((t: string) => budget.estimateTokens(t));
  }

  async recall(query: RecallQuery): Promise<RecallResult> {
    let cards = this.strategy.search(this.index, query);

    if (query.maxTokens !== undefined) {
      cards = this.trimToTokens(cards, query.maxTokens);
    }

    const formatted = cards.map(formatCard).join('\n\n');
    return { cards, formatted, totalTokens: this.estimate(formatted) };
  }

  private trimToTokens(cards: EpisodicCard[], maxTokens: number): EpisodicCard[] {
    const kept: EpisodicCard[] = [];
    let running = 0;
    for (const card of cards) {
      const cost = this.estimate(formatCard(card));
      if (running + cost > maxTokens) break;
      kept.push(card);
      running += cost;
    }
    return kept;
  }
}
