#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generalized Organization Rules - Configurable for different project types
class DocumentationOrganizer {
  constructor(config = {}) {
    this.config = this.mergeWithDefaults(config);
    this.suggestions = [];
    this.moves = [];
    this.errors = [];
  }

  // Default configuration that works for most projects
  getDefaultConfig() {
    return {
      // Project type affects organization patterns
      projectType: 'web-app', // Options: 'web-app', 'library', 'api', 'data-science', 'mobile'
      
      // Directory structure preferences
      structure: {
        aiDocs: 'ai_docs',      // Can be 'docs', 'documentation', '.ai', etc.
        specs: 'specs',         // Can be 'specifications', 'requirements', etc.
        root: './'
      },
      
      // Content classification patterns (can be customized per project)
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
      
      // Destination mapping (customizable per project structure)
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
      
      // Files that should never be moved (project-specific)
      protectedFiles: [
        'README.md',
        'CHANGELOG.md',
        'LICENSE.md',
        'CONTRIBUTING.md',
        'CODE_OF_CONDUCT.md'
      ],
      
      // Confidence thresholds
      thresholds: {
        autoApply: 0.8,    // 80%+ confidence for auto-apply
        suggest: 0.7,      // 70%+ confidence for suggestions
        filename: 0.9,     // Filename matches get high confidence
        content: 0.5       // Content matches get lower confidence
      },
      
      // Exclusion patterns for directory traversal
      excludePatterns: ['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.venv']
    };
  }

  // Merge user config with defaults
  mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultConfig();
    const merged = {
      ...defaults,
      ...userConfig,
      patterns: { ...defaults.patterns, ...(userConfig.patterns || {}) },
      destinations: { ...defaults.destinations, ...(userConfig.destinations || {}) },
      structure: { ...defaults.structure, ...(userConfig.structure || {}) },
      thresholds: { ...defaults.thresholds, ...(userConfig.thresholds || {}) },
      protectedFiles: [...defaults.protectedFiles, ...(userConfig.protectedFiles || [])]
    };
    
    // Convert string patterns to RegExp objects if needed
    if (userConfig.patterns) {
      for (const [key, pattern] of Object.entries(userConfig.patterns)) {
        if (typeof pattern === 'string') {
          merged.patterns[key] = new RegExp(pattern, 'i');
        }
      }
    }
    
