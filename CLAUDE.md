# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**doc-organizer** is an AI-powered documentation organization tool with project-type awareness. It uses regex patterns for fast classification with Claude API fallback for ambiguous files. Also available as an MCP server for Claude Code integration.

## Development Commands

```bash
npm install           # Install dependencies
npm run build         # Build TypeScript to dist/
npm run dev           # Watch mode for TypeScript
npm test              # Run tests
```

### Running the Tool
```bash
# Standard mode (regex-only)
node doc-organizer.js

# Apply high-confidence moves
node doc-organizer.js --apply

# AI-enhanced mode (uses Claude for low-confidence files)
node doc-organizer.js --ai

# Apply with AI enhancement
node doc-organizer.js --ai --apply

# Start MCP server
node bin/cli.js mcp

# After npm link / publish
doc-organize --help
```

## Architecture

```
doc-organizer-project/
├── doc-organizer.js        # Main JS implementation (hybrid sync/async)
├── doc-organizer-configs.js # Example project type configs
├── bin/cli.js              # CLI entry point
├── src/
│   ├── index.ts            # Package exports
│   ├── types.ts            # TypeScript interfaces
│   ├── ai-classifier.ts    # Claude API integration
│   └── mcp-server.ts       # MCP server (3 tools)
├── dist/                   # Compiled TypeScript
└── tsconfig.json           # TypeScript config
```

### Key Components

**DocumentationOrganizer (doc-organizer.js)**
- Pattern-based file classification (90% confidence for filename match)
- Async AI enhancement for low-confidence files (<80%)
- Configuration merging (user config + defaults)
- Protected files handling

**AIClassifier (src/ai-classifier.ts)**
- Uses `@anthropic-ai/sdk` with Claude Sonnet
- Structured JSON output via tool use
- Lazy initialization (only loads if API key available)
- Merges AI results with regex analysis

**MCP Server (src/mcp-server.ts)**
- `analyze_docs`: Scan and return organization suggestions
- `apply_organization`: Execute file moves
- `health_check`: Return documentation health metrics

## Configuration

`.doc-organizer.json` example:
```json
{
  "projectType": "web-app",
  "structure": {
    "aiDocs": "docs/ai",
    "specs": "specs"
  },
  "ai": {
    "enabled": true,
    "model": "claude-sonnet-4-20250514"
  },
  "thresholds": {
    "autoApply": 0.8,
    "aiFallback": 0.8
  }
}
```

### Thresholds
- `autoApply: 0.8` - 80%+ confidence for auto-apply
- `suggest: 0.7` - 70%+ for suggestions
- `filename: 0.9` - Filename matches get 90%
- `content: 0.5` - Content-only matches get 50%
- `aiFallback: 0.8` - Use AI when below 80%

## MCP Server Setup

Add to `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "doc-organizer": {
      "command": "node",
      "args": ["/path/to/doc-organizer-project/dist/mcp-server.js"]
    }
  }
}
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for AI classification (optional, graceful fallback)

## Testing

```bash
npm test                                    # All tests
npm test -- --testNamePattern="pattern"     # Specific tests
```

## Next Steps

1. **Phase 2**: Add more comprehensive tests
2. **Phase 3**: Publish to NPM as `@daveliew/doc-organizer`
3. **Phase 4**: Full TypeScript conversion of doc-organizer.js
