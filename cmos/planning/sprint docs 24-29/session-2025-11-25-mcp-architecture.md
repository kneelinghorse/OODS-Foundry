# Session Summary: Design Research Schema & MCP Architecture
**Date:** 2025-11-25
**Type:** Planning
**Session ID:** PS-2025-11-25-001
**Sprint:** Sprint 30 (Complete) / Sprint 31 (Planning)

---

## Overview

This session addressed a critical architecture question: **How should design research be structured so OODS MCP tools can use it to generate designs?**

The key insight: **MCP server is a universal service, not embedded in OODS-Foundry.** Research lives in each project's repo and is passed to MCP as parameters.

---

## Key Outcomes

### 1. Architecture Decision: Universal MCP Service

**Decision:**
MCP server operates as a standalone service callable from any project via stdio/http. Research data lives in the calling project's repository, NOT in OODS-Foundry.

**Rationale:**
- Enables OODS MCP to work with portfolio projects (derekn.com), client work, any design system
- Follows standard MCP pattern (like Mission Protocol MCP)
- Clean separation: MCP provides design capabilities, projects provide context

**Implementation:**
```
Project (derekn.com) → Agent/CLI → OODS MCP Server
   ├─ design-research/ (local files)
   └─ .mcp-config.json (points to OODS MCP)

Agent reads research files → transforms to JSON → passes to MCP tools
MCP tools return UiSchema, validation results, etc.
```

**Constraints:**
- MCP tools MUST NOT read filesystems
- All data via request parameters
- Agent/CLI responsible for file operations
- Each project configures MCP independently

---

### 2. Research Input Schema Standardization

**Artifacts Created:**
1. **cmos/templates/design-research-output-schema.yaml**
   - Complete specification with 5 output types
   - Required/optional fields for each type
   - Transformation mapping to MCP inputs
   - Examples and validation rules

2. **cmos/templates/design-research-quick-reference.md**
   - Quick lookup guide
   - Concise examples
   - MCP input transformation

**Schema Categories:**

| Type | Purpose | Key Fields |
|------|---------|------------|
| **persona** | User goals, pain points, preferences | name, role, goals, visual_preferences, ui_implications |
| **visual_reference** | Screenshot/comp analysis | extracted_tokens (colors, typography, spacing), layout_patterns, component_suggestions |
| **brand_guidelines** | Brand identity constraints | colors, typography, voice_tone |
| **job_to_be_done** | User jobs and outcomes | job_statement, desired_outcome, ui_implication |
| **constraints** | Technical/accessibility requirements | technical, accessibility, performance, responsive |

**Mapping to MCP Tools:**

Mission outputs in this schema format transform directly to:
```json
{
  "researchContext": {
    "personas": [...],
    "visualReferences": [...],
    "brandGuidelines": {...},
    "jtbd": [...],
    "constraints": {...}
  }
}
```

This becomes input to `repl.render` or `design.generate`.

---

### 3. Validation-First Approach

**Decision:**
Start with flat file inputs (YAML/JSON), defer vector database until proven necessary.

**Rationale:**
- Validate architecture quickly
- Avoid over-engineering
- Simple initial implementation
- Add complexity when needed

**Validation Plan:**
1. Create sample research files using schema
2. Run visual analysis mission → validate output matches schema
3. Manually test transformation: YAML → JSON → MCP input
4. Enhance one MCP tool to accept researchContext
5. Test end-to-end with Design Lab Shell

**If validation succeeds:** Proceed to Sprint 31 (MCP enhancements)
**If issues found:** Refine schema before heavy build

---

## Sprint 30 Review

**Status:** ✅ COMPLETE (7/7 missions)

**Achievements:**
- Design Lab Shell: 81.96% coverage (exceeds 80% target)
- Structured data refresh tool extracted to cmos/scripts/
- Semantic Protocol v3.2.0 validated
- OODS Agent CLI validated
- Documentation created (4 new docs)
- designStudio folder removed
- MCP server + Design Lab operational

**Key Deliverables:**
- [tools/design-lab-shell/](../tools/design-lab-shell/) - Three-pane React harness
- [cmos/scripts/refresh_structured_data.py](../scripts/refresh_structured_data.py) - Registry generator
- [src/system_protocols/Semantic Protocol — v3.2.0.js](../src/system_protocols/Semantic Protocol — v3.2.0.js)
- [docs/mcp/Design-Lab-Shell.md](../docs/mcp/Design-Lab-Shell.md)
- [cmos/planning/sprint-30-closeout.md](sprint-30-closeout.md)

---

## Strategic Decisions

### Decision 1: MCP Server Architecture - Universal Service Model
**Date:** 2025-11-25

**What:**
MCP server is a standalone service callable from any project, not embedded in OODS-Foundry. Research data lives in each project repo and is passed as parameters.

