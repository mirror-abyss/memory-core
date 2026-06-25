import type {
  AssemblyContext,
  CardIndex,
  ContextProvider,
  EpisodicCard,
  StorageBackend,
} from '../types';

/** Format a single card into a compact one-block summary for context injection. */
export function formatCard(card: EpisodicCard): string {
  const when = new Date(card.startTs).toISOString();
  const lines = [`[${when}] ${card.topic} (${card.purpose}/${card.channel})`];
  if (card.decisions.length > 0) lines.push(`  decisions: ${card.decisions.join('; ')}`);
  if (card.outcome) lines.push(`  outcome: ${card.outcome}`);
  if (card.keywords.length > 0) lines.push(`  keywords: ${card.keywords.join(', ')}`);
  return lines.join('\n');
}

/**
 * §4.1 — injects absolute time (ISO 8601 + weekday + offset). Always renders; this
 * is the one anchor every interaction needs regardless of purpose.
 */
export class TimeAnchorProvider implements ContextProvider {
  readonly providerId = 'time-anchor';
  readonly priority = 0;
  readonly layer = 'L0' as const;

  constructor(private readonly now: () => Date = () => new Date()) {}

  shouldRender(): boolean {
    return true;
  }

  async render(): Promise<string | null> {
    const d = this.now();
    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `Current time: ${d.toISOString()} (${weekday})`;
  }
}

/**
 * §4.1 — injects the most-recent N episodic cards from a CardIndex. Renders nothing
 * when the index is empty.
 */
export class EpisodicProvider implements ContextProvider {
  readonly providerId = 'episodic';
  readonly priority = 20;
  readonly layer = 'L2' as const;

  constructor(
    private readonly index: CardIndex,
    private readonly recentCardCount = 5,
  ) {}

  shouldRender(): boolean {
    return this.index.count() > 0;
  }

  async render(_ctx: AssemblyContext): Promise<string | null> {
    const cards = this.index.loadRecent(this.recentCardCount);
    if (cards.length === 0) return null;
    return cards.map(formatCard).join('\n\n');
  }
}

/**
 * §4.1 — injects a prior-session handoff summary read from a configured storage key.
 * Returns null when no handoff has been written.
 */
export class SessionHandoffProvider implements ContextProvider {
  readonly providerId = 'session-handoff';
  readonly priority = 10;
  readonly layer = 'L1' as const;

  constructor(
    private readonly storage: StorageBackend,
    private readonly handoffKey: string,
  ) {}

  shouldRender(): boolean {
    return true;
  }

  async render(): Promise<string | null> {
    const content = await this.storage.read(this.handoffKey);
    if (!content || content.trim().length === 0) return null;
    return content.trim();
  }
}

/**
 * §4.1 / §7.1 — a placeholder for environment state. The reference implementation
 * MUST NOT inspect processes or invoke a shell, so this provider contributes nothing.
 * Hosts that need environment context supply their own provider.
 */
export class PhysicalEnvProvider implements ContextProvider {
  readonly providerId = 'physical-env';
  readonly priority = 30;
  readonly layer = 'L3' as const;

  shouldRender(): boolean {
    return false;
  }

  async render(): Promise<string | null> {
    return null;
  }
}
