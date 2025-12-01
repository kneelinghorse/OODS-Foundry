# Design Research Output - Quick Reference

## Purpose
Standard format for design research that feeds into OODS MCP tools.

## Workflow
1. Mission gathers research (6-layer prompts)
2. Output saved in this format (YAML/JSON)
3. Agent reads + transforms to MCP input
4. MCP tools generate designs

---

## Output Types

### 1. Persona
```yaml
personas:
  - name: "Sarah - Hiring Manager"
    role: "Senior Hiring Manager"
    goals: ["Quick assessment", "See samples"]
    pain_points: ["Slow sites", "Hidden contact"]
    visual_preferences:
      layout_style: "minimal"
      information_density: "low"
    ui_implications:
      - "Samples visible on hero"
```

### 2. Visual Reference
```yaml
visual_references:
  - name: "Homepage Comp"
    source: "Dribbble"
    analysis_method: "gemini-1.5-pro"
    extracted_tokens:
      colors:
        primary: "#1A1A1A"
        accent: "#3B82F6"
      typography:
        heading_font: "Inter"
        heading_sizes: ["48px", "36px"]
      spacing:
        grid_system: "8pt"
    layout_patterns: ["Hero + CTA", "3-col grid"]
    component_suggestions: ["HeroSection", "ProjectCard"]
    oods_mapping:
      hero: "HeroSection"
```

### 3. Brand Guidelines
```yaml
brand_guidelines:
  colors:
    primary: "#3B82F6"
    secondary: "#8B5CF6"
  typography:
    headings: "Inter"
    body: "Inter"
  voice_tone: ["professional", "approachable"]
```

### 4. Job to Be Done
```yaml
jobs_to_be_done:
  - job_statement: "Assess portfolio quality"
    context: "Initial screening, time-constrained"
    desired_outcome: "Quick decision on interview"
    ui_implication: "Samples must be immediately visible"
    priority: "high"
```

### 5. Constraints
```yaml
constraints:
  technical:
    - constraint: "8-point grid system"
      rationale: "Design system consistency"
  accessibility:
    - standard: "WCAG 2.2 AA"
      requirements: ["4.5:1 contrast", "Keyboard nav"]
  responsive:
    - breakpoints: ["320px", "768px", "1024px"]
      approach: "mobile-first"
```

---

## File Structure

```
project/
├── design-research/
│   ├── manifest.yaml
│   ├── personas/
│   │   └── primary-user.yaml
│   ├── visual-references/
│   │   ├── comp.yaml
│   │   └── comp.png
│   ├── brand-guidelines.yaml
│   └── jobs-to-be-done.yaml
```

---

## MCP Tool Input

Research transforms to:

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

Passed to `repl.render` or `design.generate`.

---

## Validation Rules

✅ Personas: name, role, goals required
✅ Visual refs: extracted_tokens.colors required
✅ Hex colors: 6-digit with #
✅ Spacing: include units (px, rem)

---

## See Full Spec

`cmos/templates/design-research-output-schema.yaml`
