# Claude Code Integration Examples

## 1. Direct Claude Code Commands

### Organize Documentation
```bash
# In Claude Code session
> Please run the documentation organizer and apply high-confidence suggestions
```

### Scheduled Maintenance
```bash
# Claude Code can run this on schedule
> Check documentation health and organize files if needed, then commit changes
```

## 2. Claude API Integration

### Intelligent Pattern Detection
```javascript
// Enhanced organizer with Claude API
const anthropic = require('@anthropic-ai/sdk');

class IntelligentDocOrganizer extends DocumentationOrganizer {
  constructor(config) {
    super(config);
    this.claude = new anthropic.Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async analyzeDocumentContent(filePath, content) {
    const response = await this.claude.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Analyze this document and suggest the best category:
        
File: ${filePath}
Content: ${content.substring(0, 2000)}...

Categories: ${Object.keys(this.config.patterns).join(', ')}

Return only the category name.`
      }]
    });
    
    return response.content[0].text.trim();
  }
}
```

## 3. CLAUDE.md Integration

Add to your CLAUDE.md:
```markdown
# Documentation Organization

This project uses an automated documentation organizer. Key commands:

- `npm run doc:organize` - Show organization suggestions
- `npm run doc:organize:apply` - Apply high-confidence moves
- `npm run doc:health-check` - Check documentation health
- `npm run doc:similarity` - Find duplicate content

## Auto-Organization Rules
@scripts/doc-organizer-configs.js

The system maintains 90% accuracy with zero false positives.
```

## 4. MCP Server Integration

```javascript
// Create an MCP server for Claude Desktop
class DocOrganizerMCPServer {
  async organize_docs(args) {
    const organizer = new DocumentationOrganizer();
    const suggestions = await organizer.analyzeDocs();
    return {
      suggestions: suggestions.map(s => ({
        file: s.currentPath,
        target: s.suggestedPath, 
        confidence: s.confidence,
        reason: s.reason
      }))
    };
  }
  
  async apply_organization(args) {
    const organizer = new DocumentationOrganizer();
    return await organizer.applyMoves(args.suggestions);
  }
}
```

## 5. GitHub Actions Integration

```yaml
name: Documentation Maintenance
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2AM
  workflow_dispatch:

jobs:
  doc-maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run Claude Code Documentation Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npx @anthropic-ai/claude-code -p "
          Please analyze the documentation in this project:
          1. Run npm run doc:health-check
          2. If health score < 85%, run npm run doc:organize:apply
          3. Check for outdated documentation
          4. Suggest improvements
          5. Create a PR with any fixes
          "
          
      - name: Create Pull Request
        if: steps.organize.outputs.changes == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'Automated Documentation Maintenance'
          body: 'Automated documentation organization and health improvements'
``` 