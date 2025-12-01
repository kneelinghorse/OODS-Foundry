# R20 Research Synthesis: OODS Canonical Object Analysis

## Analysis Framework

**Core Design System Criteria:**
- Appears in virtually 100% of applications (Universal Quintet level)
- Foundational building block that other objects depend on
- High convergence across platforms (>85% field overlap)
- Essential for basic application functionality

**Extension Pack / Domain Criteria:**
- Appears in 50-90% of applications
- Specialized but still canonical enough to be reusable
- Clear patterns across multiple platforms
- Can be composed from core traits but represents a distinct domain

**Too Bespoke Criteria:**
- Highly domain-specific (<50% application coverage)
- Significant divergence across implementations
- Better handled as application-specific logic
- Not worth generalizing into design system

---

## R20.1: Notification Systems

**Canonical Object:** Notification Intent

**Analysis:**
- **Coverage:** High (appears in 80-90% of modern applications)
- **Convergence:** Very high (~90% on core fields: id, recipient_id, topic_id, content.title/body, data payload)
- **Dependencies:** Requires User object (recipient_id)
- **Complexity:** Medium-High (multi-channel orchestration, state machine, preference management)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Not part of Universal Quintet, but extremely common
- Well-defined canonical model with high convergence
- Represents a distinct domain (communication/engagement)
- Can be composed from core traits (Identifiable, Statusable, Timestamped) but adds domain-specific complexity (channels, preferences, delivery state)
- Would fit well as a "Communication" extension pack alongside Messages

**OODS Approach:**
- Core traits: Identifiable, Statusable, Timestamped
- Domain-specific traits: Notifiable, Channelable, Preferenceable
- Contexts: List (notification feed), Detail (notification view), Timeline (delivery history)

---

## R20.2: Media/Asset Management

**Canonical Object:** Asset

**Analysis:**
- **Coverage:** High (appears in 70-85% of applications)
- **Convergence:** High on core fields (asset_id, public_id, file_info, media_info, timestamps)
- **Dependencies:** Requires User object (uploader_id/creator_id)
- **Complexity:** Very High (transformations, versioning, security, CDN delivery)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Not universal quintet, but very common
- Strong canonical model with clear patterns (flat vs nested, on-the-fly vs eager)
- Represents distinct domain (media/digital assets)
- High complexity suggests it should be a specialized domain pack
- Could be part of a "Content Management" extension pack

**OODS Approach:**
- Core traits: Identifiable, Timestamped, Statusable (lifecycle_status)
- Domain-specific traits: Transformable, Versionable, Securable (access_control)
- Contexts: List (media library), Detail (asset viewer), Form (upload/edit)

---

## R20.3: Comment and Review Systems

**Canonical Object:** Comment/Review

**Analysis:**
- **Coverage:** Very High (appears in 85-95% of social/content applications)
- **Convergence:** High on core fields (id, user_id, entity_id, entity_type, body, status, timestamps)
- **Dependencies:** Requires User object, polymorphic entity relationship
- **Complexity:** Medium-High (threading models, moderation, engagement/voting)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Extremely common but not universal quintet
- Clear canonical model with high convergence
- Represents distinct domain (user-generated content, social interaction)
- Review extends Comment (superset pattern)
- Would fit as "Social/Engagement" extension pack

**OODS Approach:**
- Core traits: Identifiable, Timestamped, Statusable, Polymorphic (entity relationship)
- Domain-specific traits: Threadable, Moderatible, Votable, Rateable (for reviews)
- Contexts: List (comment feed), Detail (comment thread), Form (comment editor)

---

## R20.4: Appointment and Booking Systems

**Canonical Object:** Appointment/Booking

**Analysis:**
- **Coverage:** Medium-High (appears in 60-75% of service/commerce applications)
- **Convergence:** High on core temporal fields (start, end, timezone, status)
- **Dependencies:** Requires User, Organization, Resource, Service objects
- **Complexity:** Very High (availability calculation, recurrence, multi-resource, policies)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Not universal but common in service industries
- Well-defined canonical model (convergence on Google Calendar/iCalendar patterns)
- Represents distinct domain (scheduling/reservations)
- High complexity with specialized concerns (availability, timezone handling, resource allocation)
- Would fit as "Scheduling/Booking" extension pack

**OODS Approach:**
- Core traits: Identifiable, Timestamped, Statusable
- Domain-specific traits: Schedulable, Recurrable, Resourceable, Policyable (cancellation)
- Contexts: List (calendar view), Detail (appointment view), Form (booking form), Timeline (appointment history)

