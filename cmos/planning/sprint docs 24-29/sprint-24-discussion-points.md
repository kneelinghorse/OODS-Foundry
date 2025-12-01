# Sprint 24 Discussion Points & Recommendations

**Date:** 2025-11-16  
**Context:** Post-Sprint 23 review, planning Sprint 24  
**Status:** Active discussion

---

## 1️⃣ **Roadmap Documentation (Sprint 21-30)**

### ✅ **FOUND - Roadmap Exists in R21 Research**

**Primary source:** `cmos/planning/R21_Research_Synthesis.md`

**Synthesized into:** `cmos/planning/sprint-24-30-roadmap.md` (just created)

### **The Full 10-Sprint Plan:**

**Phase 1: Visualization (Sprint 21-23)** ✅ COMPLETE
- Sprint 21: Foundation (10 traits, 2 charts, VL adapter)
- Sprint 22: Scale-out (ECharts, interactions, 5 charts, patterns)
- Sprint 23: Complex (layouts, advanced interactions, dashboard contexts)

**Phase 2: Core Traits (Sprint 24-27)** - Research complete
- Sprint 24: **Addressable** trait (multi-role addresses, international, validation)
- Sprint 25: **Classifiable** trait (categories, tags, ltree storage)
- Sprint 26: **Preferenceable** trait (user preferences, JSON Schema UI)
- Sprint 27: **Auditable** trait (immutable logs, GDPR, Merkle trees)

**Phase 3: Extension Packs (Sprint 28-30)** - Research complete
- Sprint 28: **Authorization** pack (RBAC, multi-tenant, hierarchical roles)
- Sprint 29: **Communication** pack (Notifications + Messages)
- Sprint 30: **Content Management** pack (Media + Comments)

**Status:** All research for Sprint 24-30 is complete (R20.1-10, R21.1-5)

---

## 2️⃣ **Storybook Token Collision Warnings**

