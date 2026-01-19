#!/usr/bin/env node

/**
 * MCP Server for doc-organizer
 *
 * Exposes documentation organization tools to Claude Code, Cowork, and other MCP clients.
 * Tools:
 * - analyze_docs: Scan and return organization suggestions
 * - apply_organization: Execute file moves
 * - health_check: Return documentation health metrics
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

import { HealthCheckResult, OrganizationSuggestion, ApplyMovesResult } from './types';

// Import the DocumentationOrganizer from the JS file
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DocumentationOrganizer = require('../doc-organizer.js');

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'analyze_docs',
    description: 'Scan documentation files and return organization suggestions. Uses pattern matching and optional AI enhancement to classify misplaced files.',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Root directory to scan. Defaults to current working directory.'
        },
        projectType: {
          type: 'string',
          enum: ['web-app', 'library', 'api', 'data-science', 'mobile'],
          description: 'Project type for context-aware classification. Defaults to web-app.'
        },
        useAI: {
          type: 'boolean',
          description: 'Whether to use Claude AI for low-confidence classifications. Defaults to false.'
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence threshold for suggestions (0-1). Defaults to 0.7.'
        }
      },
      required: []
    }
  },
  {
    name: 'apply_organization',
    description: 'Apply suggested file moves from analyze_docs. Only applies high-confidence moves by default.',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Root directory. Defaults to current working directory.'
        },
        suggestions: {
          type: 'array',
          description: 'Array of move suggestions to apply. If not provided, will run analysis first.',
          items: {
            type: 'object',
            properties: {
              current: { type: 'string' },
              suggested: { type: 'string' }
            },
            required: ['current', 'suggested']
          }
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence to auto-apply (0-1). Defaults to 0.8.'
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only report what would be moved without executing. Defaults to false.'
        }
      },
      required: []
    }
  },
  {
    name: 'health_check',
    description: 'Check documentation health including stale files, orphans, naming violations, and overall organization score.',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Root directory to check. Defaults to current working directory.'
        },
        staleDays: {
          type: 'number',
          description: 'Number of days after which a file is considered stale. Defaults to 90.'
        }
      },
      required: []
    }
  }
];

// Create MCP server
const server = new Server(
  {
    name: 'doc-organizer',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register tool list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_docs':
        return await handleAnalyzeDocs(args);

      case 'apply_organization':
        return await handleApplyOrganization(args);

      case 'health_check':
        return await handleHealthCheck(args);

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true
    };
  }
});

/**
 * Handle analyze_docs tool
 */
async function handleAnalyzeDocs(args: Record<string, unknown> | undefined) {
  const directory = (args?.directory as string) || process.cwd();
  const projectType = (args?.projectType as string) || 'web-app';
  const minConfidence = (args?.minConfidence as number) || 0.7;

  // Change to target directory
  const originalCwd = process.cwd();
  process.chdir(directory);

  try {
    const config = {
      projectType,
      thresholds: {
        suggest: minConfidence
      }
    };

    const organizer = new DocumentationOrganizer(config);
    const stats = organizer.generateSuggestions();
    const suggestions: OrganizationSuggestion[] = organizer.suggestions;

    const result = {
      directory,
      projectType,
      totalFiles: stats.files,
      misplacedFiles: stats.misplaced,
      suggestions: suggestions.map(s => ({
        current: s.current,
        suggested: s.suggested,
        category: s.category,
        confidence: Math.round(s.confidence * 100) + '%',
        reasons: s.reasons
      }))
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Handle apply_organization tool
 */
async function handleApplyOrganization(args: Record<string, unknown> | undefined) {
  const directory = (args?.directory as string) || process.cwd();
  const minConfidence = (args?.minConfidence as number) || 0.8;
  const dryRun = (args?.dryRun as boolean) || false;
  const providedSuggestions = args?.suggestions as Array<{ current: string; suggested: string }> | undefined;

  const originalCwd = process.cwd();
  process.chdir(directory);

  try {
    let suggestions: OrganizationSuggestion[];

    if (providedSuggestions && providedSuggestions.length > 0) {
      // Use provided suggestions
      suggestions = providedSuggestions.map(s => ({
        current: s.current,
        suggested: s.suggested,
        category: 'unknown' as const,
        confidence: 1,
        reasons: ['user-provided']
      }));
    } else {
      // Run analysis first
      const organizer = new DocumentationOrganizer({
        thresholds: { autoApply: minConfidence }
      });
      organizer.generateSuggestions();
      suggestions = organizer.suggestions.filter(
        (s: OrganizationSuggestion) => s.confidence >= minConfidence
      );
    }

    const result: ApplyMovesResult = {
      successful: 0,
      failed: 0,
      moves: []
    };

    for (const suggestion of suggestions) {
      const moveResult = {
        from: suggestion.current,
        to: suggestion.suggested,
        success: false,
        error: undefined as string | undefined
      };

      if (dryRun) {
        moveResult.success = true;
        result.successful++;
      } else {
        try {
          // Ensure destination directory exists
          const destDir = path.dirname(suggestion.suggested);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          // Move the file
          fs.renameSync(suggestion.current, suggestion.suggested);
          moveResult.success = true;
          result.successful++;
        } catch (error) {
          moveResult.success = false;
          moveResult.error = error instanceof Error ? error.message : 'Unknown error';
          result.failed++;
        }
      }

      result.moves.push(moveResult);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...result,
          dryRun,
          directory
        }, null, 2)
      }]
    };
  } finally {
    process.chdir(originalCwd);
  }
}

