/**
 * doc-organizer - AI-powered documentation organizer
 *
 * Main exports for programmatic usage.
 */

// Type exports
export * from './types';

// AI classifier exports
export { AIClassifier, aiClassifier, classifyWithAI } from './ai-classifier';

// Re-export the JavaScript DocumentationOrganizer
// Note: This will need to be updated when the core is converted to TypeScript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DocumentationOrganizerJS = require('../doc-organizer.js');
export const DocumentationOrganizer = DocumentationOrganizerJS;
