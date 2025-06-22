# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**doc-organizer** is a universal documentation organization tool with project-type awareness. Currently in JavaScript with plans to convert to TypeScript and publish as an NPM package.

## Development Commands

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript (after conversion)
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

### Running the Tool
```bash
# Current (direct execution)
node doc-organizer.js <command> [options]

# Future (after NPM setup)
npx doc-organize scan
npx doc-organize organize --apply
```

## Architecture & Code Structure

### Current Implementation
- **doc-organizer.js**: Main implementation (~545 lines)
  - Class: `DocumentationOrganizer` - Core logic for scanning and organizing
  - Configuration loading from multiple sources (.json, .js, package.json)
  - Project type detection and pattern matching
  - Confidence-based file organization suggestions

- **doc-organizer-configs.js**: Example configurations for different project types
  - web-app, library, API, data-science, mobile configurations
  - Pattern definitions and destination mappings

### Planned Structure (Phase 1)
```
src/
├── cli/              # CLI entry point and commands
├── core/             # Core organizer logic
├── types/            # TypeScript types
├── configs/          # Built-in configurations
├── utils/            # Helper functions
└── __tests__/        # Test files
```

## Key Concepts

### Project Type Detection
The tool detects project type based on file presence:
- **web-app**: public/index.html or src/App.js
- **library**: Single entry point (index.js/main.js)
- **API**: routes/, api/, or server.js
- **data-science**: notebooks/, data/, requirements.txt
- **mobile**: android/, ios/, or React Native files

### Configuration Priority
1. `.doc-organizer.json` (project-specific)
2. `.doc-organizer.js` (dynamic config)
3. `doc-organizer` key in package.json
4. Built-in defaults by project type

### Protected Files
Never move: README.md, LICENSE, CHANGELOG.md, package.json, lock files

## Development Roadmap

Currently implementing **Phase 1: Core NPM Package**
- Convert to TypeScript
- Set up proper build system
- Implement test suite
- Publish to NPM

Future phases include Claude API integration, VS Code extension, and MCP server.

## Testing Approach

Tests should cover:
- Configuration loading and merging
- Pattern matching logic
- Project type detection
- File organization suggestions
- Protected file handling

Run specific tests:
```bash
npm test -- --testNamePattern="pattern matching"
npm test -- path/to/specific.test.ts
```

## Important Implementation Notes

1. **Confidence Scoring**: Files are categorized as high (>80%), medium (50-80%), or low (<50%) confidence
2. **Variable Substitution**: Supports `{ext}`, `{name}`, `{dir}` in destination paths
3. **Dry Run by Default**: Always preview changes before applying with --apply flag
4. **Project Context**: Tool adapts patterns based on detected project type

## Current Development Focus

1. Initialize git repository
2. Convert doc-organizer.js to TypeScript
3. Set up proper source directory structure
4. Configure TypeScript and ESLint
5. Implement initial test suite
6. Set up CLI binary in package.json
7. Prepare for NPM publication