/**
 * Handle health_check tool
 */
async function handleHealthCheck(args: Record<string, unknown> | undefined) {
  const directory = (args?.directory as string) || process.cwd();
  const staleDays = (args?.staleDays as number) || 90;

  const originalCwd = process.cwd();
  process.chdir(directory);

  try {
    const organizer = new DocumentationOrganizer({});
    const stats = organizer.generateSuggestions();
    const namingViolations = organizer.checkNamingConventions();

    // Find stale files (not modified in staleDays)
    const staleThreshold = Date.now() - staleDays * 24 * 60 * 60 * 1000;
    const allFiles = organizer.getAllMdFiles();
    const staleFiles: string[] = [];
    const orphanedFiles: string[] = [];

    for (const file of allFiles) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs < staleThreshold) {
          staleFiles.push(file);
        }

        // Check for orphaned files (not referenced anywhere)
        const isReferenced = allFiles.some((otherFile: string) => {
          if (otherFile === file) return false;
          try {
            const content = fs.readFileSync(otherFile, 'utf8');
            const basename = path.basename(file);
            return content.includes(basename);
          } catch {
            return false;
          }
        });

        // Files in root that aren't referenced and aren't protected
        const isProtected = ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'CLAUDE.md'].includes(
          path.basename(file)
        );
        const isInRoot = path.dirname(file) === '.';
        if (isInRoot && !isReferenced && !isProtected) {
          orphanedFiles.push(file);
        }
      } catch {
        // Skip files we can't stat
      }
    }

    // Calculate health score (0-100)
    const misplacedPenalty = (stats.misplaced / Math.max(stats.files, 1)) * 30;
    const stalePenalty = (staleFiles.length / Math.max(allFiles.length, 1)) * 20;
    const orphanPenalty = (orphanedFiles.length / Math.max(allFiles.length, 1)) * 20;
    const namingPenalty = (namingViolations.length / Math.max(allFiles.length, 1)) * 30;

    const healthScore = Math.max(0, Math.round(100 - misplacedPenalty - stalePenalty - orphanPenalty - namingPenalty));

    const result: HealthCheckResult = {
      totalFiles: stats.files,
      misplacedFiles: stats.misplaced,
      staleFiles,
      orphanedFiles,
      namingViolations,
      healthScore
    };

    // Add recommendations
    const recommendations: string[] = [];
    if (stats.misplaced > 0) {
      recommendations.push(`Move ${stats.misplaced} misplaced files using apply_organization`);
    }
    if (staleFiles.length > 0) {
      recommendations.push(`Review ${staleFiles.length} stale files (not updated in ${staleDays} days)`);
    }
    if (orphanedFiles.length > 0) {
      recommendations.push(`Check ${orphanedFiles.length} orphaned files (not referenced)`);
    }
    if (namingViolations.length > 0) {
      recommendations.push(`Fix ${namingViolations.length} naming convention violations`);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...result,
          directory,
          staleDays,
          recommendations,
          healthGrade: healthScore >= 90 ? 'A' : healthScore >= 80 ? 'B' : healthScore >= 70 ? 'C' : healthScore >= 60 ? 'D' : 'F'
        }, null, 2)
      }]
    };
  } finally {
    process.chdir(originalCwd);
  }
}

// Main entry point
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('doc-organizer MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
