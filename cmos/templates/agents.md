# AI Agent Configuration

**Instructions**: Copy this file to your project root and customize for YOUR project.

**Location**: This file should live at `project-root/agents.md` (NOT in cmos/)

**Purpose**: Guide AI agents when building YOUR APPLICATION CODE.

---

## Project Overview
**Project Name**: [Your Project Name]  
**Project Type**: [Web API, Web App, CLI Tool, Library, etc.]  
**Primary Language**: [Python, TypeScript, JavaScript, Go, etc.]  
**Framework**: [FastAPI, React, Next.js, Express, etc.]

**Description**: [Brief 1-2 sentence description of what you're building]

---

## Build & Development Commands

### Installation & Setup
```bash
# Install dependencies
[your install command]

# Setup database/environment
[your setup commands]

# First-time setup
[any initialization needed]
```

### Development
```bash
# Start development server
[your dev command]

# Watch mode (if applicable)
[your watch command]
```

### Building
```bash
# Build for production
[your build command]

# Build for staging (if applicable)
[your staging build]
```

### Testing
```bash
# Run all tests
[your test command]

# Run unit tests
[your unit test command]

# Run integration tests
[your integration test command]

# Generate coverage
[your coverage command]
```

### Linting & Formatting
```bash
# Lint code
[your lint command]

# Format code
[your format command]

# Type checking (if applicable)
[your type check command]
```

---

## Project Structure & Navigation

### Directory Layout
```
project-root/
├── [your source directory]/      # Application code
├── tests/                         # Application tests
├── docs/                          # Project documentation
├── [config directory]/            # Configuration files
├── [scripts directory]/           # Build and utility scripts
└── cmos/                          # Project management (DO NOT write code here!)
```

### Key Files
- `[main entry point]` - [description]
- `[config file]` - [description]
- `[important files]` - [description]

**Critical**: Never write application code in `cmos/` directory. That's for project management only.

---

## Coding Standards & Style

### [Language] Guidelines
- [Specific coding standards for your primary language]
- [Naming conventions]
- [Code organization patterns]
- [Formatting rules]

**Examples**:
```[language]
// Show an example of your preferred style
```

### File Organization
- [How files should be organized]
- [Naming conventions for files]
- [Module/package structure]

### Comments & Documentation
- [When to write comments]
- [Documentation string requirements]
- [Inline documentation style]

---

## Testing Preferences

### Framework & Tools
- **Framework**: [pytest, Jest, Mocha, etc.]
- **Coverage target**: [80%, 90%, etc.]
- **Coverage tool**: [pytest-cov, Istanbul, etc.]

### Test Structure
- **Test location**: `tests/` directory (NOT in cmos/)
- **Test naming**: [test_*.py, *.test.js, etc.]
- **Test organization**: [by feature, by module, etc.]

### Testing Requirements
- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]
- [ ] All features must have tests
- [ ] Critical paths need integration tests
- [ ] Run full suite before marking missions complete

**Example test**:
```[language]
// Show an example test in your preferred style
```

---

## Security & Quality Guardrails

### Security Rules
- Never commit API keys or secrets
- Use environment variables for sensitive data
- [Your specific security requirements]
- [Authentication/authorization patterns]
- [Data protection requirements]

### Code Quality Gates
- [Linting must pass]
- [Type checking must pass (if applicable)]
- [Coverage must meet threshold]
- [Code review requirements]

### Forbidden Patterns
- ❌ [Pattern 1 you want to avoid]
- ❌ [Pattern 2 you want to avoid]
- ❌ Hardcoded credentials
- ❌ Raw SQL queries (use ORM/query builder)

---

## Architecture Patterns

### Preferred Design Patterns
- **[Pattern 1]**: [When and how to use it]
- **[Pattern 2]**: [When and how to use it]

**Examples**:
```[language]
// Show example implementation of preferred pattern
```

### Database Access
- **ORM/Tool**: [SQLAlchemy, Prisma, TypeORM, etc.]
- **Migration tool**: [Alembic, Knex, Prisma, etc.]
- **Connection pattern**: [Connection pooling, etc.]

### API Design (if applicable)
- **Style**: [REST, GraphQL, gRPC, etc.]
- **Response format**: [JSON structure, error format, etc.]
- **Authentication**: [JWT, OAuth, API keys, etc.]

---

## Project-Specific Configuration

### Environment Variables
```bash
# Development
[YOUR_ENV_VAR]=value
[ANOTHER_VAR]=value

# Production
[PROD_VARS]=value
```

### External Services
- **[Service 1]**: [Purpose and configuration]
- **[Service 2]**: [Purpose and configuration]

### Deployment
- **Platform**: [Vercel, Railway, AWS, etc.]
- **Process**: [Deployment steps or CI/CD info]
- **Environment**: [Staging, production setup]

---

## CMOS Integration Notes

### When Working on Application Code
1. Read THIS agents.md (project-root/agents.md)
2. Write code to `src/`, `app/`, or your source directory
3. Write tests to `tests/` directory
4. Never write application code to `cmos/`

### When Working on CMOS Operations
1. Read `cmos/agents.md` for CMOS-specific instructions
2. Use mission runtime scripts
3. Update missions and contexts in `cmos/`
4. Keep application code and CMOS management separate

### Before Completing Missions
- [ ] All application tests pass
- [ ] Code meets standards defined above
- [ ] Documentation updated if needed
- [ ] Mission status verified in database

---

## Development Workflow

### Branch Strategy (if using Git)
- **Main**: [Your main branch strategy]
- **Development**: [Your dev branch strategy]
- **Features**: [Your feature branch naming]

### Commit Messages
```
[type]([scope]): [description]

Examples:
feat(api): add user authentication endpoint
fix(db): resolve connection pool timeout
docs(readme): update installation instructions
test(auth): add integration tests for OAuth
```

---

## Notes for AI Agents

### Context Loading Priority
1. Load `project-root/agents.md` (THIS FILE) for application work
2. Load `cmos/agents.md` for CMOS operations
3. Load `cmos/PROJECT_CONTEXT.json` for current state
4. Load `cmos/context/MASTER_CONTEXT.json` for project history
5. Reference `cmos/SESSIONS.jsonl` for recent session history

### Output Standards
- Use [Markdown, reStructuredText, etc.] for documentation
- Use [your preferred format] for reports
- Include code examples with syntax highlighting
- Keep explanations [concise/detailed/etc.]

### Communication Style
- [Your preference: concise, detailed, technical, etc.]
- [How to present options]
- [When to ask clarifying questions]

---

## Customization Checklist

Before using this template, update:

- [ ] All `[bracketed placeholders]` with your actual values
- [ ] Project overview with real project details
- [ ] Build commands with your actual commands
- [ ] Project structure with your actual directories
- [ ] Coding standards with your actual rules
- [ ] Testing requirements with your actual framework
- [ ] Security rules with your specific requirements
- [ ] Remove this checklist section when done

---

**Template Version**: 2.0  
**Last Updated**: 2025-11-08  
**Copy to**: `project-root/agents.md` (NOT cmos/)  
**Customize**: Replace all [placeholders] with your project details
