# Gaps and Follow-Up Research Analysis

**Date:** 2025-01-XX  
**Status:** Analysis for Planning

This document identifies potential gaps in canonical coverage, suggests follow-up research for the three new core traits, and highlights areas requiring deeper investigation.

---

## Coverage Assessment: Top 20 Canonical Patterns

Based on foundational research ("The canonical building blocks of software"), here's our coverage of the Top 20:

| # | Pattern | Status | Notes |
|---|---------|--------|-------|
| 1 | User/Person | ✅ Core | Universal Quintet |
| 2 | Product/Item | ✅ Core | Universal Quintet |
| 3 | Order/Transaction | ✅ Core | Universal Quintet |
| 4 | Organization/Company | ✅ Core | Universal Quintet |
| 5 | Category/Tag | ✅ **NEW CORE** | Classifiable trait (R20.7) |
| 6 | **Role/Permission** | ⚠️ **GAP** | **Not covered - see below** |
| 7 | Comment/Review | ✅ Extension | R20.3 - Social/Engagement pack |
| 8 | **Address/Location** | ⚠️ **GAP** | **Not covered - see below** |
| 9 | Payment/Invoice | ✅ Extension | Billing domain (existing) |
| 10 | Subscription/Plan | ✅ Extension | Billing domain (existing) |
| 11 | Message/Communication | ✅ Extension | R20.6 - Communication pack |
| 12 | Media/Asset | ✅ Extension | R20.2 - Content Management pack |
| 13 | Activity/Event Log | ✅ **NEW CORE** | Auditable trait (R20.5) |
| 14 | Session/Token | ⚠️ Infrastructure | Security/infrastructure, not a trait |
| 15 | Notification/Alert | ✅ Extension | R20.1 - Communication pack |
| 16 | Relationship/Follow | ⚠️ **POTENTIAL GAP** | See below - might be too simple |
| 17 | Cart/Basket | ✅ Extension | R20.8 - E-commerce pack |
| 18 | Inventory/Stock | ⚠️ Domain-specific | Too specialized for core |
| 19 | Appointment/Booking | ✅ Extension | R20.4 - Service Management pack |
| 20 | Workflow/Task | ✅ Extension | R20.9 - Work Management pack |
| - | **Settings/Preferences** | ✅ **NEW CORE** | Preferenceable trait (R20.10) |

**Coverage:** 17/20 (85%)  
**Core Coverage:** 8/8 (Universal Quintet + 3 new core traits)

---

## Potential Gaps

### 1. Role/Permission (RBAC/Authorization) - #6 on Top 20

**Why it might be missing:**
- Appears in 90-95% of applications with multi-user access
- Foundational for authorization patterns
- High convergence: `id`, `name`, `permissions` (JSON or junction table)

**Analysis:**
- **Coverage:** Very high (nearly universal for authenticated apps)
- **Convergence:** High on core fields (role name, permissions array/table)
- **Complexity:** Medium (RBAC vs ABAC, hierarchical roles, dynamic permissions)
- **Dependencies:** Requires User object

**Recommendation:** **Extension Pack / Domain** (Authorization/Security)

**Rationale:**
- Not part of Universal Quintet, but extremely common
- Well-defined patterns (RBAC, ABAC, hierarchical roles)
- Represents distinct domain (security/authorization)
- Could be "Authorization" extension pack
- Might be too infrastructure-focused for core traits

**Research Needed:** R20.11 - Canonical Data Models for Authorization and Access Control Systems
- RBAC vs ABAC patterns
- Permission storage (JSON vs junction table)
- Hierarchical roles (parent_role_id)
- Dynamic permissions (context-based)
- Integration with User and Organization objects

---

### 2. Address/Location - #8 on Top 20

**Why it might be missing:**
- Appears in 80-90% of applications (shipping, billing, physical locations)
- Standardized patterns (postal standards, geocoding)
- High convergence: `street`, `city`, `state`, `country`, `postal_code`, `latitude`, `longitude`

**Analysis:**
- **Coverage:** Very high (e-commerce, logistics, user profiles, organizations)
- **Convergence:** Very high (postal standards drive consistency)
- **Complexity:** Low-Medium (geocoding, validation, international formats)
- **Dependencies:** Often attached to User, Organization, Order objects

**Recommendation:** **Core Trait** (Potentially)

**Rationale:**
- Nearly universal pattern
- High field convergence (postal standards)
- Simple, well-defined schema
- Cross-cutting concern (User addresses, Organization locations, Order shipping)
- Could be `Addressable` trait

**Research Needed:** R20.12 - Canonical Data Models for Address and Location Systems
- Postal address standards (USPS, international)
- Geocoding patterns (lat/lng storage, reverse geocoding)
- Address validation (normalization, verification)
- Multi-address support (billing, shipping, physical)
- International formats (country-specific fields)

