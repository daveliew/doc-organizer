/**
 * DocumentationOrganizer - Core documentation organization logic
 *
 * Analyzes and organizes markdown documentation files based on
 * configurable patterns and project type awareness.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectType,
  DocumentCategory,
  DocOrganizerConfig,
  FileAnalysis,
  OrganizationSuggestion,
  AIConfig
} from './types';
import { AIClassifier } from './ai-classifier';

// Partial config for user input
export interface UserConfig {
  projectType?: ProjectType;
  structure?: Partial<DocOrganizerConfig['structure']>;
  patterns?: Record<string, RegExp | string>;
  destinations?: Record<string, string>;
  protectedFiles?: string[];
  thresholds?: Partial<DocOrganizerConfig['thresholds']>;
  ai?: Partial<AIConfig>;
  excludePatterns?: string[];
  useAI?: boolean;
}

// Stats returned from analysis
export interface AnalysisStats {
  files: number;
  misplaced: number;
}

// Naming violation
export interface NamingViolation {
  file: string;
  issues: string[];
}

export class DocumentationOrganizer {
  public config: DocOrganizerConfig;
  public suggestions: OrganizationSuggestion[] = [];
  public moves: OrganizationSuggestion[] = [];
  public errors: string[] = [];
  private aiClassifier: AIClassifier | null = null;

  constructor(userConfig: UserConfig = {}) {
    this.config = this.mergeWithDefaults(userConfig);
    if (userConfig.useAI || this.config.ai?.enabled) {
      this.aiClassifier = new AIClassifier(this.config.ai);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): DocOrganizerConfig {
    return {
      projectType: 'web-app',

      structure: {
        aiDocs: 'ai_docs',
        specs: 'specs',
        root: './'
      },

      patterns: {
        aiInstructions: /^(CLAUDE|CURSOR|ai-|assistant-|development-guidelines|coding-standards)/i,
        architecture: /^(architecture|system-design|api-spec|tech-stack|design-doc)/i,
        features: /^(feature-|prd-|spec-|functionality-|user-story)/i,
        maintenance: /^(refactor|troubleshoot|deploy|maintenance|operation|.*audit|.*testing.*guide|mobile.*testing|cleanup.*summary|.*organization.*rules|markdown.*organization|devops|ops-)/i,
        setup: /^(setup|getting-started|project-overview|configuration|install|onboard|quickstart)/i,
        guides: /^(.*guide|tutorial|demo.*guide|how-to|walkthrough)/i,
        audits: /^(.*audit|.*report|analysis|review)/i,
        specs: /^(spec|requirement|collapsible|sidebar.*spec|rfc)/i,
        api: /^(api-|endpoint|swagger|openapi)/i,
        testing: /^(test-|testing|qa|quality)/i
      },

      destinations: {
        aiInstructions: '{aiDocs}/setup/',
        architecture: '{aiDocs}/architecture/',
        features: '{aiDocs}/features/',
        maintenance: '{aiDocs}/maintenance/',
        setup: '{aiDocs}/setup/',
        guides: '{root}',
        audits: '{root}',
        specs: '{specs}/',
        api: '{aiDocs}/architecture/',
        testing: '{aiDocs}/maintenance/'
      },

      protectedFiles: [
        'README.md',
        'CHANGELOG.md',
        'LICENSE.md',
        'CONTRIBUTING.md',
        'CODE_OF_CONDUCT.md'
      ],

      thresholds: {
        autoApply: 0.8,
        suggest: 0.7,
        filename: 0.9,
        content: 0.5,
        aiConfidence: 0.7
      },

      excludePatterns: ['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv'],

      ai: {
        enabled: false,
        model: 'claude-sonnet-4-20250514',
        fallbackThreshold: 0.8,
        maxTokens: 500
      }
    };
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(userConfig: UserConfig): DocOrganizerConfig {
    const defaults = this.getDefaultConfig();

    const merged: DocOrganizerConfig = {
      ...defaults,
      projectType: userConfig.projectType || defaults.projectType,
      structure: { ...defaults.structure, ...(userConfig.structure || {}) },
      patterns: { ...defaults.patterns },
      destinations: { ...defaults.destinations, ...(userConfig.destinations || {}) },
      thresholds: { ...defaults.thresholds, ...(userConfig.thresholds || {}) },
      ai: { ...defaults.ai, ...(userConfig.ai || {}) },
      protectedFiles: [...defaults.protectedFiles, ...(userConfig.protectedFiles || [])],
      excludePatterns: userConfig.excludePatterns || defaults.excludePatterns
    };

    // Convert string patterns to RegExp
    if (userConfig.patterns) {
      for (const [key, pattern] of Object.entries(userConfig.patterns)) {
        if (typeof pattern === 'string') {
          merged.patterns[key] = new RegExp(pattern, 'i');
        } else {
          merged.patterns[key] = pattern;
        }
      }
    }

    return merged;
  }

  /**
   * Resolve destination path with variable substitution
   */
  resolveDestination(destination: string): string {
    return destination
      .replace('{aiDocs}', this.config.structure.aiDocs)
      .replace('{specs}', this.config.structure.specs)
      .replace('{root}', this.config.structure.root);
  }

  /**
   * Adjust configuration based on project type
   */
  adjustForProjectType(): void {
    switch (this.config.projectType) {
      case 'library':
        this.config.protectedFiles.push('API.md', 'USAGE.md');
        this.config.patterns.api = /^(api|usage|reference)/i;
        break;
      case 'data-science':
        this.config.protectedFiles.push('METHODOLOGY.md', 'DATA.md');
        this.config.patterns.analysis = /^(analysis|model|dataset|experiment)/i;
        this.config.destinations.analysis = '{aiDocs}/analysis/';
        break;
      case 'mobile':
        this.config.protectedFiles.push('DEPLOYMENT.md', 'STORE.md');
        this.config.patterns.deployment = /^(deploy|store|release|build)/i;
        break;
      case 'api':
        this.config.protectedFiles.push('ENDPOINTS.md', 'SCHEMAS.md');
        this.config.patterns.endpoints = /^(endpoint|route|schema|model)/i;
        break;
    }
  }

  /**
   * Get all markdown files recursively
   */
  getAllMdFiles(): string[] {
    const files: string[] = [];

    const walkDir = (dir: string): void => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);

          // Skip excluded directories
          if (this.config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            continue;
          }

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (path.extname(item) === '.md') {
            files.push(fullPath);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.errors.push(`Error reading directory ${dir}: ${message}`);
      }
    };

    walkDir('.');
    return files;
  }

  /**
   * Analyze a file to determine its appropriate location
   */
  analyzeFileContent(filePath: string): FileAnalysis | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath, '.md');
      const currentDir = path.dirname(filePath);

      // Skip protected files
      if (
        this.config.protectedFiles.includes(filePath) ||
        this.config.protectedFiles.includes(path.basename(filePath))
      ) {
        return null;
      }

      const analysis: FileAnalysis = {
        fileName,
        currentPath: filePath,
        currentDir,
        contentLength: content.length,
        suggestedCategory: null,
        suggestedPath: null,
        confidence: 0,
        reasons: []
      };

      // Check filename patterns first (high confidence)
      for (const [category, pattern] of Object.entries(this.config.patterns)) {
        if (pattern.test(fileName)) {
          analysis.suggestedCategory = category as DocumentCategory;
          analysis.confidence = this.config.thresholds.filename;
          const destination = this.resolveDestination(
            this.config.destinations[category] || '{root}'
          );
          analysis.suggestedPath = destination + fileName + '.md';
          analysis.reasons = ['filename match'];
          break;
        }
      }

      // Check content if no filename match (lower confidence)
      if (!analysis.suggestedCategory) {
        const contentHeader = content.substring(0, 200);
        for (const [category, pattern] of Object.entries(this.config.patterns)) {
          if (pattern.test(contentHeader) && category !== 'aiInstructions') {
            analysis.suggestedCategory = category as DocumentCategory;
            analysis.confidence = this.config.thresholds.content;
            const destination = this.resolveDestination(
              this.config.destinations[category] || '{root}'
            );
            analysis.suggestedPath = destination + fileName + '.md';
            analysis.reasons = ['content match'];
            break;
          }
        }
      }

      return analysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.errors.push(`Error analyzing ${filePath}: ${message}`);
      return null;
    }
  }

  /**
   * Analyze file with AI enhancement for low-confidence results
   */
  async analyzeFileContentWithAI(filePath: string): Promise<FileAnalysis | null> {
    const analysis = this.analyzeFileContent(filePath);
    if (!analysis) return null;

    // Check if we should use AI
    const shouldUseAI =
      this.config.ai.enabled &&
      this.aiClassifier &&
      this.aiClassifier.isAvailable() &&
      analysis.confidence < this.config.ai.fallbackThreshold;

    if (!shouldUseAI) {
      return analysis;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const contentPreview = content.substring(0, 2000);

      const aiResult = await this.aiClassifier!.classify({
        filePath,
        fileName: analysis.fileName,
        contentPreview,
        availableCategories: Object.keys(this.config.patterns) as DocumentCategory[],
        existingAnalysis: {
          category: analysis.suggestedCategory,
          confidence: analysis.confidence,
          reasons: analysis.reasons
        }
      });

      if (aiResult) {
        const merged = this.aiClassifier!.mergeAnalysis(
          {
            category: analysis.suggestedCategory,
            confidence: analysis.confidence,
            reasons: analysis.reasons
          },
          aiResult
        );

        analysis.suggestedCategory = merged.category;
        analysis.confidence = merged.confidence;
        analysis.reasons = merged.reasons;
        analysis.aiEnhanced = true;

        if (merged.category && this.config.destinations[merged.category]) {
          const destination = this.resolveDestination(this.config.destinations[merged.category]);
          analysis.suggestedPath = destination + analysis.fileName + '.md';
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      analysis.reasons.push(`AI enhancement failed: ${message}`);
    }

    return analysis;
  }

  /**
   * Check if a file is correctly placed
   */
  isCorrectlyPlaced(analysis: FileAnalysis): boolean {
    if (!analysis || !analysis.suggestedCategory) return true;

    const expectedDir = this.resolveDestination(
      this.config.destinations[analysis.suggestedCategory] || '{root}'
    );

    let normalizedCurrent = analysis.currentDir.replace(/^\.\//, '');
    let normalizedExpected = expectedDir.replace(/^\.\//, '');

    if (normalizedCurrent === '') normalizedCurrent = '.';
    if (normalizedExpected === '') normalizedExpected = '.';

    if (normalizedCurrent !== '.' && !normalizedCurrent.endsWith('/')) {
      normalizedCurrent += '/';
    }
    if (normalizedExpected !== '.' && !normalizedExpected.endsWith('/')) {
      normalizedExpected += '/';
    }

    if (
      (normalizedCurrent === '.' && normalizedExpected === './') ||
      (normalizedCurrent === './' && normalizedExpected === '.')
    ) {
      return true;
    }

    return normalizedCurrent === normalizedExpected;
  }

  /**
   * Generate organization suggestions (sync)
   */
  generateSuggestions(): AnalysisStats {
    this.adjustForProjectType();
    const files = this.getAllMdFiles();
    const misplacedFiles: FileAnalysis[] = [];

    for (const file of files) {
      const analysis = this.analyzeFileContent(file);
      if (!analysis) continue;

      if (!this.isCorrectlyPlaced(analysis) && analysis.confidence >= this.config.thresholds.suggest) {
        misplacedFiles.push(analysis);
        this.suggestions.push({
          current: analysis.currentPath,
          suggested: analysis.suggestedPath!,
          category: analysis.suggestedCategory!,
          confidence: analysis.confidence,
          reasons: analysis.reasons
        });
      }
    }

    return { files: files.length, misplaced: misplacedFiles.length };
  }

  /**
   * Generate organization suggestions with AI (async)
   */
  async generateSuggestionsWithAI(): Promise<AnalysisStats> {
    this.adjustForProjectType();
    const files = this.getAllMdFiles();
    const misplacedFiles: FileAnalysis[] = [];

    for (const file of files) {
      const analysis = this.config.ai.enabled
        ? await this.analyzeFileContentWithAI(file)
        : this.analyzeFileContent(file);

      if (!analysis) continue;

      if (!this.isCorrectlyPlaced(analysis) && analysis.confidence >= this.config.thresholds.suggest) {
        misplacedFiles.push(analysis);
        this.suggestions.push({
          current: analysis.currentPath,
          suggested: analysis.suggestedPath!,
          category: analysis.suggestedCategory!,
          confidence: analysis.confidence,
          reasons: analysis.reasons,
          aiEnhanced: analysis.aiEnhanced
        });
      }
    }

    return { files: files.length, misplaced: misplacedFiles.length };
  }

  /**
   * Check for naming convention violations
   */
  checkNamingConventions(): NamingViolation[] {
    const files = this.getAllMdFiles();
    const violations: NamingViolation[] = [];

    for (const file of files) {
      const fileName = path.basename(file, '.md');
      const issues: string[] = [];

      const vaguePatterns = [/^doc$/, /^file$/, /^guide$/];
      if (vaguePatterns.some(pattern => pattern.test(fileName))) {
        issues.push('Vague naming - be more specific');
      }

      const dir = path.dirname(file);
      if (
        dir.includes(`${this.config.structure.aiDocs}/features`) &&
        !fileName.includes('-') &&
        fileName !== 'README' &&
        fileName.length > 3
      ) {
        issues.push('Feature files should use kebab-case with descriptive names');
      }

      if (issues.length > 0) {
        violations.push({ file, issues });
      }
    }

    return violations;
  }

  /**
   * Apply high-confidence moves
   */
  applyMoves(): { successful: number; failed: number } {
    const autoMoves = this.suggestions.filter(
      s => s.confidence >= this.config.thresholds.autoApply
    );

    let successful = 0;
    let failed = 0;

    for (const move of autoMoves) {
      try {
        const destDir = path.dirname(move.suggested);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(move.current, move.suggested);
        successful++;
      } catch {
        failed++;
      }
    }

    return { successful, failed };
  }

  /**
   * Get high-confidence suggestions
   */
  getHighConfidenceSuggestions(): OrganizationSuggestion[] {
    return this.suggestions.filter(s => s.confidence >= this.config.thresholds.autoApply);
  }

  /**
   * Get medium-confidence suggestions
   */
  getMediumConfidenceSuggestions(): OrganizationSuggestion[] {
    return this.suggestions.filter(
      s =>
        s.confidence >= this.config.thresholds.suggest &&
        s.confidence < this.config.thresholds.autoApply
    );
  }
}

/**
 * Load configuration from file
 */
export function loadConfiguration(): UserConfig {
  const configPaths = ['.doc-organizer.json', 'package.json', '.doc-organizer.js'];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        if (configPath.endsWith('.js')) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          delete require.cache[require.resolve(path.resolve(configPath))];
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          return require(path.resolve(configPath));
        } else if (configPath === 'package.json') {
          const pkg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          if (pkg.docOrganizer) {
            return pkg.docOrganizer;
          }
        } else {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch {
        // Skip invalid config files
      }
    }
  }

  return {};
}

export default DocumentationOrganizer;
