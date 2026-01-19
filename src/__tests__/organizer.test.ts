import { DocumentationOrganizer, loadConfiguration } from '../organizer';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs for tests
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DocumentationOrganizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const organizer = new DocumentationOrganizer();
      expect(organizer.config.projectType).toBe('web-app');
      expect(organizer.config.structure.aiDocs).toBe('ai_docs');
      expect(organizer.config.thresholds.autoApply).toBe(0.8);
    });

    it('should merge user config with defaults', () => {
      const organizer = new DocumentationOrganizer({
        projectType: 'library',
        structure: { aiDocs: 'docs' }
      });
      expect(organizer.config.projectType).toBe('library');
      expect(organizer.config.structure.aiDocs).toBe('docs');
      expect(organizer.config.structure.specs).toBe('specs'); // default preserved
    });

    it('should convert string patterns to RegExp', () => {
      const organizer = new DocumentationOrganizer({
        patterns: { custom: '^custom-' }
      });
      expect(organizer.config.patterns.custom).toBeInstanceOf(RegExp);
      expect(organizer.config.patterns.custom.test('custom-file')).toBe(true);
    });
  });

  describe('resolveDestination', () => {
    it('should substitute variables in path', () => {
      const organizer = new DocumentationOrganizer({
        structure: { aiDocs: 'docs/ai', specs: 'specifications', root: './' }
      });
      expect(organizer.resolveDestination('{aiDocs}/setup/')).toBe('docs/ai/setup/');
      expect(organizer.resolveDestination('{specs}/')).toBe('specifications/');
      expect(organizer.resolveDestination('{root}')).toBe('./');
    });
  });

  describe('adjustForProjectType', () => {
    it('should add library-specific patterns', () => {
      const organizer = new DocumentationOrganizer({ projectType: 'library' });
      organizer.adjustForProjectType();
      expect(organizer.config.protectedFiles).toContain('API.md');
      expect(organizer.config.protectedFiles).toContain('USAGE.md');
    });

    it('should add data-science-specific patterns', () => {
      const organizer = new DocumentationOrganizer({ projectType: 'data-science' });
      organizer.adjustForProjectType();
      expect(organizer.config.protectedFiles).toContain('METHODOLOGY.md');
      expect(organizer.config.destinations.analysis).toBe('{aiDocs}/analysis/');
    });

    it('should add mobile-specific patterns', () => {
      const organizer = new DocumentationOrganizer({ projectType: 'mobile' });
      organizer.adjustForProjectType();
      expect(organizer.config.protectedFiles).toContain('DEPLOYMENT.md');
    });

    it('should add api-specific patterns', () => {
      const organizer = new DocumentationOrganizer({ projectType: 'api' });
      organizer.adjustForProjectType();
      expect(organizer.config.protectedFiles).toContain('ENDPOINTS.md');
    });
  });

  describe('isCorrectlyPlaced', () => {
    it('should return true for null analysis', () => {
      const organizer = new DocumentationOrganizer();
      expect(organizer.isCorrectlyPlaced(null as any)).toBe(true);
    });

    it('should return true for analysis without category', () => {
      const organizer = new DocumentationOrganizer();
      const analysis = {
        fileName: 'test',
        currentPath: 'test.md',
        currentDir: '.',
        contentLength: 100,
        suggestedCategory: null,
        suggestedPath: null,
        confidence: 0,
        reasons: []
      };
      expect(organizer.isCorrectlyPlaced(analysis)).toBe(true);
    });

    it('should return true when file is in correct location', () => {
      const organizer = new DocumentationOrganizer();
      const analysis = {
        fileName: 'CLAUDE',
        currentPath: 'ai_docs/setup/CLAUDE.md',
        currentDir: 'ai_docs/setup',
        contentLength: 100,
        suggestedCategory: 'aiInstructions' as const,
        suggestedPath: 'ai_docs/setup/CLAUDE.md',
        confidence: 0.9,
        reasons: ['filename match']
      };
      expect(organizer.isCorrectlyPlaced(analysis)).toBe(true);
    });

    it('should return false when file is in wrong location', () => {
      const organizer = new DocumentationOrganizer();
      const analysis = {
        fileName: 'CLAUDE',
        currentPath: 'CLAUDE.md',
        currentDir: '.',
        contentLength: 100,
        suggestedCategory: 'aiInstructions' as const,
        suggestedPath: 'ai_docs/setup/CLAUDE.md',
        confidence: 0.9,
        reasons: ['filename match']
      };
      expect(organizer.isCorrectlyPlaced(analysis)).toBe(false);
    });
  });

  describe('checkNamingConventions', () => {
    it('should flag vague file names', () => {
      mockFs.readdirSync.mockReturnValue(['doc.md'] as any);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const organizer = new DocumentationOrganizer();
      // Override getAllMdFiles for this test
      organizer.getAllMdFiles = () => ['doc.md'];

      const violations = organizer.checkNamingConventions();
      expect(violations).toHaveLength(1);
      expect(violations[0].issues).toContain('Vague naming - be more specific');
    });
  });

  describe('getHighConfidenceSuggestions', () => {
    it('should filter suggestions by autoApply threshold', () => {
      const organizer = new DocumentationOrganizer();
      organizer.suggestions = [
        { current: 'a.md', suggested: 'b.md', category: 'setup', confidence: 0.9, reasons: [] },
        { current: 'c.md', suggested: 'd.md', category: 'setup', confidence: 0.7, reasons: [] },
        { current: 'e.md', suggested: 'f.md', category: 'setup', confidence: 0.85, reasons: [] }
      ];

      const high = organizer.getHighConfidenceSuggestions();
      expect(high).toHaveLength(2);
      expect(high.map(s => s.current)).toEqual(['a.md', 'e.md']);
    });
  });

  describe('getMediumConfidenceSuggestions', () => {
    it('should filter suggestions between suggest and autoApply thresholds', () => {
      const organizer = new DocumentationOrganizer();
      organizer.suggestions = [
        { current: 'a.md', suggested: 'b.md', category: 'setup', confidence: 0.9, reasons: [] },
        { current: 'c.md', suggested: 'd.md', category: 'setup', confidence: 0.75, reasons: [] },
        { current: 'e.md', suggested: 'f.md', category: 'setup', confidence: 0.6, reasons: [] }
      ];

      const medium = organizer.getMediumConfidenceSuggestions();
      expect(medium).toHaveLength(1);
      expect(medium[0].current).toBe('c.md');
    });
  });
});

describe('loadConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty config when no config file exists', () => {
    mockFs.existsSync.mockReturnValue(false);
    const config = loadConfiguration();
    expect(config).toEqual({});
  });

  it('should load from .doc-organizer.json', () => {
    mockFs.existsSync.mockImplementation((p: any) => p === '.doc-organizer.json');
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ projectType: 'library' }));

    const config = loadConfiguration();
    expect(config.projectType).toBe('library');
  });

  it('should load from package.json docOrganizer field', () => {
    mockFs.existsSync.mockImplementation((p: any) => p === 'package.json');
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        name: 'test',
        docOrganizer: { projectType: 'api' }
      })
    );

    const config = loadConfiguration();
    expect(config.projectType).toBe('api');
  });
});
