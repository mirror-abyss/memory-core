# @mirror-abyss/ma1-mcp

An MCP (Model Context Protocol) server that exposes [Mirror Abyss MA-1](https://github.com/mirror-abyss/memory-core) memory operations to any MCP-compatible agent host — Claude Desktop, Cursor, or any client that speaks MCP over stdio.

Give an agent a memory that survives the session: capture interactions into episodic cards, recall them by keyword, and assemble them back into the next model call's context.

## Tools

| Tool | What it does |
|---|---|
| `ma1_remember` | Compress a conversation into an episodic card and persist it to disk. |
| `ma1_recall` | Recall cards whose keywords overlap the query; returns a formatted block. |
| `ma1_assemble` | Assemble the layered MA-1 context (time anchor + recent memory) into a system prompt for the next model call. |
| `ma1_list_cards` | List the most recently captured cards. |

The card generator is the deterministic, no-LLM reference baseline (`HeuristicCardGenerator`). Production-grade card quality — personalization, model tuning — comes from swapping in your own `CardGenerator`; see the [extension guide](../docs/extending-ma1.md). The interface is open; the quality is where you build your moat.

## Install

```bash
npm install @mirror-abyss/ma1-mcp
```

## Run

```bash
# Configure (all optional, these are the defaults):
#   MA1_DATA_DIR       — where cards persist (default: ~/.ma1/data)
#   MA1_AGENT_DID      — stable agent identity (default: did:example:agent)
#   MA1_AGENT_NAME     — display name (default: "MA-1 Agent")
#   MA1_CONTEXT_WINDOW — context window size in tokens (default: 32000)

node dist/index.js
# or, after a global install:
ma1-mcp
```

## Wire into a host

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "ma1": {
      "command": "npx",
      "args": ["-y", "@mirror-abyss/ma1-mcp"],
      "env": {
        "MA1_AGENT_DID": "did:example:my-agent",
        "MA1_DATA_DIR": "/Users/me/.ma1/data"
      }
    }
  }
}
```

### Cursor

Add to your MCP configuration (e.g. `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "ma1": {
      "command": "npx",
      "args": ["-y", "@mirror-abyss/ma1-mcp"],
      "env": {
        "MA1_AGENT_DID": "did:example:my-agent"
      }
    }
  }
}
```

Once connected, the host model can call `ma1_remember`, `ma1_recall`, `ma1_assemble`, and `ma1_list_cards` like any other tool.

## Status

Draft `0.1.0`, tracking MA-1 spec `protocolVersion` `0.2.0`. Interfaces follow the MA-1 freeze (see the [spec](../spec/MA-1.md) §8.1). Built on the [`@modelcontextprotocol/sdk` v1](https://github.com/modelcontextprotocol/typescript-sdk) stable line.

## License

Apache-2.0.