### **Current Issue:**
```
Token collisions detected (758):
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

### **Analysis:**

**What's happening:**
- Storybook static build includes token CSS multiple times
- Dev server vs static build have different chunking strategies
- Warning about bundle size, not actual token conflicts
- "758 collisions" = chunk size warning, not duplicate tokens

**Is this a problem?**
- ❌ Not a blocker - Storybook works
- ⚠️ Annoying - clutters build output
- ✅ Verifiable - can inspect bundles

**Root cause (likely):**
1. Token CSS imported in multiple places (.storybook/preview.ts lines 2-4)
2. Vite/Rollup chunking duplicates CSS across chunks
3. Static build warning threshold exceeded

### **Recommended Approach:**

**Option A: Quick Fix (5 minutes)**
```typescript
// In .storybook/main.ts or vite config
build: {
  chunkSizeWarningLimit: 2000  // Increase from default 500
}
```
**Pros:** Silences warning immediately
**Cons:** Doesn't address root cause

**Option B: Consolidate imports (1-2 hours)**
- Single token CSS import point
- Ensure no duplicate imports across stories
- Optimize Vite chunking config
**Pros:** Fixes root cause
**Cons:** Needs testing to ensure all stories still work

**Option C: Research mission (not recommended)**
- Deep dive on Storybook + Vite chunking
**Pros:** Complete understanding
**Cons:** Overkill for warning that doesn't affect functionality

### **My Recommendation:**

**Defer to Sprint 24 "Polish" mission** as quick fix:
- Not blocking current work
- Can be bundled with other Storybook improvements
- 30-minute fix during polish sprint

**NOT worth dedicated research mission** - this is known Vite behavior with CSS imports.

---

## 3️⃣ **Database Snapshot Verbosity**

### **Current State: 80 Snapshots**

**Your question:** Is this too much or just right?

### **My Analysis:**

**Snapshot growth pattern:**
- Sprint 23: Captured ~71 snapshots in one sprint
- That's ~7-8 snapshots per mission
- Reflects: start mission, intermediate updates, complete mission

**What's being captured:**
- Mission start (mission_runtime)
- Mission intermediate progress (various tools updating context)
- Mission completion (mission_runtime)
- Sprint planning sessions
- Strategic decision updates

### **Is This Helpful? YES ✅**

**Why verbosity is GOOD:**

1. **Complete audit trail:**
   - Can trace exactly when decisions made
   - Can see context evolution during complex missions
   - Can replay "what did we know when"

2. **Debugging:**
   - If something goes wrong, can pinpoint when
   - Can compare "before" vs "after" snapshots
   - Can identify when drift occurred

3. **Learning:**
   - Can see how context evolved across sprint
   - Can identify patterns (which missions add most decisions)
   - Can optimize future sprints

4. **Searchable:**
   - SQL queries make it easy to find specific moments
   - Can filter by date range, source, content changes
   - More data = better insights

**Is it too much? NO ❌**

**Why:**
- Storage: 80 snapshots × ~50KB each = ~4MB (trivial)
- Query performance: Indexed by context_id + created_at (fast)
- Utility: High value for project memory

### **Recommended Policy:**

**Keep current verbosity** with optional cleanup:

```sql
-- Optional: Keep last 200 snapshots (deletes oldest)
DELETE FROM context_snapshots 
WHERE id NOT IN (
  SELECT id FROM context_snapshots 
  ORDER BY created_at DESC 
  LIMIT 200
);
```

**But honestly:** At current rate (~80 snapshots/sprint), you'd need 10+ more sprints to hit 1000 snapshots. Storage/performance not a concern yet.

**My vote:** Keep it verbose! The audit trail is incredibly valuable.

---

## 4️⃣ **Documentation Synthesis**

### **Current Documentation State:**

**Viz documentation:**
- 11 doc pages in docs/viz/
- Pattern libraries (v1 and v2)
- Component guides
- Research reports (10 reports in cmos/research/data-viz-oods/)

**Gap:** No single "Viz System Overview" that synthesizes 3 sprints

### **Recommendation:**

**Yes, synthesis needed** - Natural point for it!

**Suggested Sprint 24 missions:**
1. **Viz System Overview** (synthesis doc)
   - Sprint 21-23 journey
   - Architecture decisions
   - Getting started guide
   - Migration guide for adding viz to existing apps

2. **Storybook Polish** (fixes + improvements)
   - Fix token collision warning
   - Navigation taxonomy cleanup
   - Add viz pattern showcase section
   - Improve visual inspection workflow

3. **Best Practices Guide** (from learnings)
   - Chart selection decision tree
   - Performance optimization tips
   - A11y checklist
   - Common pitfalls

**This creates natural break before switching to core traits (Sprint 25-27).**

---

## 🎯 **Sprint 24 Proposed Scope**

### **"Viz Polish & System Documentation"** (6 missions)

**B24.1:** Viz System Overview Documentation
- Synthesis of Sprint 21-23
- Architecture guide
- Getting started
- Migration guide

**B24.2:** Storybook Improvements
- Fix token collision warning
- Navigation improvements
- Viz pattern showcase section
- Build optimization

**B24.3:** Best Practices Guide
- Chart selection guide
- Performance tips
- A11y checklist
- Anti-patterns

**B24.4:** Real-World Dashboard Examples
- User adoption dashboard (real data)
- Subscription analytics dashboard
- Product metrics dashboard
- All with code + Figma designs

**B24.5:** Performance Optimization Pass
- Bundle size optimization
- Lazy loading for unused renderers
- Tree-shaking improvements
- Memory optimization for facet grids

**B24.6:** Sprint 24 Close & Sprint 25-27 Planning
- Retrospective
- Prepare for core trait expansion
- Update master context

---

## 💡 **Recommendations Summary**

### **Question 1: Roadmap**
✅ **Found** - Documented in R21_Research_Synthesis.md  
✅ **Consolidated** - Created sprint-24-30-roadmap.md  
✅ **Decision:** Sprint 24 = Polish, Sprint 25-27 = Core Traits, Sprint 28-30 = Extension Packs

### **Question 2: Storybook**
⚠️ **Not blocking** - Works fine, just warning  
✅ **Fix in Sprint 24** - Bundle with polish mission  
❌ **No research needed** - Known Vite chunking behavior  
✅ **Quick wins:** Adjust chunkSizeWarningLimit, consolidate imports

### **Question 3: Database Snapshots**
✅ **Verbosity is GOOD** - Complete audit trail invaluable  
✅ **Keep it** - Storage/performance not a concern  
✅ **Optional cleanup** - Can trim to last 200 if ever needed  
💡 **My vote:** More data is better for project memory

### **Question 4: Documentation Synthesis**
✅ **Yes, natural time** - 3 sprints of viz work needs synthesis  
✅ **Include in Sprint 24** - Polish mission perfect opportunity  
✅ **Deliverables:** System overview, best practices, migration guide

---

## 🚀 **Proposed Sprint 24 Direction**

**"Viz Polish & Documentation Synthesis"** (6 missions)

**Goals:**
1. Synthesize Sprint 21-23 learnings
2. Fix Storybook annoyances
3. Create production examples
4. Optimize performance
5. Document best practices
6. Prepare for core trait expansion (Sprint 25-27)

**Rationale:**
- Natural break after 3 intense viz sprints
- Addresses your Storybook concerns
- Creates synthesis documentation
- Sets up clean transition to core traits
- Lower intensity sprint (polish vs new features)

**After Sprint 24:**
- Viz system polished and documented
- Storybook working smoothly
- Ready to switch gears to core traits (Sprint 25-27)

---

## ❓ **Your Turn**

Do you want to:
1. **Proceed with Sprint 24 Polish** (6 missions as outlined above)?
2. **Jump straight to Sprint 25 (Addressable)** and defer polish?
3. **Adjust Sprint 24 scope** (add/remove missions)?

**My strong recommendation:** Sprint 24 Polish - it addresses your Storybook concerns, creates needed documentation, and provides a natural transition point.

What do you think?

