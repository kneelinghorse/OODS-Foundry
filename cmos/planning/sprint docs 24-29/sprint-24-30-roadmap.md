# OODS Foundry Roadmap: Sprint 24-30

**Date:** 2025-11-16  
**Status:** Planning  
**Source:** Synthesized from R20/R21 research + Sprint 21-23 learnings

---

## 🗺️ **The Full Vision (Sprint 21-30)**

### **Phase 1: Visualization Extension Pack (Sprint 21-23)** ✅ COMPLETE

**Sprint 21:** Foundation (7 missions) ✅
- 10 viz traits, Normalized Viz Spec, Vega-Lite adapter
- 2 charts (bar, line), viz tokens, a11y suite

**Sprint 22:** Scale-Out (8 missions) ✅
- ECharts adapter, interactions (Highlight + Tooltip)
- 3 more charts (scatter, area, heatmap)
- Pattern library v1 (11 patterns), performance benchmarks

**Sprint 23:** Complex Patterns (9 missions) ✅
- Layout traits (Facet, Layer, Concat)
- Advanced interactions (Filter, Zoom, Brush)
- Pattern library v2 (20+ patterns), dashboard contexts
- Figma handshake, CI telemetry

**Status:** Visualization system production-ready ✅

---

### **Phase 2: Core Trait Expansion (Sprint 24-27)** - Research Complete

**From R21 Research Synthesis:**

**Sprint 24: Addressable Trait** (7-8 missions)
- Multi-role address management (billing, shipping, warehouse)
- International format support (UPU S42 templates)
- Validation lifecycle (unvalidated → validated → enriched)
- Google Address Validation API integration
- Geocoding support

**Sprint 25: Classifiable Trait** (7-8 missions)
- Category hierarchy (ltree storage, <3ms queries)
- Tag/folksonomy support
- Hybrid mode (WordPress three-table pattern)
- Synonym mapping, tag merging, spam detection
- UI components (tree picker, tag autocomplete)

**Sprint 26: Preferenceable Trait** (6-7 missions)
- User-level preferences (JSONB storage)
- JSON Schema → UI generation (react-jsonschema-form)
- Schema evolution (lazy read-repair, eager migration)
- Notification preferences (Channel × Event-Type matrix)
- Performance optimization (Redis cache, GIN index)

**Sprint 27: Auditable Trait** (8-9 missions)
- Immutable audit log (Universal Event Quintet pattern)
- GDPR compliance (pseudonymization, crypto-shredding)
- Merkle tree integrity (not linear chains)
- TimescaleDB tiered storage (hot/warm/cold)
- Query performance (composite B-tree index)

**Status:** All research complete (R21.1-R21.5), ready for implementation

---

### **Phase 3: Extension Pack Scale-Out (Sprint 28-30)** - Research Complete

**Sprint 28: Authorization Extension Pack** (8-9 missions)
- Multi-tenant RBAC (5-table canonical model)
- Hierarchical roles (inheritance)
- Separation of duty (SoD) constraints
- Permission system (resource + action pairs)
- Integration with User/Organization traits

**Sprint 29: Communication Extension Pack** (7-8 missions)
- Notification system (from R20.1)
- Message/conversation system (from R20.6)
- Multi-channel orchestration
- Delivery state tracking
- Preference-driven routing

**Sprint 30: Content Management Extension Pack** (7-8 missions)
- Media/asset management (from R20.2)
- Comment/review system (from R20.3)
- Transformation pipelines
- CDN delivery patterns
- Moderation workflows

**Status:** Core research complete (R20.1-10), ready for planning

---

## 🎯 **Two Parallel Tracks**

**We actually have TWO complete roadmaps ready:**

### **Track A: Continue Viz (Sprint 24)**
**Option:** Geospatial + Polish
- RDS.10 covers geospatial (v1.1 ready)
- Hierarchy/Network (v2.0 requires server transform engine)
- Polish & showcase examples

### **Track B: Core Traits (Sprint 24-27)**
**Option:** Addressable → Classifiable → Preferenceable → Auditable
- All research complete (R21.1-R21.5)
- Expands Universal Quintet (3 → 7 core traits)
- Foundation for extension packs

**Decision needed:** Continue viz depth OR pivot to core traits breadth?

---

## 💭 **Sprint 24 Decision Framework**

### **Option 1: Viz Geospatial** (6-7 missions)
**Pros:**
- Completes atomic viz patterns
- RDS.10 research ready
- Natural continuation of Sprint 21-23
- Adds 10% coverage

**Cons:**
- More viz before core system expands
- Hierarchy/Network deferred (requires server engine)

### **Option 2: Viz Polish** (5-6 missions)
**Pros:**
- Showcase what we built
- Production hardening
- Documentation synthesis
- Real-world examples

**Cons:**
- Doesn't add new capabilities
- Delays trait expansion

### **Option 3: Core Trait (Addressable)** (7-8 missions)
**Pros:**
- Diversifies system (not just viz)
- Foundational capability (80-90% apps need it)
- R21.1 research complete
- Enables extension packs in Sprint 28-30

**Cons:**
- Pauses viz momentum
- Context switch to different domain

### **Option 4: Hybrid** (10-12 missions)
**Pros:**
- Viz polish + Start Addressable
- Parallel work possible
- Maximum progress

**Cons:**
- Larger sprint scope
- Split focus

---

## 🎖️ **My Recommendation**

**Sprint 24: Viz Polish + Storybook Fixes (6-7 missions)**

**Why:**
1. Solidify 3 sprints of viz work before expanding
2. Address Storybook issues you mentioned
3. Create showcase examples
4. Write synthesis documentation
5. Natural pause before switching to core traits

**Then:**
- Sprint 25-27: Core traits (Addressable, Classifiable, Preferenceable)
- Sprint 28-30: Extension packs

**This gives viz system time to "bake" before adding geospatial complexity.**

---

## 📊 **By Phase Metrics**

| Phase | Sprints | Missions | Status |
|-------|---------|----------|--------|
| Viz Foundation | 21-23 | 24 | ✅ Complete |
| Core Traits | 24-27 | ~30 | Research ready |
| Extension Packs | 28-30 | ~24 | Research ready |
| **Total** | **10 sprints** | **~78 missions** | **30% complete** |

---

## 🔄 **Full Cycle**

**Sprint 20:** v1.0 RC freeze  
**Sprint 21-23:** Visualization system ✅  
**Sprint 24:** Polish + Storybook fixes  
**Sprint 25-27:** Core trait expansion  
**Sprint 28-30:** Extension packs  
**Sprint 31+:** System maturity, optimization, adoption

---

**This is the Sprint 21-30 roadmap you were looking for!**

Does this align with what you remember planning?

