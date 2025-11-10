# agents.md Guide

**Purpose**: Understand the two-agents.md architecture and how to write effective AI instructions.

---

## The Two agents.md Files

CMOS uses **TWO separate** agents.md files with different purposes:

### 1. Project Root agents.md (YOUR APPLICATION)

**Location**: `project-root/agents.md`

**Purpose**: Instructions for building YOUR APPLICATION CODE

**Contains**:
- Your project tech stack (React, FastAPI, etc.)
- Your build commands (npm start, pytest, etc.)
- Your coding standards and style guides
- Your test requirements and coverage targets
- Your deployment and CI/CD process
- Your security requirements
- Your API design patterns

**Used when**: Agent is writing code in `src/`, `tests/`, `app/`, etc.

**Example**:
```markdown
# AI Agent Configuration

## Project Overview
**Project Name**: TraceLab API
**Primary Language**: Python
**Framework**: FastAPI + PostgreSQL

## Build Commands
python -m uvicorn app.main:app --reload
pytest tests/ -v

## Coding Standards
- Follow PEP 8
- 80%+ test coverage required
- Type hints on all functions
```

### 2. cmos/agents.md (CMOS OPERATIONS)

**Location**: `cmos/agents.md`

**Purpose**: Instructions for CMOS SYSTEM OPERATIONS

**Contains**:
- How to work with missions and sprints
- How to use the SQLite database
- CMOS validation requirements
- Mission runtime procedures
- Context management rules

**Used when**: Agent is managing missions, updating backlog, working with CMOS system

**Already provided** - Don't customize this for your project!

---

## Critical Boundaries

**When working on YOUR APPLICATION**:
```
Agent reads: project-root/agents.md
Agent writes to: src/, tests/, docs/ (YOUR CODE)
Agent ignores: cmos/ (management layer)
```

**When working on MISSIONS/PLANNING**:
```
Agent reads: cmos/agents.md
Agent writes to: cmos/missions/, cmos/contexts/, cmos/db/
Agent ignores: src/ (application code)
```

**NEVER**:
- ❌ Write application code in `cmos/`
- ❌ Write application tests in `cmos/tests/` (those are CMOS tests)
- ❌ Put mission management in project root
- ❌ Use one agents.md for both purposes

---

## Writing Effective agents.md (Project Root)

### Structure

Use this template structure:

```markdown
# AI Agent Configuration

## Project Overview
- Project name, type, tech stack
- Brief description

## Build & Development Commands
- Installation
- Development server
- Build process
- Testing

## Project Structure & Navigation
- Directory layout
- Key files and their purposes

## Coding Standards & Style
- Language-specific guidelines
- Naming conventions
- Code organization patterns

## Testing Preferences
- Framework to use
- Coverage requirements
- Test structure

## Security & Quality Guardrails
- Security rules
- Code review requirements
- Quality gates

## Architecture Patterns
- Preferred design patterns
- Integration approaches

## Project-Specific Configuration
- Environment variables
- External services
- Special requirements
```

### Best Practices

**Be Specific**:
```markdown
❌ Bad: "Write good tests"
✅ Good: "Use pytest with fixtures. Minimum 80% coverage. Test file naming: test_*.py"
```

**Give Examples**:
```markdown
## API Design
All endpoints return JSON:
{
  "data": {...},
  "meta": {"timestamp": "...", "version": "..."}
}
```

**State Constraints**:
```markdown
## Security Rules
- Never commit API keys
- Use environment variables for secrets
- All database queries must use parameterized statements
```

**Define Success**:
```markdown
## Testing Requirements
- All features need integration tests
- Critical paths need E2E tests
- Run full suite before marking mission complete
```

---

## Directory-Specific agents.md Files (Advanced)

For large projects, you can have **multiple agents.md files**:

```
project-root/
├── agents.md              # Top-level rules
├── backend/
│   └── agents.md          # Backend-specific rules
├── frontend/
│   └── agents.md          # Frontend-specific rules
└── cmos/
    └── agents.md          # CMOS operations (separate!)
```

**Precedence**: More specific files override general ones.

---

## Common Mistakes

### Mistake 1: Mixing CMOS and Project Instructions