---

## R20.5: Activity and Event Log Systems

**Canonical Object:** Activity/Event Log Entry

**Analysis:**
- **Coverage:** Very High (appears in 90-100% of enterprise applications)
- **Convergence:** High on Actor-Action-Entity model (Universal Event Quintet)
- **Dependencies:** Requires User object (actor), polymorphic entity
- **Complexity:** Medium (schema is simple, but use cases diverge: analytics, audit, observability, activity feeds)

**Recommendation:** **Core Design System (with caveats)**

**Rationale:**
- Nearly universal (appears in virtually all applications)
- Strong convergence on Actor-Action-Entity-Context-Timestamp model
- Foundational for audit trails, analytics, activity feeds
- However, implementation patterns diverge significantly (append-only log vs stateful feed)
- Could be core trait "Auditable" or "Eventable" that other objects compose

**OODS Approach:**
- Core trait: Eventable/Auditable (Actor-Action-Entity pattern)
- Can be composed into any object that needs audit/activity tracking
- Contexts: List (activity feed), Timeline (audit log), Detail (event detail)

**Note:** The event log itself might be core infrastructure, but the Activity Feed read model is an extension pack concern.

---

## R20.6: Message and Communication Systems

**Canonical Object:** Message, Conversation

**Analysis:**
- **Coverage:** Very High (appears in 85-95% of applications)
- **Convergence:** High on core Message fields (message_id, conversation_id, sender_id, content, timestamp, status)
- **Dependencies:** Requires User object, Conversation container
- **Complexity:** High (threading, real-time delivery, presence, encryption, receipts)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Very common but represents distinct domain (communication)
- Clear canonical model with good convergence
- Part of "Communication" domain alongside Notifications
- High complexity (real-time, encryption, threading) suggests specialized domain pack
- Could be part of larger "Communication" extension pack with Notifications

**OODS Approach:**
- Core traits: Identifiable, Timestamped, Statusable (delivery state)
- Domain-specific traits: Threadable, Reactable, Editable, Encryptable
- Contexts: List (conversation list), Detail (message thread), Form (message composer), Timeline (message history)

---

## R20.7: Category, Tag, and Taxonomy Systems

**Canonical Object:** Category, Tag, Term

**Analysis:**
- **Coverage:** Very High (appears in 90-100% of content/product applications)
- **Convergence:** High on core fields (id, name, slug, parent_id for hierarchies)
- **Dependencies:** Polymorphic relationship to content (many-to-many)
- **Complexity:** Medium (hierarchy models, faceted classification, governance)

**Recommendation:** **Core Design System Trait**

**Rationale:**
- Nearly universal for any content/product system
- High convergence on basic taxonomy model
- Represents a foundational pattern: classification/organization
- Should be a core trait "Classifiable" or "Taxonomizable" that Products, Content, etc. can use
- The specific implementation (taxonomy vs folksonomy) can vary, but the pattern is universal

**OODS Approach:**
- Core trait: Classifiable/Taxonomizable
- Can be applied to Product, Content, or any object needing classification
- Supports both hierarchical (Category) and flat (Tag) models
- Contexts: List (category browser), Detail (category view), Form (tag editor)

---

## R20.8: Cart and Ephemeral State Management

**Canonical Object:** Cart, CartItem

**Analysis:**
- **Coverage:** Medium (appears in 50-70% of e-commerce/commerce applications)
- **Convergence:** High on core fields (id, user_id, status, currency, items)
- **Dependencies:** Requires User, Product objects
- **Complexity:** Medium-High (anonymous-to-authenticated merge, price snapshots, inventory holds, abandonment)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Common in commerce but not universal
- Well-defined canonical model (draft transaction pattern)
- Represents distinct domain (commerce/transactional state)
- Specialized concerns (ephemeral state, merge logic, abandonment)
- Would fit as "Commerce" extension pack alongside Orders/Transactions

**OODS Approach:**
- Core traits: Identifiable, Statusable, Timestamped
- Domain-specific traits: Snapshotable (price snapshots), Mergeable (cart merge), Expirable (abandonment)
- Contexts: List (cart items), Detail (cart review), Form (checkout)

---

## R20.9: Task, Ticket, and Workflow Systems

**Canonical Object:** WorkItem (Task/Issue/Ticket)