**Complication:** Might be too simple to warrant a full trait - could be a schema pattern instead of a trait.

---

### 3. Relationship/Follow (Social Graph) - #16 on Top 20

**Analysis:**
- **Coverage:** High in social platforms, but not universal (50-60% of apps)
- **Convergence:** High on core fields (`follower_id`, `following_id`, `created_at`)
- **Complexity:** Low (simple junction table)
- **Dependencies:** Requires User object

**Recommendation:** **Extension Pack** (Social/Engagement) or **Too Simple**

**Rationale:**
- Common in social platforms, but not universal
- Very simple pattern (M:M relationship)
- Might be too simple to warrant a trait
- Could be part of Social/Engagement extension pack alongside Comments/Reviews

**Research Needed:** Only if we want to expand Social domain coverage.

---

## Follow-Up Research for New Core Traits

### For Auditable Trait

**Research Needed:** R20.5-FollowUp - Deep Dive on Audit Log Implementation Patterns

**Questions to Answer:**
1. **Pseudonymization Architecture:**
   - How do systems implement GDPR "Right to be Forgotten" while maintaining immutable audit trails?
   - What are the patterns for cryptographic erasure vs pseudonymization?
   - How do systems handle re-identification for legal discovery?

2. **Hash Chaining Implementation:**
   - What are the performance implications of hash chaining?
   - How do systems handle hash chain verification at scale?
   - What are the patterns for distributed hash chains (multi-service)?

3. **Storage and Retention Patterns:**
   - Tiered retention strategies (hot/warm/cold storage)
   - Compression and archival patterns
   - Query performance at scale (billions of events)

4. **Integration with Other Event Types:**
   - How do systems separate audit logs from analytics events?
   - What are the patterns for unified event ingestion with routing?
   - How do observability systems (OpenTelemetry) relate to audit logs?

**Deliverables:**
- Pseudonymization implementation guide
- Hash chaining performance benchmarks
- Retention and archival patterns
- Integration architecture patterns

---

### For Classifiable Trait

**Research Needed:** R20.7-FollowUp - Deep Dive on Classification Storage and Governance

**Questions to Answer:**
1. **Storage Model Selection Criteria:**
   - When to use Adjacency List vs Materialized Path vs Closure Table?
   - Performance benchmarks for each model (read vs write patterns)
   - Migration patterns between storage models

2. **Folksonomy Governance Patterns:**
   - Synonym mapping and tag merging strategies
   - Spam detection and moderation patterns
   - Tag recommendation algorithms

3. **Hybrid Model Implementation:**
   - WordPress pattern deep dive (terms + term_taxonomy + term_relationships)
   - How to efficiently query both taxonomy and tags simultaneously
   - Performance optimization for hybrid queries

4. **SEO and URL Patterns:**
   - Slug generation and collision handling
   - URL-friendly category paths
   - Breadcrumb generation from hierarchy

**Deliverables:**
- Storage model selection guide with benchmarks
- Folksonomy governance patterns
- Hybrid model implementation guide
- SEO/URL best practices

---

### For Preferenceable Trait

**Research Needed:** R20.10-FollowUp - Deep Dive on Preference Schema Evolution and UI Generation

**Questions to Answer:**
1. **Schema Evolution Patterns:**
   - Client-side vs server-side migration strategies
   - Backward compatibility guarantees
   - Breaking change patterns (when to create new preference keys)

2. **JSON Schema Integration:**
   - How to use JSON Schema for automatic form generation
   - Schema registry patterns
   - Validation at read vs write time

3. **Notification Preference Complexity:**
   - Two-axis matrix (Channel × Event-Type) implementation patterns
   - Preference-as-filter architecture
   - System-enforced preferences (locked: true) patterns

4. **Performance at Scale:**
   - JSONB query optimization (GIN indexes)
   - Caching strategies for high-read scenarios
   - Batch update patterns

5. **Integration with Enterprise Config and Feature Flags:**
   - How User Preferences relate to Enterprise Configuration
   - When to use Preferences vs Feature Flags
   - Unified client SDK patterns

**Deliverables:**
- Schema evolution migration guide
- JSON Schema → UI form generation patterns
- Notification preference implementation guide
- Performance optimization guide
- Integration architecture patterns

---

## Areas Requiring Deeper Investigation

### 1. Polymorphic Relationships Pattern

**Current State:** Mentioned in Comments/Reviews (entity_id, entity_type), but not formalized as a trait.

**Question:** Should polymorphic relationships be a core trait (`Relatable` or `Attachable`)?

**Research Needed:**
- How common is the polymorphic pattern across domains?
- What are the storage patterns (single table vs junction table)?
- How do systems handle type safety with polymorphic relationships?
- What are the query performance implications?

**Potential Trait:** `Relatable` - allows objects to relate to multiple entity types
```yaml
schema:
  related_entity_id: string
  related_entity_type: string
  relationship_type: enum [parent, child, linked, attached]
```