❌ **Wrong**:
```markdown
# agents.md (in project root)

## CMOS Operations
Update missions in cmos/missions/backlog.yaml...

## Application Code
Write FastAPI endpoints in src/api/...
```

✅ **Right**: Keep CMOS instructions in `cmos/agents.md` only.

### Mistake 2: Not Being Specific Enough

❌ **Vague**:
```markdown
## Testing
Write tests for everything
```

✅ **Specific**:
```markdown
## Testing
Framework: pytest
Coverage: 80% minimum
File naming: test_*.py in tests/ directory
Run before mission complete: pytest tests/ -v --cov
```

### Mistake 3: Writing Application Code in cmos/

If your agents.md says to write code in `cmos/`, **it's wrong**.

✅ **Correct project root agents.md**:
```markdown
## Project Structure
src/               # Application code goes HERE
tests/             # Application tests go HERE
cmos/              # DO NOT write application code here!
```

### Mistake 4: Forgetting to Update agents.md

Your project evolves. Update agents.md when:
- Tech stack changes (new framework, new language)
- Build process changes (new commands, new tools)
- Standards change (new linting rules, new patterns)
- Architecture pivots (microservices → monolith, etc.)

---

## Template Customization Guide

**Starting point**: `cmos/templates/agents.md`

**Required sections** (customize these):
1. Project Overview - Your actual project details
2. Build Commands - Your actual commands
3. Project Structure - Your actual directories
4. Coding Standards - Your actual rules

**Optional sections** (add if relevant):
5. Security & Quality (if you have specific requirements)
6. Architecture Patterns (if you have preferred patterns)
7. External Services (if you integrate with APIs)
8. Deployment (if you have deployment process)

**Remove**:
- Generic placeholder text
- Irrelevant sections
- Examples that don't match your project

---

## Example: Complete agents.md for FastAPI Project

```markdown
# AI Agent Configuration

## Project Overview
**Project Name**: TraceLab Research API
**Project Type**: REST API
**Primary Language**: Python 3.11
**Framework**: FastAPI + PostgreSQL + Qdrant

## Build & Development Commands

### Installation
pip install -r requirements.txt
alembic upgrade head

### Development
uvicorn app.main:app --reload --port 8000

### Testing
pytest tests/ -v --cov=app --cov-report=html

### Database
alembic revision --autogenerate -m "description"
alembic upgrade head

## Project Structure
src/app/           # FastAPI application
src/app/api/       # API endpoints
src/app/models/    # SQLAlchemy models
tests/             # Application tests
alembic/           # Database migrations
cmos/              # Project management (DO NOT write code here)

## Coding Standards
- Follow PEP 8
- Use type hints on all functions
- Docstrings on all public functions (Google style)
- Max line length: 100 characters
- Use f-strings for formatting

## Testing Requirements
- Framework: pytest
- Coverage: 80% minimum
- Test naming: test_*.py
- Use fixtures for database setup
- Integration tests for all endpoints

## Database
- Use SQLAlchemy ORM (no raw SQL)
- All queries must be parameterized
- Use Alembic for migrations
- Never commit migration without testing

## Security Rules
- Never commit .env files
- All secrets in environment variables
- API keys must be in .env.local (gitignored)
- Input validation on all endpoints
```

---

## Validation

After creating your agents.md:

**Check 1**: File locations
```bash
ls -la agents.md         # Project root ✓
ls -la cmos/agents.md    # CMOS operations ✓
```

**Check 2**: Content separation
- Project root agents.md mentions YOUR CODE? ✓
- Project root agents.md mentions cmos/ directories? ❌ (Should not!)
- cmos/agents.md mentions mission management? ✓
- cmos/agents.md mentions your application code? ❌ (Should not!)

**Check 3**: Specificity
- Build commands are YOUR actual commands? ✓
- Tech stack matches YOUR actual stack? ✓
- Standards reflect YOUR actual practices? ✓

---

## Quick Start Summary

1. ✅ **Two agents.md files** - One for your code, one for CMOS
2. ✅ **Clear boundaries** - Never mix them
3. ✅ **Be specific** - Give real commands and examples
4. ✅ **Keep updated** - Evolve with your project
5. ✅ **Version control both** - They're project documentation

---

**Last Updated**: 2025-11-08  
**See Also**: `cmos/docs/getting-started.md` for full setup flow