**Analysis:**
- **Coverage:** High (appears in 70-85% of enterprise/collaboration applications)
- **Convergence:** High on core fields (id, key, title, description, status, priority, assignee, project_id)
- **Dependencies:** Requires User, Organization/Project objects
- **Complexity:** Very High (workflows, custom fields, dependencies, automation, SLAs)

**Recommendation:** **Extension Pack / Domain**

**Rationale:**
- Common in enterprise/collaboration but not universal
- Strong canonical model with high convergence
- Represents distinct domain (work management/collaboration)
- Very high complexity (workflows, state machines, custom fields) suggests specialized domain pack
- Would fit as "Work Management" or "Collaboration" extension pack

**OODS Approach:**
- Core traits: Identifiable, Statusable, Timestamped, Assignable
- Domain-specific traits: Workflowable, Prioritizable, Dependable, Trackable (time tracking)
- Contexts: List (task board), Detail (task view), Form (task editor), Timeline (task history)

---

## R20.10: Settings, Preferences, and Configuration

**Canonical Object:** Configuration/Preference (three distinct models)

**Analysis:**
- **Coverage:** Universal (appears in 100% of applications)
- **Convergence:** Low (three distinct models: User Preferences, Enterprise Config, Feature Flags)
- **Dependencies:** Requires User, Organization objects
- **Complexity:** High (hierarchical scoping, schema validation, feature flag targeting)

**Recommendation:** **Core Design System (federated model)**

**Rationale:**
- Universal requirement (every app has settings)
- However, the report correctly identifies that a single model is an anti-pattern
- Three distinct services needed: User Preferences (JSONB), Enterprise Config (relational), Feature Flags (evaluation engine)
- User Preferences should be a core trait "Preferenceable" on User object
- Enterprise Config and Feature Flags are infrastructure concerns

**OODS Approach:**
- Core trait: Preferenceable (on User object, JSONB storage)
- Core infrastructure: Configuration Service (enterprise settings)
- Core infrastructure: Feature Flag Service (dynamic flags)
- Contexts: Form (settings/preferences UI)

---

## Summary Matrix

| Report | Object | Coverage | Convergence | Recommendation | Rationale |
|--------|--------|----------|-------------|----------------|-----------|
| R20.1 | Notification | 80-90% | High | Extension Pack | Communication domain, not universal quintet |
| R20.2 | Asset | 70-85% | High | Extension Pack | Media domain, high complexity |
| R20.3 | Comment/Review | 85-95% | High | Extension Pack | Social/engagement domain |
| R20.4 | Appointment | 60-75% | High | Extension Pack | Scheduling domain, specialized |
| R20.5 | Activity/Event | 90-100% | High | **Core Trait** | Nearly universal, foundational pattern |
| R20.6 | Message | 85-95% | High | Extension Pack | Communication domain |
| R20.7 | Category/Tag | 90-100% | High | **Core Trait** | Nearly universal, classification pattern |
| R20.8 | Cart | 50-70% | High | Extension Pack | Commerce domain, specialized |
| R20.9 | WorkItem | 70-85% | High | Extension Pack | Work management domain |
| R20.10 | Preferences | 100% | Low (3 models) | **Core Trait** | Universal, but federated architecture |

---

## Recommended Extension Packs

1. **Communication Pack**
   - Notifications (R20.1)
   - Messages (R20.6)
   - Shared traits: Channelable, Deliverable, Receiptable

2. **Content Management Pack**
   - Assets (R20.2)
   - Comments/Reviews (R20.3)
   - Categories/Tags (R20.7 - if not core)
   - Shared traits: Classifiable, Moderatible, Versionable

3. **Commerce Pack**
   - Cart (R20.8)
   - (Would integrate with Transaction from Universal Quintet)
   - Shared traits: Snapshotable, Mergeable, Expirable

4. **Work Management Pack**
   - WorkItems (R20.9)
   - Shared traits: Workflowable, Assignable, Dependable

5. **Scheduling Pack**
   - Appointments (R20.4)
   - Shared traits: Schedulable, Resourceable, Recurrable

---

## Core Traits to Add

1. **Eventable/Auditable** (from R20.5)
   - Actor-Action-Entity-Context-Timestamp pattern
   - Can be composed into any object needing audit/activity tracking

2. **Classifiable/Taxonomizable** (from R20.7)
   - Supports hierarchical (Category) and flat (Tag) classification
   - Can be applied to Product, Content, or any object

3. **Preferenceable** (from R20.10)
   - User-level preferences stored as JSONB
   - Notification preferences, UI preferences, etc.

---

## Deep Dive: Most Canonical Domain