    return merged;
  }

  // Resolve destination paths with variable substitution
  resolveDestination(destination) {
    return destination
      .replace('{aiDocs}', this.config.structure.aiDocs)
      .replace('{specs}', this.config.structure.specs)
      .replace('{root}', this.config.structure.root);
  }

  // Project type specific adjustments
  adjustForProjectType() {
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

  // Get all markdown files excluding configured patterns
  getAllMdFiles() {
    const files = [];
    const walkDir = (dir, excludePatterns = this.config.excludePatterns) => {
      try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          
          // Skip excluded directories
          if (excludePatterns.some(pattern => fullPath.includes(pattern))) {
            return;
          }
          
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath, excludePatterns);
          } else if (path.extname(item) === '.md') {
            files.push(fullPath);
          }
        });
      } catch (error) {
        this.errors.push(`Error reading directory ${dir}: ${error.message}`);
      }
    };
    
    walkDir('.');
    return files;
  }

  // Analyze file content to determine appropriate location
  analyzeFileContent(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath, '.md');
      const currentDir = path.dirname(filePath);
      
      // Skip protected files - they're already correctly placed
      if (this.config.protectedFiles.includes(filePath) || 
          this.config.protectedFiles.includes(path.basename(filePath))) {
        return null;
      }
      
      // Analyze filename and content
      const analysis = {
        fileName,
        currentPath: filePath,
        currentDir,
        contentLength: content.length,
        suggestedCategory: null,
        suggestedPath: null,
        confidence: 0,
        reasons: []
      };

      // Prioritize filename patterns (high confidence) over content patterns (lower confidence)
      for (const [category, pattern] of Object.entries(this.config.patterns)) {
        const fileNameMatch = pattern.test(fileName);
        
        if (fileNameMatch) {
          // Filename match gets high confidence
          analysis.suggestedCategory = category;
          analysis.confidence = this.config.thresholds.filename;
          const destination = this.resolveDestination(this.config.destinations[category]);
          analysis.suggestedPath = destination + fileName + '.md';
          analysis.reasons = ['filename match'];
          break; // Stop on first filename match
        }
      }

      // If no filename match, check content but with much lower confidence
      if (!analysis.suggestedCategory) {
        for (const [category, pattern] of Object.entries(this.config.patterns)) {
          // Only check content for very specific patterns to avoid false positives
          const contentHeader = content.substring(0, 200); // Only check first 200 chars
          const contentMatch = pattern.test(contentHeader);
          
          if (contentMatch && category !== 'aiInstructions') { // Skip AI instructions content check
            analysis.suggestedCategory = category;
            analysis.confidence = this.config.thresholds.content;
            const destination = this.resolveDestination(this.config.destinations[category]);
            analysis.suggestedPath = destination + fileName + '.md';
            analysis.reasons = ['content match'];
            break;
          }
        }
      }

      return analysis;
    } catch (error) {
      this.errors.push(`Error analyzing ${filePath}: ${error.message}`);
      return null;
    }
  }

  // Check if file is in the correct location according to rules
  isCorrectlyPlaced(analysis) {
    if (!analysis || !analysis.suggestedCategory) return true; // Unknown category, assume correct
    
    const expectedDir = this.resolveDestination(this.config.destinations[analysis.suggestedCategory]);
    
    // Normalize both paths consistently - ensure both end with '/' for proper comparison
    let normalizedCurrent = analysis.currentDir.replace(/^\.\//, '');
    let normalizedExpected = expectedDir.replace(/^\.\//, '');
    
    // Handle root directory case - empty string should become empty for root
    if (normalizedCurrent === '') normalizedCurrent = '.';
    if (normalizedExpected === '') normalizedExpected = '.';
    
    // Ensure both paths end with '/' unless they are root ('.')
    if (normalizedCurrent !== '.' && !normalizedCurrent.endsWith('/')) {
      normalizedCurrent += '/';
    }
    if (normalizedExpected !== '.' && !normalizedExpected.endsWith('/')) {
      normalizedExpected += '/';
    }
    
    // Handle root directory comparison: both '.' and './' should be considered root
    if ((normalizedCurrent === '.' && normalizedExpected === './') ||
        (normalizedCurrent === './' && normalizedExpected === '.')) {
      return true;
    }
    
    return normalizedCurrent === normalizedExpected;
  }

  // Generate organization suggestions
  generateSuggestions() {
    console.log(`🔍 Analyzing markdown files for ${this.config.projectType} project organization...\n`);
    
    this.adjustForProjectType();
    
    const files = this.getAllMdFiles();
    const misplacedFiles = [];
    
    files.forEach(file => {
      const analysis = this.analyzeFileContent(file);
      if (!analysis) return; // Skip protected files and analysis failures
      
      // Use configured threshold for suggestions
      if (!this.isCorrectlyPlaced(analysis) && analysis.confidence >= this.config.thresholds.suggest) {
        misplacedFiles.push(analysis);
        
        this.suggestions.push({
          current: analysis.currentPath,
          suggested: analysis.suggestedPath,
          category: analysis.suggestedCategory,
          confidence: analysis.confidence,
          reasons: analysis.reasons
        });
      }
    });

    return { files: files.length, misplaced: misplacedFiles.length };
  }

  // Generate comprehensive report
  generateReport() {
    const stats = this.generateSuggestions();
    const namingViolations = this.checkNamingConventions();
    
    console.log('📋 DOCUMENTATION ORGANIZATION REPORT');
    console.log(`Project Type: ${this.config.projectType.toUpperCase()}`);
    console.log('===================================\n');
    
    // Summary
    console.log(`📊 SUMMARY:`);
    console.log(`   Total files analyzed: ${stats.files}`);
    console.log(`   Files needing relocation: ${stats.misplaced}`);
    console.log(`   Protected files (correctly placed): ${this.config.protectedFiles.length}`);
    console.log(`   Naming violations: ${namingViolations.length}`);
    console.log(`   Errors encountered: ${this.errors.length}\n`);
    
    // Show configuration being used
    console.log('⚙️  CONFIGURATION:');
    console.log(`   AI Docs Directory: ${this.config.structure.aiDocs}/`);
    console.log(`   Specs Directory: ${this.config.structure.specs}/`);
    console.log(`   Auto-apply threshold: ${(this.config.thresholds.autoApply * 100).toFixed(0)}%`);
    console.log(`   Suggestion threshold: ${(this.config.thresholds.suggest * 100).toFixed(0)}%\n`);
    
    // Rest of the report logic...
    this.displaySuggestions();
    this.displayProtectedFiles();
    this.displayNamingViolations(namingViolations);
    this.displayErrors();
    this.generateRecommendations();
  }

  // Check for naming convention violations
  checkNamingConventions() {
    const files = this.getAllMdFiles();
    const violations = [];
    
    files.forEach(file => {
      const fileName = path.basename(file, '.md');
      const issues = [];
      
      // Only flag truly vague names, not standard ones like README
      const vaguePatterns = [/^doc$/, /^file$/, /^guide$/];
      if (vaguePatterns.some(pattern => pattern.test(fileName))) {
        issues.push('Vague naming - be more specific');
      }
      
      // Check for appropriate patterns based on location
      const dir = path.dirname(file);
      if (dir.includes(`${this.config.structure.aiDocs}/features`) && 
          !fileName.includes('-') && fileName !== 'README' && fileName.length > 3) {
        issues.push('Feature files should use kebab-case with descriptive names');
      }
      
      if (issues.length > 0) {
        violations.push({ file, issues });
      }
    });
    
    return violations;
  }

  displaySuggestions() {
    if (this.suggestions.length > 0) {
      console.log('📁 SUGGESTED RELOCATIONS:');
      this.suggestions.forEach((suggestion, index) => {
        console.log(`\n${index + 1}. ${suggestion.current}`);
        console.log(`   → ${suggestion.suggested}`);
        console.log(`   Category: ${suggestion.category}`);
        console.log(`   Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
        console.log(`   Reason: ${suggestion.reasons.join(', ')}`);
      });
      console.log();
    } else {
      console.log('✅ **No files need relocation - organization looks good!**\n');
    }
  }

  displayProtectedFiles() {
    console.log('🛡️  PROTECTED FILES (already correctly placed):');
    this.config.protectedFiles.forEach(file => {
      console.log(`   ✅ ${file}`);
    });
    console.log();
  }

  displayNamingViolations(violations) {
    if (violations.length > 0) {
      console.log('📝 NAMING CONVENTION VIOLATIONS:');
      violations.forEach((violation, index) => {
        console.log(`\n${index + 1}. ${violation.file}`);
        violation.issues.forEach(issue => {
          console.log(`   ⚠️  ${issue}`);
        });
      });
      console.log();
    }
  }

  displayErrors() {
    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(error => {
        console.log(`   ${error}`);
      });
      console.log();
    }
  }

  generateRecommendations() {
    console.log('💡 RECOMMENDATIONS:\n');
    
    if (this.suggestions.length > 0) {
      console.log('🎯 **Immediate Actions:**');
      
      // High confidence moves
      const highConfidence = this.suggestions.filter(s => s.confidence >= this.config.thresholds.autoApply);
      if (highConfidence.length > 0) {
        console.log(`\n   High Priority Moves (≥${(this.config.thresholds.autoApply * 100).toFixed(0)}% confidence):`);
        highConfidence.forEach(s => {
          console.log(`   mv "${s.current}" "${s.suggested}"`);
        });
      }
      
      // Medium confidence moves
      const mediumConfidence = this.suggestions.filter(s => 
        s.confidence >= this.config.thresholds.suggest && s.confidence < this.config.thresholds.autoApply);
      if (mediumConfidence.length > 0) {
        console.log(`\n   Review These Moves (${(this.config.thresholds.suggest * 100).toFixed(0)}-${((this.config.thresholds.autoApply * 100) - 1).toFixed(0)}% confidence):`);
        mediumConfidence.forEach(s => {
          console.log(`   # Consider: mv "${s.current}" "${s.suggested}"`);
        });
      }
    } else {
      console.log('✅ **Current organization is excellent!**');
      console.log('   • Files are in appropriate contextual locations');
      console.log('   • Key documents are properly protected');
      console.log('   • No major relocations needed');
    }
    
    console.log('\n🔧 **Next Steps:**');
    if (this.suggestions.length > 0) {
      console.log('   1. Review suggested moves above');
      console.log('   2. Run with --apply flag for high-confidence moves');
      console.log('   3. Update README files with new locations');
      console.log('   4. Check for broken references after moves');
    } else {
      console.log('   1. Continue using current organization - it\'s working well');
      console.log('   2. Monitor for future organization drift with regular checks');
    }
  }

  // Apply moves automatically
  applyMoves() {
    const autoMoves = this.suggestions.filter(s => s.confidence >= this.config.thresholds.autoApply);
    
    if (autoMoves.length === 0) {
      console.log('No high-confidence moves to apply automatically.');
      return;
    }

    console.log(`\n🤖 Applying ${autoMoves.length} high-confidence moves...\n`);
    
    autoMoves.forEach((move, index) => {
      try {
        // Ensure destination directory exists
        const destDir = path.dirname(move.suggested);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Move the file
        fs.renameSync(move.current, move.suggested);
        console.log(`✅ ${index + 1}. Moved: ${move.current} → ${move.suggested}`);
      } catch (error) {
        console.log(`❌ ${index + 1}. Failed: ${move.current} → ${error.message}`);
      }
    });
    
    console.log(`\n🎉 Applied ${autoMoves.length} moves successfully!`);
  }

  // Main execution method
  run() {
    const args = process.argv.slice(2);
    const shouldApply = args.includes('--apply');
    
    if (shouldApply) {
      // Generate suggestions first
      this.generateSuggestions();
      this.applyMoves();
    } else {
      this.generateReport();
      
      if (this.suggestions.length > 0) {
        console.log('\n🤖 AUTOMATED ORGANIZATION MODE');
        console.log('==============================\n');
        console.log('The following moves will be applied automatically:');
        console.log(`(Only high-confidence suggestions with ≥${(this.config.thresholds.autoApply * 100).toFixed(0)}% certainty)\n`);
        
        const autoMoves = this.suggestions.filter(s => s.confidence >= this.config.thresholds.autoApply);
        
        if (autoMoves.length === 0) {
          console.log('No high-confidence moves found. Manual review recommended.');
          console.log('Run without --apply flag to see all suggestions.\n');
        } else {
          autoMoves.forEach((move, index) => {
            console.log(`${index + 1}. ${move.current} → ${move.suggested}`);
          });
          console.log('\n⚠️  Run with --apply flag to execute these moves');
          console.log('⚠️  Make sure to commit current changes first!');
        }
      }
    }
  }
}

// Configuration loader - can read from file or use defaults
function loadConfiguration() {
  const configPaths = [
    '.doc-organizer.json',
    'package.json', // Look for docOrganizer field
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
  
  return {}; // Return empty config to use defaults
}

// Main execution
if (require.main === module) {
  const config = loadConfiguration();
  const organizer = new DocumentationOrganizer(config);
  organizer.run();
}

module.exports = DocumentationOrganizer; 