---

### 2. Soft Delete Pattern

**Current State:** Mentioned in foundational research as "near-universal" but not formalized.

**Question:** Should soft delete be a core trait (`Deletable` or `Archivable`)?

**Research Needed:**
- How common is soft delete vs hard delete?
- What are the patterns (deleted_at timestamp vs is_deleted boolean)?
- How do systems handle cascading soft deletes?
- What are the query performance implications (indexing deleted records)?

**Potential Trait:** `Deletable` - adds soft delete capability
```yaml
schema:
  deleted_at: timestamp
  deleted_by_id: string
  deletion_reason: string
```

---

### 3. Versioning Pattern

**Current State:** Mentioned in Media/Assets (R20.2) and Preferences (R20.10), but not as a standalone trait.

**Question:** Should versioning be a core trait (`Versionable`)?

**Research Needed:**
- How common is versioning across domains (documents, content, configurations)?
- What are the storage patterns (version table vs version column)?
- How do systems handle version comparison and diff?
- What are the patterns for "current version" vs "version history"?

**Potential Trait:** `Versionable` - adds version tracking
```yaml
schema:
  version: number
  version_parent_id: string
  is_current_version: boolean
```

**Complication:** Versioning patterns vary significantly by domain (document versioning vs content versioning vs configuration versioning).

---

### 4. Search/Filtering Capability

**Current State:** Not covered, but appears in 90%+ of applications.

**Question:** Is search/filtering a data model concern or a capability concern?

**Analysis:**
- Search is more of a capability than a data model
- Filtering often depends on Classifiable trait
- Full-text search is infrastructure (Elasticsearch, PostgreSQL FTS)
- Might be out of scope for OODS (more of a service/API concern)

**Recommendation:** Document as integration pattern, not a trait.

---

### 5. File/Document Attachments

**Current State:** Not covered separately from Media/Assets.

**Question:** Are document attachments different enough from media assets to warrant separate treatment?

**Analysis:**
- Documents have different concerns than media (versioning, collaboration, permissions)
- But might overlap too much with Media/Assets trait
- Could be part of Content Management extension pack

**Recommendation:** Include in Content Management extension pack if needed.

---

## Research Priority Matrix

### High Priority (Core or Near-Core)

1. **Address/Location (R20.12)** - Nearly universal, high convergence
2. **Auditable Follow-Up** - Critical for compliance implementation
3. **Classifiable Follow-Up** - Critical for storage model selection
4. **Preferenceable Follow-Up** - Critical for schema evolution

### Medium Priority (Extension Packs)

5. **Role/Permission (R20.11)** - Very common, but might be infrastructure
6. **Polymorphic Relationships** - Common pattern, needs formalization
7. **Soft Delete** - Near-universal pattern, simple trait

### Low Priority (Domain-Specific or Too Simple)

8. **Relationship/Follow** - Too simple, domain-specific
9. **Versioning** - Too domain-specific, patterns vary
10. **Search/Filtering** - Capability, not data model

---

## Recommendations

### Immediate Actions

1. **Research Address/Location (R20.12)** - Determine if it should be a core trait or schema pattern
2. **Deep dive on Auditable implementation** - Pseudonymization, hash chaining, retention
3. **Deep dive on Classifiable storage models** - Performance benchmarks, selection criteria
4. **Deep dive on Preferenceable schema evolution** - Migration patterns, JSON Schema integration

### Future Considerations

5. **Research Role/Permission (R20.11)** - Determine if it's a trait or infrastructure
6. **Formalize Polymorphic Relationships** - Determine if it should be a trait
7. **Formalize Soft Delete** - Determine if it should be a core trait

### Out of Scope

- Search/Filtering (capability, not data model)
- Session/Token (infrastructure/security)
- Inventory/Stock (too domain-specific)
- Relationship/Follow (too simple, domain-specific)

---

## Summary

**Coverage Status:** 85% of Top 20 canonical patterns covered

**Potential Gaps:**
- **Address/Location** - High priority, nearly universal
- **Role/Permission** - Medium priority, very common but might be infrastructure

**Follow-Up Research Needed:**
- All three new core traits need implementation deep dives
- Address/Location needs initial research
- Role/Permission needs initial research

**Areas for Deeper Investigation:**
- Polymorphic relationships (formalization)
- Soft delete (formalization)
- Versioning (domain-specific, might not be universal enough)

The design system is in excellent shape. The remaining gaps are either:
1. Too simple to warrant a trait (Relationship/Follow)
2. Too infrastructure-focused (Session/Token, Role/Permission might be)
3. Domain-specific (Inventory, Versioning patterns vary)
4. Capabilities rather than data models (Search/Filtering)

The most promising addition would be **Address/Location** if research confirms it's universal enough and complex enough to warrant a trait.

