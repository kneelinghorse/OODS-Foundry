# Sprint 30 MCP Setup - Story Audit Workflow

## ✅ **Recommended: Native Claude Code Tools (Simpler)**

For Sprint 30's systematic story audits, you DON'T need the MCP server. Claude Code can directly read/edit files and run CLI commands.

### Quick Start (3 Steps)

```bash
# 1. Start Storybook
pnpm storybook
# Runs at: http://localhost:6006

# 2. Verify accessibility addon works
#    - Open any story in Storybook
#    - Check bottom toolbar → "Accessibility" tab
#    - Should show violation counts/details

# 3. You're ready! Agent can now:
#    - Read stories/components
#    - Run: pnpm a11y:check
#    - Edit files directly
#    - Validate fixes in Storybook
```

### Agent Workflow (No MCP Server Needed)

**Step 1: Navigate Story in Storybook**
```bash
# Agent tells you:
"Open http://localhost:6006"
"Navigate to: Communication/MessageTimeline/Default"
```

**Step 2: Check for Violations**
```bash
# Agent runs a11y check via CLI:
pnpm a11y:check --story="communication-messagetimeline--default"

# Or you manually check:
# - Open story in Storybook
# - Click Accessibility tab (bottom toolbar)
# - Note violations
```

**Step 3: Agent Proposes Fixes**
```typescript
// Agent reads the component
Read: src/components/communication/MessageTimeline.tsx

// Agent identifies issue:
// Line 45: color: var(--ref-gray-500); /* 2.1:1 contrast - FAIL */

// Agent proposes fix:
// Change to: color: var(--sys-fg-secondary); /* 4.6:1 contrast - PASS */
```

**Step 4: Agent Applies Fix**
```typescript
// Agent edits file directly
Edit: src/components/communication/MessageTimeline.tsx
  old_string: "color: var(--ref-gray-500);"
  new_string: "color: var(--sys-fg-secondary);"

// Hot reload triggers automatically
// Storybook refreshes
```

**Step 5: Validate**
```bash
# Agent re-checks:
pnpm a11y:check --story="communication-messagetimeline--default"
# Or you check Storybook Accessibility panel: 0 violations ✅

# Visual inspection in Storybook
# Take screenshot for audit log
```

**Step 6: Document**
```json
// Agent appends to artifacts/quality/story-audit-log.json
{
  "storyId": "communication-messagetimeline--default",
  "timestamp": "2025-11-23T12:34:56Z",
  "violations": [
    {
      "type": "contrast",
      "element": ".message-timestamp",
      "before": "2.1:1 (--ref-gray-500)",
      "after": "4.6:1 (--sys-fg-secondary)",
      "fix": "src/components/communication/MessageTimeline.tsx:45"
    }
  ],
  "status": "completed"
}
```

---

## 🔧 **Alternative: HTTP Bridge + Storybook Panel**

**Use this if you want GUI-based task queue and approval workflow.**

### Prerequisites
```bash
# Check packages exist
ls packages/mcp-server/
ls packages/mcp-bridge/
```

### Startup Sequence (3 terminals)

**Terminal 1: MCP Server**
```bash
pnpm --filter @oods/mcp-server run dev
# Starts stdio MCP server
# Listens for tool calls from bridge
```

**Terminal 2: HTTP Bridge**
```bash
pnpm --filter @oods/mcp-bridge run dev
# Starts HTTP bridge at http://127.0.0.1:4466
# Exposes MCP tools as REST endpoints
# Serves artifacts at /artifacts/*
```

**Terminal 3: Storybook**
```bash
pnpm storybook
# Starts Storybook at http://localhost:6006
# Agent panel connects to bridge automatically
```

### Validation

1. **Check MCP Server**
   ```bash
   # Should see: "MCP server ready on stdio"
   ```

2. **Check HTTP Bridge**
   ```bash
   curl http://127.0.0.1:4466/health
   # Should return: {"status":"ok"}

   curl http://127.0.0.1:4466/tools
   # Should list available tools
   ```

