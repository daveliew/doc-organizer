/**
 * AI-powered document classifier using Claude API
 *
 * This module provides semantic document classification when regex patterns
 * produce low-confidence results. It uses Claude Sonnet for accurate,
 * cost-effective classification.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIClassificationResult,
  AIClassificationRequest,
  DocumentCategory,
  AIConfig
} from './types';

// Default AI configuration
const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  model: 'claude-sonnet-4-20250514',
  fallbackThreshold: 0.8, // Use AI when regex confidence < 80%
  maxTokens: 500
};

// JSON schema for structured output
const CLASSIFICATION_SCHEMA = {
  name: 'document_classification',
  description: 'Classification result for a documentation file',
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: [
          'aiInstructions',
          'architecture',
          'features',
          'maintenance',
          'setup',
          'guides',
          'audits',
          'specs',
          'api',
          'testing',
          'unknown'
        ],
        description: 'The most appropriate category for this document'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence score between 0 and 1'
      },
      reason: {
        type: 'string',
        description: 'Brief explanation of why this category was chosen'
      },
      alternativeCategories: {
        type: 'array',
        items: {
          type: 'object' as const,
          properties: {
            category: { type: 'string' },
            confidence: { type: 'number' }
          },
          required: ['category', 'confidence'],
          additionalProperties: false
        },
        description: 'Other possible categories with lower confidence'
      }
    },
    required: ['category', 'confidence', 'reason'],
    additionalProperties: false
  }
};

export class AIClassifier {
  private client: Anthropic | null = null;
  private config: AIConfig;
  private initialized: boolean = false;

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  /**
   * Initialize the Anthropic client
   * Lazy initialization to avoid errors when API key is not set
   */
  private initialize(): boolean {
    if (this.initialized) return this.client !== null;

    try {
      // Client will use ANTHROPIC_API_KEY from environment
      this.client = new Anthropic();
      this.initialized = true;
      return true;
    } catch (error) {
      console.warn('AI classifier not available: ANTHROPIC_API_KEY not set');
      this.initialized = true;
      return false;
    }
  }

  /**
   * Check if AI classification is available
   */
  isAvailable(): boolean {
    return this.initialize() && this.client !== null;
  }

  /**
   * Classify a document using Claude API
   */
  async classify(request: AIClassificationRequest): Promise<AIClassificationResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    if (!this.initialize() || !this.client) {
      return null;
    }

    const systemPrompt = `You are a documentation classification expert. Your task is to categorize documentation files into the most appropriate category based on their filename and content.

Categories and their purposes:
- aiInstructions: AI assistant instructions (CLAUDE.md, CURSOR.md, development guidelines)
- architecture: System design, API specifications, tech stack documentation
- features: Feature specifications, PRDs, user stories, functionality docs
- maintenance: Refactoring guides, troubleshooting, deployment, operations
- setup: Getting started guides, installation, configuration, onboarding
- guides: Tutorials, how-to guides, walkthroughs, demos
- audits: Audit reports, analysis documents, reviews
- specs: Technical specifications, requirements, RFCs
- api: API documentation, endpoint specs, OpenAPI/Swagger docs
- testing: Test documentation, QA guides, testing strategies
- unknown: Use only when the document doesn't fit any category

Guidelines:
1. Prioritize filename patterns over content
2. Consider the primary purpose of the document
3. A high confidence (>0.8) means you're very certain
4. Return alternative categories if the document could fit multiple
5. Be concise in your reasoning`;

    const userPrompt = `Classify this documentation file:

Filename: ${request.fileName}
Path: ${request.filePath}

Content preview (first 2000 characters):
${request.contentPreview}

${request.existingAnalysis ? `
Previous analysis (regex-based):
- Suggested category: ${request.existingAnalysis.category || 'none'}
- Confidence: ${(request.existingAnalysis.confidence * 100).toFixed(0)}%
- Reasons: ${request.existingAnalysis.reasons.join(', ') || 'none'}
` : ''}

Provide your classification with confidence score and reasoning.`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        system: systemPrompt,
        tools: [{
          name: CLASSIFICATION_SCHEMA.name,
          description: CLASSIFICATION_SCHEMA.description,
          input_schema: CLASSIFICATION_SCHEMA.schema
        }],
        tool_choice: { type: 'tool', name: CLASSIFICATION_SCHEMA.name }
      });

      // Extract tool use response
      const toolUse = response.content.find(block => block.type === 'tool_use');
      if (toolUse && toolUse.type === 'tool_use') {
        const input = toolUse.input as AIClassificationResult;
        return {
          category: input.category as DocumentCategory,
          confidence: input.confidence,
          reason: input.reason,
          alternativeCategories: input.alternativeCategories?.map(alt => ({
            category: alt.category as DocumentCategory,
            confidence: alt.confidence
          }))
        };
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`AI classification failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Should AI be used for this file based on existing analysis confidence?
   */
  shouldUseAI(existingConfidence: number): boolean {
    return this.config.enabled && existingConfidence < this.config.fallbackThreshold;
  }

  /**
   * Merge AI classification with existing regex-based analysis
   */
  mergeAnalysis(
    existingAnalysis: {
      category: DocumentCategory | null;
      confidence: number;
      reasons: string[];
    },
    aiResult: AIClassificationResult
  ): { category: DocumentCategory; confidence: number; reasons: string[] } {
    // If AI is more confident, use AI result
    if (aiResult.confidence > existingAnalysis.confidence) {
      return {
        category: aiResult.category,
        confidence: aiResult.confidence,
        reasons: [`AI: ${aiResult.reason}`, ...existingAnalysis.reasons]
      };
    }

    // If AI agrees with regex, boost confidence
    if (existingAnalysis.category === aiResult.category) {
      return {
        category: existingAnalysis.category,
        confidence: Math.min(1, existingAnalysis.confidence + 0.1), // Boost by 10%
        reasons: [...existingAnalysis.reasons, `AI confirmed: ${aiResult.reason}`]
      };
    }

    // Disagreement - use existing with note
    return {
      category: existingAnalysis.category || aiResult.category,
      confidence: existingAnalysis.confidence,
      reasons: [
        ...existingAnalysis.reasons,
        `AI suggested ${aiResult.category} (${(aiResult.confidence * 100).toFixed(0)}%)`
      ]
    };
  }

  /**
   * Get configuration
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance for convenience
export const aiClassifier = new AIClassifier();

// Export utility function for quick classification
export async function classifyWithAI(
  filePath: string,
  fileName: string,
  contentPreview: string,
  existingAnalysis?: {
    category: DocumentCategory | null;
    confidence: number;
    reasons: string[];
  }
): Promise<AIClassificationResult | null> {
  return aiClassifier.classify({
    filePath,
    fileName,
    contentPreview,
    availableCategories: [
      'aiInstructions',
      'architecture',
      'features',
      'maintenance',
      'setup',
      'guides',
      'audits',
      'specs',
      'api',
      'testing',
      'unknown'
    ],
    existingAnalysis
  });
}
