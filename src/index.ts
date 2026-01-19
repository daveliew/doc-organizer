/**
 * doc-organizer - AI-powered documentation organizer
 *
 * Main exports for programmatic usage.
 */

// Type exports
export * from './types';

// AI classifier exports
export { AIClassifier, aiClassifier, classifyWithAI } from './ai-classifier';

// Core organizer exports
export {
  DocumentationOrganizer,
  loadConfiguration,
  UserConfig,
  AnalysisStats,
  NamingViolation
} from './organizer';

// Default export
export { DocumentationOrganizer as default } from './organizer';
