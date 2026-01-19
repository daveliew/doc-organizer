#!/usr/bin/env node

/**
 * doc-organizer CLI entry point
 *
 * Usage:
 *   doc-organize                    # Analyze and show report
 *   doc-organize --apply            # Apply high-confidence moves
 *   doc-organize --ai               # Use AI for low-confidence files
 *   doc-organize --ai --apply       # Apply moves with AI enhancement
 *   doc-organize mcp                # Start MCP server
 */

const args = process.argv.slice(2);

// MCP server mode
if (args.includes('mcp') || args.includes('--mcp')) {
  require('../dist/mcp-server.js');
} else {
  // Standard doc-organizer mode
  const DocumentationOrganizer = require('../doc-organizer.js');

  // Configuration loader
  const fs = require('fs');
  const path = require('path');

  function loadConfiguration() {
    const configPaths = [
      '.doc-organizer.json',
      'package.json',
      '.doc-organizer.js'
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          if (configPath.endsWith('.js')) {
            delete require.cache[require.resolve(path.resolve(configPath))];
            return require(path.resolve(configPath));
          } else if (configPath === 'package.json') {
            const pkg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (pkg.docOrganizer) {
              return pkg.docOrganizer;
            }
          } else {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
          }
        } catch (error) {
          console.warn(`Warning: Could not load config from ${configPath}: ${error.message}`);
        }
      }
    }

    return {};
  }

  // Help text
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
doc-organize - AI-powered documentation organizer

USAGE:
  doc-organize [options]

OPTIONS:
  --apply       Apply high-confidence file moves
  --ai          Enable AI enhancement for low-confidence files
                (requires ANTHROPIC_API_KEY environment variable)
  --help, -h    Show this help message
  mcp           Start MCP server for Claude Code integration

CONFIGURATION:
  Place a .doc-organizer.json file in your project root, or add a
  "docOrganizer" key to your package.json.

  Example .doc-organizer.json:
  {
    "projectType": "web-app",
    "structure": {
      "aiDocs": "docs/ai",
      "specs": "specs"
    },
    "ai": {
      "enabled": true
    }
  }

EXAMPLES:
  doc-organize                  # Analyze and show report
  doc-organize --apply          # Apply high-confidence moves
  doc-organize --ai             # Use AI for ambiguous files
  doc-organize --ai --apply     # Apply with AI enhancement
  doc-organize mcp              # Start MCP server
`);
    process.exit(0);
  }

  const config = loadConfiguration();
  const organizer = new DocumentationOrganizer(config);
  organizer.run();
}