### Winner: Category/Tag/Taxonomy (R20.7)

**Why it's the most canonical:**

1. **Universal Coverage:** Appears in 90-100% of content/product applications. Even applications without explicit categories use implicit classification (e.g., file folders, project groupings).

2. **Foundational Research Recognition:** Listed as #5 in "The Top 20 Canonical Data Schemas" foundational research, directly after the Universal Quintet (User, Product, Transaction, Organization).

3. **High Convergence:** Strong field convergence (id, name, slug, parent_id) across all platforms, regardless of implementation philosophy.

4. **Foundational Dependency:** Other objects (Product, Content, Asset) depend on classification. It's a cross-cutting concern that enables organization, search, and navigation.

5. **Minimal Dependencies:** Only requires polymorphic entity relationships - doesn't depend on other complex domain objects.

**Comparison to other candidates:**
- **Activity/Event Log (R20.5):** Also 90-100% coverage, but has 4 distinct use cases (analytics, audit, observability, activity feeds) that diverge significantly in implementation. More foundational but less unified.
- **Preferences (R20.10):** 100% coverage, but requires THREE distinct services/models, not a single canonical pattern. More universal requirement but less canonical structure.

**Conclusion:** Category/Tag is the most canonical because it has both universal coverage AND a unified, convergent model that can be applied consistently across domains.

---

## Complications and Challenges in Core Traits

### 1. Eventable/Auditable (R20.5) - "The Four Faces Problem"

**The Core Challenge:** The report explicitly states: *"The term 'event log' is dangerously ambiguous across the enterprise."*

**Four Distinct Models:**
1. **Analytics Events** (Segment, Mixpanel) - User behavior tracking, mutable user profiles
2. **Audit Events** (AWS CloudTrail, Auth0) - Immutable compliance logs with request/response payloads
3. **Observability Events** (OpenTelemetry, Datadog) - System health with trace_id/span_id correlation
4. **Activity Feed Events** (LinkedIn, Facebook) - User-facing, aggregated, mutable read models

**Complications:**
- **Different Storage Patterns:** Analytics uses append-only streams + mutable profiles. Audit uses immutable hash-chained logs. Observability uses time-series with correlation. Activity feeds use CQRS read models.
- **Different Compliance Regimes:** GDPR "Right to be Forgotten" vs HIPAA/SOC2 "immutable audit" creates fundamental conflict requiring pseudonymization architecture.
- **Different Read Patterns:** Analytics queries by user properties. Audit queries by actor/action. Observability queries by trace_id. Activity feeds query by user + aggregation rules.
- **Schema Divergence:** While Actor-Action-Entity pattern converges, the "Context" payload diverges wildly (analytics properties vs audit requestParameters vs observability attributes).

**OODS Implementation Challenge:**
- Can't be a single trait - needs to be **four distinct traits or a trait with four modes:**
  - `AnalyticsEventable` - for user behavior tracking
  - `Auditable` - for compliance logs
  - `Observable` - for system telemetry
  - `ActivityFeedable` - for user-facing feeds
- Or: A single `Eventable` trait with a `event_type` enum that changes storage/query behavior
- **Recommendation:** Start with `Auditable` as core (most foundational), add others as extension traits

---

### 2. Classifiable/Taxonomizable (R20.7) - "The Taxonomy vs Folksonomy Divide"

**The Core Challenge:** Two fundamentally different philosophies with different storage patterns, performance characteristics, and governance models.

**Two Divergent Models:**
1. **Taxonomy (Controlled Vocabulary)** - Top-down, hierarchical, read-optimized, admin-governed
   - Storage: Hierarchical (Adjacency List, Materialized Path, Closure Table)
   - Use: E-commerce, knowledge bases
   - Performance: Read-heavy, write-rare
   
2. **Folksonomy (User-Generated Tags)** - Bottom-up, flat, write-optimized, community-governed
   - Storage: Simple M:M join table
   - Use: Social platforms, content sites
   - Performance: Write-heavy, requires governance tools

**Complications:**
- **Storage Pattern Conflict:** Hierarchical taxonomies need parent_id, path, or closure tables. Flat tags need simple M:M. Can't use same storage for both efficiently.
- **Governance Complexity:** Taxonomies are admin-controlled. Folksonomies require synonym mapping, merging, spam detection - completely different tooling.
- **Query Patterns:** Taxonomy queries use tree traversal (LIKE 'path%'). Tag queries use simple joins. Different indexing strategies.
- **WordPress Hybrid Model:** The "gold standard" uses THREE tables (terms, term_taxonomy, term_relationships) to support both simultaneously - complex but flexible.