**Why:**
Enables OODS MCP to be used across portfolio projects, client work, and any design system implementation. Follows standard MCP pattern.

**Impact:**
Projects like derekn.com can use OODS MCP without being part of OODS repo. Research stays with the project it belongs to.

**Related Artifacts:**
- design-research-output-schema.yaml
- design-research-quick-reference.md

---

### Decision 2: Research Input Schema Standardization
**Date:** 2025-11-25

**What:**
Defined standard YAML/JSON schema for design research outputs with 5 categories: personas, visual_references, brand_guidelines, jtbd, constraints. Schema maps 1:1 to MCP tool inputs.

**Why:**
Missions can output structured research that feeds directly into MCP tools without custom transformation logic. Standardization enables reusability.

**Impact:**
Clear contract between mission outputs and MCP inputs. Missions using 6-layer prompt templates can produce consistent, usable data.

**Validation Approach:**
Test with sample missions before heavy build investment.

---

### Decision 3: Flat File MVP Before Vector DB
**Date:** 2025-11-25

**What:**
Start with flat file inputs (YAML/JSON parsed by agent/CLI) to validate architecture before investing in vector database infrastructure.

**Why:**
Faster validation, simpler initial implementation, defer complexity until proven necessary. Avoid over-engineering.

**Impact:**
Can ship and validate core concept within days instead of weeks. Add vector DB later if search/retrieval becomes bottleneck.

---

### Decision 4: MCP Tools Accept Research as Parameters
**Date:** 2025-11-25

**What:**
MCP tools receive all data as request parameters, never read filesystems. Agent/CLI is responsible for reading files and transforming to JSON.

**Why:**
Clean separation of concerns, MCP tools remain stateless and project-agnostic. Enables universal service model.

**Impact:**
Tools are portable, testable, and can be called from any client (Claude Desktop, custom scripts, web apps).

---

## Next Steps

### Immediate (Before Sprint 31):
1. **Validate Schema with Sample Mission**
   - Run visual analysis mission using 6-layer prompt
   - Verify output matches schema spec
   - Test transformation to MCP input JSON

2. **Create Example Research Package**
   - derekn.com/design-research/
   - Sample persona, visual reference, brand guidelines
   - Use as validation test case

### Sprint 31 Planning (Pending Validation):

**B31.1: Enhance repl.render for Research Context** (4-6h)
- Add optional `researchContext` parameter
- Use research to inform rendering decisions
- Tests and documentation

**B31.2: Build design.generate Tool** (10-12h)
- Input: researchContext + intent → Output: UiSchema
- LLM integration (Gemini/Claude)
- Component selection logic
- Rationale capture (why each choice)
- Tests and schema

**B31.3: Update Design Lab Shell** (4-6h)
- Pass researchContext when calling MCP tools
- Display research hints in chat pane
- Show component suggestions from visual refs

**B31.4: Documentation & Examples** (4-6h)
- "Using OODS MCP with Your Project" guide
- derekn.com example walkthrough
- API documentation for new tools
- Sprint closeout

**Total Estimated:** 22-30 hours

---

## Open Questions

### Decision Pending:
**Should we start Sprint 31 or create validation missions first?**

**Option A: Start Sprint 31**
- Assume schema is correct
- Build enhancements immediately
- Course-correct if validation finds issues

**Option B: Validation Missions First**
- Create 2-3 quick missions to test schema
- Validate transformation pipeline
- Refine schema based on learnings
- Then commit to Sprint 31

**Recommendation:** Option B (validation first)
**Rationale:** Low-cost validation prevents expensive rework

---

### Decision Pending:
**Which MCP enhancement to tackle first?**

**Option A: repl.render enhancement (easier)**
- Smaller scope
- Quick win
- Proves parameter passing pattern

**Option B: design.generate (more valuable)**
- Bigger impact
- Core generative capability
- More complex, higher risk

**Recommendation:** Option A first (repl.render)
**Rationale:** Validate architecture with simpler tool before complex one

---

## Files Created This Session

### Templates:
- `cmos/templates/design-research-output-schema.yaml` (263 lines)
- `cmos/templates/design-research-quick-reference.md` (80 lines)

### Planning:
- `cmos/planning/session-2025-11-25-mcp-architecture.md` (this file)

### Context Updates:
- `master_context` (4 strategic decisions added)
- `project_context` (session 303, snapshot updated)
- Session PS-2025-11-25-001 (23 captures, completed)

---

## Session Metadata

**Duration:** ~2 hours
**Agent:** Claude (Sonnet 4.5)
**Sprint Context:** Sprint 30 complete, Sprint 31 planning
**Session Type:** Planning / Architecture
**Participants:** User + Assistant
**Captured:** 23 session items (5 decisions, 8 context, 4 constraints, 6 next steps)

**Session Status:** ✅ Complete
**Next Session:** Validation missions or Sprint 31 kickoff (TBD)
