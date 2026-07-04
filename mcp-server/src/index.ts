import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadState } from './state.js';
import { registerTools } from './tools.js';

/**
 * MA-1 MCP server entry. Exposes capture / recall / assemble / list tools over
 * stdio so any MCP-compatible agent host (Claude Desktop, Cursor, etc.) can give
 * an agent an MA-1 memory.
 *
 * Config (env):
 *   MA1_DATA_DIR   — where cards are persisted (default: ~/.ma1/data)
 *   MA1_AGENT_DID  — stable identity for assembled context (default: did:example:agent)
 *   MA1_AGENT_NAME — display name (default: "MA-1 Agent")
 *   MA1_CONTEXT_WINDOW — context window size in tokens (default: 32000)
 */
async function main(): Promise<void> {
  const dataDir = process.env.MA1_DATA_DIR ?? defaultDataDir();
  const agentDid = process.env.MA1_AGENT_DID ?? 'did:example:agent';
  const agentName = process.env.MA1_AGENT_NAME ?? 'MA-1 Agent';
  const contextWindowSize = process.env.MA1_CONTEXT_WINDOW
    ? Number(process.env.MA1_CONTEXT_WINDOW)
    : undefined;

  const state = await loadState({ dataDir, agentDid, contextWindowSize });

  const server = new McpServer({
    name: '@mirror-abyss/ma1-mcp',
    version: '0.1.0',
  });

  registerTools(server, state, { agentDid, agentName });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function defaultDataDir(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  return `${home}/.ma1/data`;
}

main().catch((err) => {
  console.error('ma1-mcp failed to start:', err);
  process.exit(1);
});
