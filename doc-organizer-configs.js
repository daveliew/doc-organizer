// Example configurations for different project types
// These can be used as .doc-organizer.json files or in package.json under "docOrganizer" field

const configs = {
  // Web Application (React, Vue, Angular, etc.)
  webApp: {
    projectType: 'web-app',
    structure: {
      aiDocs: 'ai_docs',
      specs: 'specs',
      root: './'
    },
    patterns: {
      aiInstructions: /^(CLAUDE|CURSOR|ai-|assistant-|development-guidelines|coding-standards)/i,
      architecture: /^(architecture|system-design|api-spec|tech-stack|design-doc)/i,
      features: /^(feature-|prd-|spec-|functionality-|user-story|component-)/i,
      maintenance: /^(refactor|troubleshoot|deploy|maintenance|operation|.*audit|.*testing.*guide|mobile.*testing|cleanup.*summary|.*organization.*rules|markdown.*organization|devops|ops-)/i,
      setup: /^(setup|getting-started|project-overview|configuration|install|onboard|quickstart)/i,
      guides: /^(.*guide|tutorial|demo.*guide|how-to|walkthrough)/i,
      testing: /^(test-|testing|qa|quality|e2e|unit|integration)/i
    },
    protectedFiles: [
      'README.md',
      'CLAUDE.md',
      'CLAUDE_CONTEXT.md',
      'CHANGELOG.md',
      'LICENSE.md',
      'CONTRIBUTING.md'
    ]
  },

  // Library/Package
  library: {
    projectType: 'library',
    structure: {
      aiDocs: 'docs',
      specs: 'specs',
      root: './'
    },
    patterns: {
      api: /^(api|usage|reference|methods)/i,
      architecture: /^(architecture|design|internals)/i,
      setup: /^(setup|install|getting-started|quickstart)/i,
      guides: /^(.*guide|tutorial|example|how-to)/i,
      maintenance: /^(maintenance|contributing|development)/i
    },
    destinations: {
      api: '{aiDocs}/api/',
      architecture: '{aiDocs}/internals/',
      setup: '{aiDocs}/',
      guides: '{aiDocs}/guides/',
      maintenance: '{aiDocs}/development/'
    },
    protectedFiles: [
      'README.md',
      'API.md',
      'USAGE.md',
      'CHANGELOG.md',
      'LICENSE.md'
    ]
  },

  // API/Backend Service
  api: {
    projectType: 'api',
    structure: {
      aiDocs: 'docs',
      specs: 'api-specs',
      root: './'
    },
    patterns: {
      endpoints: /^(endpoint|route|api-|swagger|openapi)/i,
      schemas: /^(schema|model|dto|entity)/i,
      architecture: /^(architecture|design|system)/i,
      deployment: /^(deploy|docker|k8s|kubernetes|helm)/i,
      monitoring: /^(monitoring|logging|metrics|health)/i,
      security: /^(security|auth|authorization|authentication)/i
    },
    destinations: {
      endpoints: '{specs}/',
      schemas: '{specs}/schemas/',
      architecture: '{aiDocs}/architecture/',
      deployment: '{aiDocs}/deployment/',
      monitoring: '{aiDocs}/operations/',
      security: '{aiDocs}/security/'
    },
    protectedFiles: [
      'README.md',
      'ENDPOINTS.md',
      'SCHEMAS.md',
      'API.md'
    ]
  },

  // Data Science/ML Project
  dataScience: {
    projectType: 'data-science',
    structure: {
      aiDocs: 'docs',
      specs: 'experiments',
      root: './'
    },
    patterns: {
      analysis: /^(analysis|eda|exploratory)/i,
      models: /^(model|algorithm|ml-|ai-)/i,
      datasets: /^(data|dataset|source)/i,
      experiments: /^(experiment|trial|test|validation)/i,
      methodology: /^(methodology|approach|process)/i,
      results: /^(results|findings|conclusion|report)/i
    },
    destinations: {
      analysis: '{aiDocs}/analysis/',
      models: '{aiDocs}/models/',
      datasets: '{aiDocs}/data/',
      experiments: '{specs}/',
      methodology: '{aiDocs}/methodology/',
      results: '{aiDocs}/results/'
    },
    protectedFiles: [
      'README.md',
      'METHODOLOGY.md',
      'DATA.md',
      'RESULTS.md'
    ]
  },

  // Mobile App
  mobile: {
    projectType: 'mobile',
    structure: {
      aiDocs: 'docs',
      specs: 'specs',
      root: './'
    },
    patterns: {
      features: /^(feature-|screen-|component-)/i,
      deployment: /^(deploy|store|release|build|ci-cd)/i,
      testing: /^(test-|testing|qa|device)/i,
      performance: /^(performance|optimization|memory)/i,
      platform: /^(ios|android|platform|native)/i
    },
    destinations: {
      features: '{aiDocs}/features/',
      deployment: '{aiDocs}/deployment/',
      testing: '{aiDocs}/testing/',
      performance: '{aiDocs}/performance/',
      platform: '{aiDocs}/platform/'
    },
    protectedFiles: [
      'README.md',
      'DEPLOYMENT.md',
      'STORE.md',
      'PLATFORM.md'
    ]
  },

  // Documentation-heavy project
  documentation: {
    projectType: 'documentation',
    structure: {
      aiDocs: '.ai',
      specs: 'specifications',
      root: './'
    },
    patterns: {
      content: /^(content-|article-|post-)/i,
      style: /^(style-|design-|brand-)/i,
      process: /^(process-|workflow-|editorial)/i,
      technical: /^(technical-|dev-|api-)/i
    },
    destinations: {
      content: 'content/',
      style: 'style-guide/',
      process: 'editorial/',
      technical: 'technical/'
    },
    thresholds: {
      autoApply: 0.9,  // Higher threshold for docs projects
      suggest: 0.8,
      filename: 0.95,
      content: 0.6
    }
  }
};

// Usage examples:
const usageExamples = {
  // In package.json
  packageJson: {
    "name": "my-project",
    "docOrganizer": {
      "projectType": "web-app",
      "structure": {
        "aiDocs": "documentation"
      },
      "protectedFiles": [
        "README.md",
        "CUSTOM.md"
      ]
    }
  },

  // As .doc-organizer.json
  configFile: {
    "projectType": "library",
    "structure": {
      "aiDocs": "docs"
    },
    "thresholds": {
      "autoApply": 0.9
    }
  },

  // As .doc-organizer.js (for complex logic)
  jsConfig: `
module.exports = {
  projectType: 'api',
  structure: {
    aiDocs: process.env.NODE_ENV === 'production' ? 'docs' : 'dev-docs'
  },
  patterns: {
    // Custom patterns based on your naming conventions
    myCustomPattern: /^(custom-prefix-)/i
  },
  destinations: {
    myCustomPattern: '{aiDocs}/custom/'
  }
};
`
};

module.exports = { configs, usageExamples }; 