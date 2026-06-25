import type { CardIndex, CardSearchOptions, EpisodicCard } from '../types';

/**
 * §5.2 — an in-memory keyword-inverted-index CardIndex with scored ranking.
 *
 * The index is synchronous (per the frozen CardIndex interface). Persistence is
 * handled separately via JSONL (`toJsonl` / `fromJsonl`) so a host can hydrate from,
 * and flush to, any StorageBackend without coupling the index to I/O.
 */
export class KeywordCardIndex implements CardIndex {
  private readonly cards = new Map<string, EpisodicCard>();
  /** keyword (lower-case) → set of card ids */
  private readonly inverted = new Map<string, Set<string>>();

  append(card: EpisodicCard): void {
    this.cards.set(card.id, card);
    for (const kw of this.keywordsOf(card)) {
      let set = this.inverted.get(kw);
      if (!set) {
        set = new Set<string>();
        this.inverted.set(kw, set);
      }
      set.add(card.id);
    }
  }

  loadAll(): EpisodicCard[] {
    return [...this.cards.values()];
  }

  loadRecent(n = 10): EpisodicCard[] {
    return this.loadAll()
      .sort((a, b) => b.endTs - a.endTs)
      .slice(0, Math.max(0, n));
  }

  search(opts: CardSearchOptions): EpisodicCard[] {
    const maxResults = opts.maxResults ?? 20;
    const queryKeywords = (opts.keywords ?? []).map((k) => k.toLowerCase());

    const scored: Array<{ card: EpisodicCard; score: number }> = [];
    for (const card of this.cards.values()) {
      if (opts.participant && !card.participants.includes(opts.participant)) continue;
      if (opts.channel && card.channel !== opts.channel) continue;
      if (opts.timeRange) {
        if (card.endTs < opts.timeRange.startTs || card.startTs > opts.timeRange.endTs) continue;
      }

      let score = 0;
      if (queryKeywords.length > 0) {
        const cardKw = this.keywordsOf(card);
        for (const qk of queryKeywords) {
          if (cardKw.has(qk)) score += 1;
        }
        if (score === 0) continue; // keyword query with no overlap → not a match
      }
      scored.push({ card, score });
    }

    scored.sort((a, b) => b.score - a.score || b.card.endTs - a.card.endTs);
    return scored.slice(0, maxResults).map((s) => s.card);
  }

  getById(id: string): EpisodicCard | null {
    return this.cards.get(id) ?? null;
  }

  count(): number {
    return this.cards.size;
  }

  /** Serialize all cards as JSONL (one card per line). */
  toJsonl(): string {
    return this.loadAll()
      .map((c) => JSON.stringify(c))
      .join('\n');
  }

  /** Build an index from JSONL text (ignores blank lines). */
  static fromJsonl(text: string): KeywordCardIndex {
    const index = new KeywordCardIndex();
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      index.append(JSON.parse(trimmed) as EpisodicCard);
    }
    return index;
  }

  private keywordsOf(card: EpisodicCard): Set<string> {
    const set = new Set<string>();
    for (const kw of card.keywords) set.add(kw.toLowerCase());
    for (const tok of card.topic.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (tok.length >= 3) set.add(tok);
    }
    return set;
  }
}
