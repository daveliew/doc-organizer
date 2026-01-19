/**
 * Type definitions for doc-organizer
 */

// Project types supported by the organizer
export type ProjectType = 'web-app' | 'library' | 'api' | 'data-science' | 'mobile';

// Document categories for classification
export type DocumentCategory =
  | 'aiInstructions'
  | 'architecture'
  | 'features'
  | 'maintenance'
  | 'setup'
  | 'guides'
  | 'audits'
  | 'specs'
  | 'api'
  | 'testing'
  | 'analysis'
  | 'deployment'
  | 'endpoints'
  | 'unknown';

// Configuration structure
export interface DocOrganizerConfig {
  projectType: ProjectType;
  structure: {
    aiDocs: string;
    specs: string;
    root: string;
  };
  patterns: Record<string, RegExp>;
  destinations: Record<string, string>;
  protectedFiles: string[];
  thresholds: {
    autoApply: number;
    suggest: number;
    filename: number;
    content: number;
    aiConfidence: number; // Minimum AI confidence to trust
  };
  ai: AIConfig;
  excludePatterns: string[];
}

// AI-specific configuration
export interface AIConfig {
  enabled: boolean;
  model: 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-haiku-20240307';
  fallbackThreshold: number; // Use AI when regex confidence is below this
  maxTokens: number;
}

// File analysis result
export interface FileAnalysis {
  fileName: string;
  currentPath: string;
  currentDir: string;
  contentLength: number;
  suggestedCategory: DocumentCategory | null;
  suggestedPath: string | null;
  confidence: number;
  reasons: string[];
  aiEnhanced?: boolean; // Whether AI was used to enhance classification
}

// Organization suggestion
export interface OrganizationSuggestion {
  current: string;
  suggested: string;
  category: DocumentCategory;
  confidence: number;
  reasons: string[];
  aiEnhanced?: boolean;
}

// AI Classification result
export interface AIClassificationResult {
  category: DocumentCategory;
  confidence: number;
  reason: string;
  alternativeCategories?: Array<{
    category: DocumentCategory;
    confidence: number;
  }>;
}

// AI Classification request
export interface AIClassificationRequest {
  filePath: string;
  fileName: string;
  contentPreview: string;
  availableCategories: DocumentCategory[];
  existingAnalysis?: {
    category: DocumentCategory | null;
    confidence: number;
    reasons: string[];
  };
}

// Health check result for MCP server
export interface HealthCheckResult {
  totalFiles: number;
  misplacedFiles: number;
  staleFiles: string[];
  orphanedFiles: string[];
  namingViolations: Array<{
    file: string;
    issues: string[];
  }>;
  healthScore: number; // 0-100
}

// MCP Tool definitions
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// MCP Tool call result
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// Report generation options
export interface ReportOptions {
  includeProtected?: boolean;
  includeNamingViolations?: boolean;
  format?: 'text' | 'json' | 'markdown';
  verbose?: boolean;
}

// Apply moves result
export interface ApplyMovesResult {
  successful: number;
  failed: number;
  moves: Array<{
    from: string;
    to: string;
    success: boolean;
    error?: string;
  }>;
}