**OODS Implementation Challenge:**
- Need to support BOTH patterns, not force one
- **Recommendation:** Two traits or a trait with mode:
  - `Taxonomizable` - for hierarchical, controlled vocabularies
  - `Taggable` - for flat, user-generated tags
  - Or: `Classifiable` trait with `classification_type: 'taxonomy' | 'tag'` that changes behavior
- **Storage Decision:** Must allow implementer to choose storage pattern (hierarchy vs flat) based on use case
- **UI Impact:** Taxonomy needs tree navigation. Tags need autocomplete/cloud. Different UI components.

---

### 3. Preferenceable (R20.10) - "The Three-Service Anti-Pattern"

**The Core Challenge:** The report's primary finding is that a single canonical model is an **anti-pattern**. Three fundamentally different services are required.

**Three Distinct Services:**
1. **User Preference Service** - JSONB column, high-read, low-stakes, user-scoped
2. **Enterprise Configuration Service** - Relational tables, low-velocity, high-stakes, org-scoped with auditing
3. **Feature Management Service** - Evaluation engine, high-velocity, context-based targeting

**Complications:**
- **Storage Conflict:** JSONB (flexible, fast) vs Relational (auditable, typed) vs In-Memory Evaluation (real-time rules)
- **Scoping Conflict:** User-level (simple) vs Hierarchical (User > Team > Org) vs Context-based (flexible rules)
- **Velocity Conflict:** User prefs change frequently but are simple. Enterprise config changes rarely but needs deep auditing. Feature flags change constantly and need real-time evaluation.
- **Not a Single Trait:** Can't be one `Preferenceable` trait - needs three distinct implementations

**OODS Implementation Challenge:**
- **User Preferences:** Can be a trait `Preferenceable` on User object with JSONB storage
- **Enterprise Config:** Not a trait - it's infrastructure/service architecture
- **Feature Flags:** Not a trait - it's a separate evaluation service
- **Recommendation:** Only `Preferenceable` trait for User-level preferences. Enterprise Config and Feature Flags are infrastructure concerns, not object traits.

**Additional Complexity:**
- **Notification Preferences:** The two-axis Channel x Event-Type matrix is complex enough to be its own sub-trait or extension
- **Schema Evolution:** JSONB preferences need versioning strategy (version field in document)
- **UI Generation:** JSON Schema can drive UI, but requires schema registry and form generation infrastructure

---

## Revised Recommendations Based on Complications

### Eventable/Auditable
**Status:** Core Trait, but with caveats
- **Implementation:** Start with `Auditable` as core trait (most foundational)
- **Extension Traits:** `AnalyticsEventable`, `Observable`, `ActivityFeedable` as optional extensions
- **Architecture Note:** Must support pseudonymization for GDPR compliance

### Classifiable/Taxonomizable  
**Status:** Core Trait, but dual-mode
- **Implementation:** `Classifiable` trait with `mode: 'taxonomy' | 'tag'` parameter
- **Storage Flexibility:** Allow implementer to choose storage pattern
- **UI Impact:** Different UI components for taxonomy (tree) vs tags (autocomplete)

### Preferenceable
**Status:** Core Trait, but limited scope
- **Implementation:** `Preferenceable` trait ONLY for User-level preferences (JSONB)
- **Exclusions:** Enterprise Config and Feature Flags are infrastructure, not traits
- **Sub-trait:** Consider `NotificationPreferenceable` as specialized extension

---

## Questions for Clarification

1. Should Activity/Event Log be a core trait that all objects can compose, or a separate core object?
2. Should Categories/Tags be a core trait or part of Content Management extension pack?
3. How should the three distinct configuration models (User Prefs, Enterprise Config, Feature Flags) be represented in OODS?
4. Are there overlaps between extension packs that should be consolidated? (e.g., Communication pack combining Notifications + Messages)
5. Should Appointment/Booking be part of a larger "Service Management" pack that might include other service-related objects?
6. **NEW:** For Eventable trait - should we implement as single trait with modes, or separate traits for each use case (Analytics, Audit, Observability, Activity Feed)?
7. **NEW:** For Classifiable trait - should we force one storage pattern or allow implementer choice between taxonomy (hierarchical) and tag (flat) models?
8. **NEW:** Should Enterprise Configuration and Feature Flags be excluded from OODS traits entirely, treated as infrastructure services?

