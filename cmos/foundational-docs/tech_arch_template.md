# [Project Name] – Technical Architecture

## 0) Executive Summary

**[Write 2-3 paragraphs explaining:]**
- What problem does this system solve?
- What is the core solution approach?
- What are the key technical benefits/outcomes?

---

## 1) Goals / Non-Goals

### Goals
**[List 4-6 primary objectives the system MUST achieve]**

### Non-Goals
**[List 3-5 things explicitly OUT of scope to prevent scope creep]**

---

## 2) System Overview

**[Provide a high-level ASCII diagram showing:]**
- Main components/services
- Data flow between components
- External systems/dependencies
- Key integration points

**[Then write 1-2 paragraphs describing:]**
- Control plane (management/configuration)
- Data plane (runtime execution/processing)

---

## 3) Core Components

**[For each major component, create a section with:]**

### Component Name

**Purpose:** [What does this component do?]

**Responsibilities:**
- [Key responsibility 1]
- [Key responsibility 2]
- [Key responsibility 3]

**Technology/Implementation:** [Brief tech stack or approach]

---

## 4) Primary Interface/API

**[Define the main way users/systems interact with your system]**

### Interface Name

**[For each major operation/endpoint:]**

#### Operation: `operation_name`

**Input:** [What parameters/data does it accept?]

**Output:** [What does it return?]

**Behavior:** [What happens when called? Include success/error cases]

**Example Schema (if applicable):**
```json
[Provide a minimal schema showing structure, not real data]
```

---

## 5) Internal Service APIs

**[Document service-to-service communication]**

### API Endpoint: `METHOD /path`

**Request:** [What data is sent?]

**Response:** [What data is returned?]

**Purpose:** [Why does this internal API exist?]

**Transport:** [HTTP, gRPC, message queue, etc.]

---

## 6) Data Model

**[For each major data entity, define:]**

### Entity: `entity_name`

**Fields:**
- `field_name` (type) | [description] | [constraints]
- `field_name` (type) | [description] | [constraints]

**Relationships:** [How does this relate to other entities?]

**Indexes/Keys:** [What fields are indexed or used as keys?]

---

## 7) Canonical Flows

**[Describe 2-4 key user/system flows]**

### Flow: [Name of Flow]

**[Use numbered steps:]**

1. [Actor] does [action]
2. [System component] performs [operation]
3. [Result/next step]
4. [Continuation or completion]

**[Include both happy path and key error scenarios]**

---

## 8) Performance, Caching & SLOs

### SLO Targets

**[Define measurable performance goals:]**
- `metric_name` ≤ [target value] ([percentile])
- `metric_name` ≥ [target value] ([percentile])

### Caching Strategy

**[For each cache layer:]**

**Layer:** [Name/type]
- **What:** [What is cached?]
- **TTL:** [How long?]
- **Invalidation:** [When/how is it cleared?]

### Optimization Strategies

**[List key performance optimizations:]**
- [Optimization 1]
- [Optimization 2]

---

## 9) Security, Governance, Cost Controls

### Authentication (AuthN)
**[How do users/services prove identity?]**

### Authorization (AuthZ)
**[How are permissions enforced?]**

### Quotas & Rate Limits
**[What limits exist to prevent abuse/overspending?]**

### Audit Trail
**[What actions are logged for compliance/security?]**

### Cost Controls
**[How is spending monitored and limited?]**

---

## 10) Observability

### Metrics

**[List key metrics to track:]**

**System Metrics:**
- `metric_name`: [what it measures, why it matters]
- `metric_name`: [what it measures, why it matters]

**Infrastructure Metrics:**
- `metric_name`: [what it measures, why it matters]

### Tracing

**[Define key trace spans:]**
- [operation] → [sub-operation] → [result]

### Events

**[List important events to capture:]**
- `event.name`: [when triggered, what data included]

---

## 11) Deployment & Release

### Deployment Architecture
**[Describe how the system is deployed:]**
- [Stateless/stateful?]
- [Scaling strategy?]
- [Environment separation?]

### Release Process
**[Outline deployment workflow:]**
- [How are changes rolled out?]
- [What safeguards exist?]
- [How are rollbacks handled?]

### Disaster Recovery
**[Describe backup and recovery strategy]**

---

## 12) Testing & Benchmarking

### Unit/Integration Tests
**[What test categories exist?]**
- [Test type 1]: [what it validates]
- [Test type 2]: [what it validates]

### Quality Benchmarks
**[How is quality measured?]**
- [Metric/test suite]
- [Success criteria]

### Resilience Testing
**[How do you test failure scenarios?]**
- [Chaos test 1]
- [Graceful degradation test]

### Performance/Load Testing
**[How is performance validated?]**
- [Load scenario]
- [Metrics tracked]

---

## 13) Reference Interfaces

**[Provide example schemas for key interfaces]**

### Interface Name

```json
{
  "field": "type",
  "description": "Purpose of this field",
  "constraints": "Validation rules"
}
```

**[Note: Use minimal examples showing structure only]**

---

## 14) Roadmap

**[Outline implementation phases]**

### MVP (Sprint 1-2)
**[What is the minimum viable system?]**

**Deliverables:**
- [Core feature 1]
- [Core feature 2]

### Sprint 3-4
**[What comes next?]**

**Deliverables:**
- [Enhancement 1]
- [Enhancement 2]

### Future Phases
**[What is deferred but planned?]**
- [Advanced feature 1]
- [Advanced feature 2]

---

## 15) Open Questions

**[List unresolved technical decisions:]**

- [Question 1]?
- [Question 2]?
- [Question 3]?

**[For each question, optionally note:]**
- Why this needs resolution
- Potential options being considered
- Who decides or what research is needed
