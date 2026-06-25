import type { CardGenerator, CardGeneratorInput, EpisodicCard, ProtocolResult } from '../types';
import { PROTOCOL_VERSION, SCHEMA_VERSION } from '../types';
import { ok, err } from '../result';
import { topKeywords } from '../util/text';

/** FNV-1a 32-bit hash → hex, for deterministic card ids. Not cryptographic. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const DECISION_CUES = ['decide', 'decided', 'will ', 'agree', 'plan to', "let's", 'should', 'commit to'];
const TRUNCATE = 280;

function truncate(text: string, max = TRUNCATE): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length <= max ? t : t.slice(0, max - 1) + '…';
}

function extractDecisions(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const low = s.toLowerCase();
    if (DECISION_CUES.some((cue) => low.includes(cue))) out.push(truncate(s, 160));
    if (out.length >= 5) break;
  }
  return out;
}

function extractArtifacts(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) out.add(m[0]);
  if (/```/.test(text)) out.add('code snippet');
  return [...out].slice(0, 10);
}

/**
 * §5.1 — a deterministic, no-LLM reference CardGenerator. It produces correctly-
 * shaped, reasonable-quality cards from heuristics alone (keyword frequency, simple
 * cue detection). It performs NO model call and ships NO generation prompt.
 *
 * The LLM-backed generator and its prompt are deliberately out of this package and
 * ship in a separate, independently-audited contribution — this is the open/closed
 * line the spec (§5.1) draws: the reference shows the shape works; production-grade
 * card quality (personalization, model tuning) is where implementers differentiate.
 */
export class HeuristicCardGenerator implements CardGenerator {
  async generate(input: CardGeneratorInput): Promise<ProtocolResult<EpisodicCard>> {
    const { messages } = input;
    if (messages.length === 0) {
      return err('invalid_input', 'cannot generate a card from zero messages');
    }

    const timestamps = messages.map((m) => m.ts);
    const startTs = Math.min(...timestamps);
    const endTs = Math.max(...timestamps);

    const participants = new Set<string>();
    for (const m of messages) if (m.fromDid) participants.add(m.fromDid);
    if (input.context?.agentDid) participants.add(input.context.agentDid);

    const allText = messages.map((m) => m.content).join('\n');
    const keywords = topKeywords(allText, 8);

    const firstUser = messages.find((m) => m.role === 'user')?.content;
    const topic = truncate(firstUser ?? keywords.join(' ') ?? 'untitled episode', 120);

    const last = messages[messages.length - 1];
    const outcome = last ? truncate(last.content, 200) : '';

    const id = `card-${startTs}-${fnv1a(allText)}`;

    const card: EpisodicCard = {
      schemaVersion: SCHEMA_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      id,
      startTs,
      endTs,
      participants: [...participants],
      channel: input.channel,
      purpose: input.purpose,
      topic,
      decisions: extractDecisions(allText),
      artifacts: extractArtifacts(allText),
      outcome,
      // Heuristic baseline does not infer affect; production generators may.
      emotionalTone: 'neutral',
      keywords,
      chatBriefing: outcome,
      sourceMessageCount: messages.length,
      compressed: true,
      archivePath: `cards/${id}.json`,
    };

    return ok(card);
  }
}