3. **Check Storybook Panel**
   - Open http://localhost:6006
   - Navigate to any story
   - Look for "Agent Panel" in bottom toolbar
   - Should show task queue interface

4. **Test Tool Execution**
   - In Storybook Agent Panel:
   - Select tool: `a11y.scan`
   - Add to queue
   - Preview changes
   - Should show a11y report

### Troubleshooting

**Bridge unreachable from Storybook**
```bash
# Check CORS is allowing localhost:6006
# In mcp-bridge logs, should see CORS allow for Storybook origin

# Override bridge URL in Storybook console:
window.__OODS_AGENT_BRIDGE_ORIGIN__ = 'http://127.0.0.1:4466';
```

**MCP Server not responding**
```bash
# Rebuild server
pnpm --filter @oods/mcp-server run build

# Check for errors in terminal 1
# Verify artifacts directory exists:
ls packages/mcp-server/artifacts/
```

**Storybook Panel not visible**
```bash
# Check panel is registered in .storybook/main.ts
# Should see agent panel addon

# Clear Storybook cache:
rm -rf node_modules/.cache/storybook
pnpm storybook
```

---

## 📊 **Comparison: Which Approach for Sprint 30?**

| Aspect | Native Tools | HTTP Bridge + Panel |
|--------|--------------|---------------------|
| **Setup complexity** | ⭐⭐⭐⭐⭐ Simple (1 command) | ⭐⭐ Complex (3 processes) |
| **Edit speed** | ⭐⭐⭐⭐⭐ Instant | ⭐⭐⭐ HTTP round-trip |
| **Debugging** | ⭐⭐⭐⭐⭐ Direct file access | ⭐⭐ Bridge + server logs |
| **Approval workflow** | ⭐⭐⭐ CLI-based | ⭐⭐⭐⭐⭐ GUI-based |
| **Telemetry** | ⭐⭐⭐ File-based logs | ⭐⭐⭐⭐⭐ Incident tracking |
| **Automation** | ⭐⭐⭐⭐⭐ Best for batch | ⭐⭐⭐ Best for manual |

**For Sprint 30 (100+ story audits):** ✅ **Use Native Tools**
- Faster iteration
- Fewer moving parts
- Better for systematic automation

**For manual review/approval:** Use HTTP Bridge + Panel
- Better for stakeholder review
- Visual diff previews
- Audit trail with incident IDs

---

## 🚀 **Validation Test (Native Tools)**

Let's validate with a sample story:

```bash
# Terminal 1: Start Storybook
pnpm storybook

# Terminal 2: Agent validates workflow
```

**Agent Task: Audit MessageTimeline/Default**
1. Read component: `src/components/communication/MessageTimeline.tsx`
2. Check for hardcoded colors or low-contrast tokens
3. Run CLI check: `pnpm a11y:check`
4. If violations found:
   - Propose token replacement
   - Edit file
   - Re-validate
5. Document in audit log

**Success Criteria:**
- ✅ Agent can read component
- ✅ Agent can identify violations
- ✅ Agent can edit file
- ✅ Hot reload triggers
- ✅ Violations resolved
- ✅ Audit log entry created

---

## 📝 **Next Steps**

**Option A: Native Tools (Recommended)**
```bash
# 1. Start Storybook
pnpm storybook

# 2. Tell agent: "Begin B30.1 - validate workflow on MessageTimeline/Default"
# Agent will:
#   - Read component
#   - Check for violations
#   - Propose fixes
#   - Apply fixes
#   - Validate
#   - Document
```

**Option B: HTTP Bridge (if you prefer GUI)**
```bash
# Terminal 1
pnpm --filter @oods/mcp-server run dev

# Terminal 2
pnpm --filter @oods/mcp-bridge run dev

# Terminal 3
pnpm storybook

# Then use Storybook Agent Panel for task queue
```

**Which would you like to use?**
