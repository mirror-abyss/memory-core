import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  type EpisodicCard,
} from '@mirror-abyss/memory-core';
import { persistIndex, summarizeCard, type Ma1State } from './state.js';

const messageShape = {
  role: z.string().describe('Speaker role, e.g. "user" or "assistant".'),
  content: z.string().describe('The message text.'),
  ts: z.number().optional().describe('Unix ms timestamp; defaults to now.'),
};

const PURPOSES = ['conversation', 'task', 'exploration', 'proactive_thinking', 'auto_execute'] as const;
const CHANNELS = ['web', 'discord', 'telegram', 'a2a'] as const;

export interface RegisterToolsOptions {
  agentDid: string;
  agentName: string;
}

export function registerTools(
  server: McpServer,
  state: Ma1State,
  opts: RegisterToolsOptions,
): void {
  server.registerTool(
    'ma1_remember',
    {
      title: 'Remember an interaction',
      description:
        'Compress a conversation into an episodic card and persist it to the MA-1 memory store. The card is indexed by keyword and survives process restarts.',
      inputSchema: {
        messages: z
          .array(z.object(messageShape))
          .min(1)
          .describe('The conversation turns to compress into a memory card.'),
        channel: z.enum(CHANNELS).optional().describe('Channel hint. Defaults to "web".'),
        purpose: z.enum(PURPOSES).optional().describe('Interaction purpose. Defaults to "conversation".'),
      },
    },
    async (args) => {
      const messages = args.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ts: m.ts ?? Date.now(),
      }));
      const result = await state.generator.generate({
        channel: args.channel ?? 'web',
        purpose: args.purpose ?? 'conversation',
        context: { agentDid: opts.agentDid, agentName: opts.agentName },
        messages,
      });
      if (!result.ok) {
        return { content: [{ type: 'text' as const, text: `Card generation failed: ${result.error.message}` }], isError: true };
      }
      state.index.append(result.value);
      await persistIndex(state);
      return {
        content: [{ type: 'text' as const, text: `Remembered.\n${summarizeCard(result.value)}` }],
      };
    },
  );

  server.registerTool(
    'ma1_recall',
    {
      title: 'Recall relevant memories',
      description:
        'Recall episodic cards whose keywords overlap the query. Returns a formatted block of the most relevant cards, ready to drop into a model call.',
      inputSchema: {
        keywords: z.array(z.string()).min(1).describe('Keywords to match against card keywords.'),
        maxResults: z.number().int().positive().max(50).optional().describe('Max cards to return. Defaults to the engine default.'),
      },
    },
    async (args) => {
      const result = await state.recall.recall({
        keywords: args.keywords,
        maxResults: args.maxResults,
      });
      const text =
        result.cards.length === 0
          ? 'No matching cards recalled.'
          : `Recalled ${result.cards.length} card(s) (~${result.totalTokens} tokens):\n\n${result.formatted}`;
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.registerTool(
    'ma1_assemble',
    {
      title: 'Assemble context for the next model call',
      description:
        'Assemble the layered MA-1 context (time anchor + recent episodic memory) into a system prompt for the next model call. Use this right before calling the model.',
      inputSchema: {
        purpose: z.enum(PURPOSES).optional().describe('Interaction purpose. Defaults to "conversation".'),
        operationalContext: z
          .string()
          .optional()
          .describe('Operational context text (e.g. current task brief). Defaults to empty.'),
        conversationHistory: z
          .array(z.object(messageShape))
          .optional()
          .describe('Recent conversation history for token-pressure calculation.'),
        maxOutputTokens: z.number().int().nonnegative().optional().describe('Reserved output tokens.'),
      },
    },
    async (args) => {
      const assembled = await state.assembler.assemble({
        purpose: args.purpose ?? 'conversation',
        operationalContext: args.operationalContext ?? '',
        conversationHistory: (args.conversationHistory ?? []).map((m) => ({
          role: m.role,
          content: m.content,
          ts: m.ts ?? Date.now(),
        })),
        maxOutputTokens: args.maxOutputTokens,
      });
      return { content: [{ type: 'text' as const, text: assembled.systemPrompt }] };
    },
  );

  server.registerTool(
    'ma1_list_cards',
    {
      title: 'List recent memory cards',
      description: 'List the most recently captured episodic cards in the store.',
      inputSchema: {
        limit: z.number().int().positive().max(100).optional().describe('How many recent cards to list. Defaults to 10.'),
      },
    },
    async (args) => {
      const cards: EpisodicCard[] = state.index.loadRecent(args.limit ?? 10);
      if (cards.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No cards stored yet.' }] };
      }
      const text = cards.map(summarizeCard).join('\n\n');
      return { content: [{ type: 'text' as const, text: `${cards.length} card(s):\n\n${text}` }] };
    },
  );
}
