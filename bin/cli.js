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

// MCP server mode
if (args.includes('mcp') || args.includes('--mcp')) {
  require('../dist/mcp-server.js');
  process.exit(0);
}

// Standard doc-organizer mode
const { DocumentationOrganizer, loadConfiguration } = require('../dist/organizer.js');

const shouldApply = args.includes('--apply');
const useAI = args.includes('--ai');

async function run() {
  const userConfig = loadConfiguration();
  if (useAI) {
    userConfig.ai = { ...userConfig.ai, enabled: true };
    userConfig.useAI = true;
  }

  const organizer = new DocumentationOrganizer(userConfig);

  console.log(`🔍 Analyzing markdown files for ${organizer.config.projectType} project organization...`);
  if (useAI) {
    console.log('🤖 AI enhancement enabled (Claude Sonnet)\n');
  } else {
    console.log('📋 Using pattern-based classification\n');
  }

  // Generate suggestions
  const stats = useAI
    ? await organizer.generateSuggestionsWithAI()
    : organizer.generateSuggestions();

  const namingViolations = organizer.checkNamingConventions();

  // Report
  console.log('📋 DOCUMENTATION ORGANIZATION REPORT');
  console.log(`Project Type: ${organizer.config.projectType.toUpperCase()}`);
  console.log('===================================\n');

  console.log('📊 SUMMARY:');
  console.log(`   Total files analyzed: ${stats.files}`);
  console.log(`   Files needing relocation: ${stats.misplaced}`);
  console.log(`   Protected files: ${organizer.config.protectedFiles.length}`);
  console.log(`   Naming violations: ${namingViolations.length}`);
  console.log(`   Errors encountered: ${organizer.errors.length}`);
  if (useAI) {
    const aiEnhanced = organizer.suggestions.filter(s => s.aiEnhanced).length;
    console.log(`   AI-enhanced classifications: ${aiEnhanced}`);
  }
  console.log();

  console.log('⚙️  CONFIGURATION:');
  console.log(`   AI Docs Directory: ${organizer.config.structure.aiDocs}/`);
  console.log(`   Specs Directory: ${organizer.config.structure.specs}/`);
  console.log(`   Auto-apply threshold: ${(organizer.config.thresholds.autoApply * 100).toFixed(0)}%`);
  console.log(`   Suggestion threshold: ${(organizer.config.thresholds.suggest * 100).toFixed(0)}%`);
  console.log(`   AI Enhancement: ${useAI ? 'Enabled' : 'Disabled'}`);
  console.log();

  // Suggestions
  if (organizer.suggestions.length > 0) {
    console.log('📁 SUGGESTED RELOCATIONS:');
    organizer.suggestions.forEach((suggestion, index) => {
      const aiIndicator = suggestion.aiEnhanced ? ' 🤖' : '';
      console.log(`\n${index + 1}. ${suggestion.current}${aiIndicator}`);
      console.log(`   → ${suggestion.suggested}`);
      console.log(`   Category: ${suggestion.category}`);
      console.log(`   Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
      console.log(`   Reason: ${suggestion.reasons.join(', ')}`);
    });
    console.log();
  } else {
    console.log('✅ **No files need relocation - organization looks good!**\n');
  }

  // Protected files
  console.log('🛡️  PROTECTED FILES:');
  organizer.config.protectedFiles.forEach(file => {
    console.log(`   ✅ ${file}`);
  });
  console.log();

  // Naming violations
  if (namingViolations.length > 0) {
    console.log('📝 NAMING CONVENTION VIOLATIONS:');
    namingViolations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.file}`);
      violation.issues.forEach(issue => {
        console.log(`   ⚠️  ${issue}`);
      });
    });
    console.log();
  }

  // Errors
  if (organizer.errors.length > 0) {
    console.log('❌ ERRORS:');
    organizer.errors.forEach(error => {
      console.log(`   ${error}`);
    });
    console.log();
  }

  // Apply moves if requested
  if (shouldApply) {
    const highConfidence = organizer.getHighConfidenceSuggestions();
    if (highConfidence.length === 0) {
      console.log('No high-confidence moves to apply automatically.\n');
    } else {
      console.log(`\n🤖 Applying ${highConfidence.length} high-confidence moves...\n`);
      const result = organizer.applyMoves();
      console.log(`✅ Successful: ${result.successful}`);
      console.log(`❌ Failed: ${result.failed}`);
      console.log(`\n🎉 Applied ${result.successful} moves successfully!`);
    }
  } else if (organizer.suggestions.length > 0) {
    // Show what would be applied
    const highConfidence = organizer.getHighConfidenceSuggestions();
    if (highConfidence.length > 0) {
      console.log('\n🔄 AUTOMATED ORGANIZATION MODE');
      console.log('==============================\n');
      console.log('The following moves will be applied with --apply:');
      console.log(`(Only high-confidence suggestions with ≥${(organizer.config.thresholds.autoApply * 100).toFixed(0)}% certainty)\n`);
      highConfidence.forEach((move, index) => {
        const aiIndicator = move.aiEnhanced ? ' 🤖' : '';
        console.log(`${index + 1}. ${move.current} → ${move.suggested}${aiIndicator}`);
      });
      console.log('\n⚠️  Run with --apply flag to execute these moves');
      console.log('⚠️  Make sure to commit current changes first!');
      if (!useAI) {
        console.log('\n💡 Tip: Add --ai flag for AI-enhanced classification');
      }
    }
  }
}

run().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
