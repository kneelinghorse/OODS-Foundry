## **Introduction**

Design systems shape how we build, but what they shape — and what they miss — matters more as teams and tools change. In *Beyond Components*, I stepped back from the widget catalog and argued for something deeper: the real power in digital products isn’t the buttons or cards, but the recurring objects and relationships that drive everything behind the UI.

Most systems stop at neatly packaged components, leaving the heavy lifting—status logic, timelines, monetary formatting—hidden as scattered, repetitive code. That drift between a design system’s abstractions and the business’s actual logic is more than inconvenience; it’s friction that slows teams, muddles meaning, and lets complexity creep in.

OODS Foundry is the step where theory turns practical. It’s an object-oriented design system built around the core patterns underlying every digital product: User, Product, Transaction, Organization, Relationship. Instead of composing another set of props for every new component, OODS invites you to describe the essential objects once and let the system handle the rest.

If your team spends cycles tweaking status badges in twenty places, or re-wires business states and permissions by hand, OODS’s approach — composable traits, dependency-aware object composition, and context-driven theming — can radically raise the ratio of thinking to typing.

But there’s something bigger afoot. As generative agents move from concept to practice, the systems we build need to speak their language too. OODS is designed for a future where “designing for meaning” isn’t just a human task, but a shared language between humans and agents — making meaning the interface for both people and machine collaborators.

This article is a tour of how an object-oriented, agent-native system works when the philosophy actually runs in your codebase. Not a spec sheet — but an under-the-hood look at the architecture, design decisions, and the new workflows it unlocks.

## **From Components to Objects (for real this time)**

Traditional design systems ask you to build components by hand:

| \<SubscriptionCard   id={sub.id}  status={sub.status}  amount={sub.amount}  createdAt={sub.created\_at}  badges={renderBadges(sub.status)}  actions={renderActions(sub.status)}/\>\<InvoiceCard   id={inv.id}  status={inv.status}        // Duplicate status logic  amount={inv.amount}        // Duplicate currency formatting  dueDate={inv.due\_date}  badges={renderBadges(inv.status)}   // Copy-pasted  actions={renderActions(inv.status)} // Copy-pasted/\> |
| :---- |

Status logic, timestamps, currency formatting — repeated everywhere. When you discover a new lifecycle state or need to tighten contrast, you’re suddenly editing a dozen components.

OODS flips that around:

* **Traits** are small, reusable capabilities:

  * `statusable`: adds a status field \+ badge behavior

  * `timestamped`: adds created/updated timestamps \+ relative time display

  * `monetary`: adds amount \+ currency formatting

  * `lifecycle`: adds a state machine

  * `documentable`: adds attachments

  * `commentable`: adds discussion threads

* **Objects** are *compositions* of traits, plus any extra fields.

A `Subscription` stops being a custom React snowflake and becomes something like:

object: Subscription  
description: SaaS subscription with billing lifecycle

traits:  
  \- name: statusable  
    parameters:  
      states: \[incomplete, trialing, active, past\_due, canceled, unpaid\]

  \- name: timestamped  
    parameters:  
      recordedEvents: \[created, renewed, canceled, payment\_failed\]

  \- name: monetary  
    parameters:  
      currency: usd

  \- name: lifecycle  
    alias: SubscriptionLifecycle  
    parameters:  
      initialState: incomplete  
      transitions:  
        \- from: incomplete  
          to: \[active, canceled\]  
        \- from: active  
          to: \[past\_due, canceled\]

  \- name: documentable  
    parameters:  
      allowedTypes: \[invoice, receipt, contract\]

schema:  
  current\_period\_start:  
    type: timestamp  
    required: true  
  current\_period\_end:  
    type: timestamp  
    required: true

From that \~50 lines of YAML, OODS can generate:

* A type-safe `Subscription` interface

* Status enums with canonical labels and colors

* Timestamp formatting and relative “time ago” helpers

* Monetary formatting

* Attachments and comment regions if traits are present

* List \+ Detail context variants

* Tokens and stories wired up for light, dark, and high-contrast modes

* Visual and accessibility tests around those states

That’s the core move: *describe the object once* and let the system compose everything that’s mechanically derivable.

---

## **Pillar 1: The Trait Engine (how objects are actually built)**

Underneath all this is a compositor — a small engine that knows how to merge traits into a single, coherent object definition.

You can think of it as:

**Foundation → Base Object → Traits (sorted) → Object Overrides → Context**

A few important details:

### **1\. Dependency-aware composition**

Traits can depend on each other (`statusable` might assume `timestamped` is present). The compositor uses a dependency graph and topological sort to figure out a safe order: resolve base traits first, then stack more specialized ones on top.

### **2\. Collision resolution with provenance**

When traits provide the same field — say, two different traits both define `status` — OODS doesn’t just “last write wins” and hope for the best. It:

* Merges enums (union of values) where that makes sense

* Prefers stricter constraints over looser ones

* Marks required over optional

* Throws an error on incompatible types

Every field also carries provenance metadata: which trait it came from, which one “won” a conflict, and what alternatives exist. That provenance powers:

* Debugging (“why does this object have *these* status values?”)

* Documentation (objects can literally list which traits added which fields)

* Safe overrides (an object can explicitly choose `status` from Trait B instead of Trait A)

### **3\. View extensions instead of ad-hoc markup**

Traits don’t just add data; they can register *view extensions*:

viewExtensions:  
  \- region: comments  
    component: CommentThread  
    priority: 100  
    props:  
      comments: "{{object.comments}}"

  \- region: header  
    component: CommentCount  
    priority: 50  
    props:  
      count: "{{object.comments.length}}"

If an object composes `commentable`, the view engine knows:

* Render a `CommentThread` in the `comments` region

* Add a `CommentCount` badge in the header

* Wire actions and bindings for you

The result: you don’t invent a new “card” for every object. You give traits a few well-known regions to target, and the system fills them in.

---

## **Pillar 2: Contexts & Regions (the interface side of object thinking)**

In the Universal Quintet series, I called out the “universal data / diverse display” paradox: the same underlying objects drive wildly different interfaces — feeds vs audit logs vs dashboards vs forms.

OODS makes that paradox explicit by baking contexts into the system:

* **Four canonical contexts:** `list`, `detail`, `form`, `timeline`

* **Regions** inside each object: header, badges, body, meta, actions, comments, etc.

Instead of wiring special props everywhere (`compact`, `dense`, `layout="list"`), OODS uses context as a CSS contract:

/\* List context: dense, scannable \*/  
\[data-context="list"\] {  
  \--context-spacing-inset: var(--sys-space-inset-condensed);  
  \--context-text-scale: var(--sys-text-scale-body-sm);  
}

\[data-context="list"\] \[data-region="header"\] {  
  font-size: var(--sys-text-scale-heading-md);  
}

/\* Detail context: generous, readable \*/  
\[data-context="detail"\] {  
  \--context-spacing-inset: var(--sys-space-inset-default);  
  \--context-text-scale: var(--sys-text-scale-body-lg);  
}

\[data-context="detail"\] \[data-region="header"\] {  
  font-size: var(--sys-text-scale-heading-xl);  
}

Components themselves stay “pure”:

function SubscriptionCard({ data }: Props) {  
  return (  
    \<article data-object="subscription"\>  
      \<header data-region="header"\>{data.name}\</header\>  
      \<div data-region="badges"\>  
        \<StatusBadge status={data.status} /\>  
      \</div\>  
    \</article\>  
  );  
}

// Usage  
\<div data-context="list"\>  
  \<SubscriptionCard data={sub} /\>   {/\* Compact \*/}  
\</div\>

\<div data-context="detail"\>  
  \<SubscriptionCard data={sub} /\>   {/\* Expanded \*/}  
\</div\>

Same component, different context → different layout, spacing, and type scale — without conditional logic scattered across your codebase.

This is where the “universal data, diverse display” idea stops being a nice phrase and turns into an actual layout contract.

---

## **Pillar 3: Tokens, Semantics, and the Four-Layer Stack**

The other half of the story lives in the CSS. OODS uses a **four-layer token ladder** with strict ownership boundaries. It’s a bit of a pet obsession, but it quietly de-risks theming, dark mode, and forced colors — and it gives agents a clear semantic map to work with.

The layers:

| Layer | Namespace | Purpose |
| ----- | ----- | ----- |
| Reference | `--ref-*` | Raw scales and ramps, no product semantics |
| Theme | `--theme-*` | Brand/mode adaptation of reference values |
| System | `--sys-*` | Semantic contracts: surfaces, text, status |
| Component | `--cmp-*` | Context \+ component slots — what React reads |

### **1\. Reference (`--ref-*`)**

* Lives in `packages/tokens/src/tokens/base/reference/`

* Neutral/blue/green/amber/red/violet ramps, spacing primitives, etc.

* Values are raw (hex, dimensions), **never** chained.

* Think of this as the ink and paper: pure materials, no brand story yet.

### **2\. Theme (`--theme-*`)**

* Light theme (“Theme 0”) lives in `themes/theme0/**`.

* Dark seeds live in `themes/dark/**` under a `theme-dark` namespace.

* Theme tokens reference only `--ref-*`.

* `[data-theme="dark"]` remaps the same `--theme-*` hooks to dark values, so components don’t know or care which palette they’re on.

### **3\. System / Semantic (`--sys-*`)**

* Defined in `tokens/semantic/system.json`.

* These are the **meaningful** tokens:

  * Surfaces (e.g., `--sys-surface-raised`)

  * Text states (muted, strong, inverse)

  * Status roles (`info`, `success`, `warning`, `accent`, `critical`, `neutral`)

  * Focus rings, borders, spacing scales

* Components and contexts talk in this language: “status success text”, “danger surface”, “focus ring strong”. They don’t touch brand ramps directly.

### **4\. Context & Component Slots (`--cmp-*`)**

* Emitted from `tokens/semantic/components.json` and wired in `apps/explorer/src/styles/layers.css`.

Slots cascade from `--sys-*`, for example:

 :root {  
  \--cmp-chip-background: var(--sys-status-info-surface);  
  \--cmp-chip-text: var(--sys-status-info-text);  
}

\[data-tone="critical"\] {  
  \--cmp-chip-background: var(--sys-status-critical-surface);  
  \--cmp-chip-text: var(--sys-status-critical-text);  
}

\[data-context="list"\] {  
  \--cmp-chip-padding-inline: var(--sys-space-inline-xs);  
}

\[data-context="detail"\] {  
  \--cmp-chip-padding-inline: var(--sys-space-inline-sm);  
}

*   
* **Components only read `--cmp-*`.** No `--ref-*`, no `--theme-*`, no raw values in TSX.

In practice:

* `StatusChip.tsx` infers a status tone (`info`, `accent`, `success`, `warning`, `critical`, `neutral`) and sets `data-tone` only.

* `layers.css` maps each tone to chip slots (`--cmp-chip-background`, `--cmp-chip-border`, `--cmp-chip-text`) using the right `--sys-status-*` tokens.

* Context wrappers (`data-context="list" | "detail"`) adjust padding, density, and size using **only** `--cmp-*`.

The component has no awareness of themes, palettes, or ramps; it just trusts the contract.

### **Forced colors, dark mode, and Tailwind**

Because everything chains through `--theme-*` → `--sys-*` → `--cmp-*`, the cascade becomes a feature:

1. Light Theme 0 defines the default `--theme-*`.

2. `[data-theme="dark"]` remaps those hooks to `--theme-dark-*`.

3. `@media (forced-colors: active)` overrides the same `--theme-*` hooks with system colors, so high-contrast wins over dark mode automatically.

4. Tailwind extends colors with `var(--sys-...)`, and Storybook imports the generated CSS so you can see the whole round-trip live.

It’s not the headline innovation, but it means:

* Theme authors work at the theme layer.

* System designers work at the `--sys-*` semantic layer.

* Component authors stay inside `--cmp-*`.

And when an agent comes along, it has a clean, named map of meaning — not a bag of hex codes.

---

## **A Subscription, Seen the OODS Way**

In the subscriptions article, I walked through Stripe, Adyen, Zuora and showed how their different models — intents, notifications, orders — are really different opinions about time, risk, and control. The “translation layer” teams build between them is a mirror of those philosophies.

OODS bakes that translation layer into a **billing domain pack**:

domains/saas-billing/  
  ├── objects/  
  │   ├── Subscription.object.yaml  
  │   ├── Invoice.object.yaml  
  │   ├── Plan.object.yaml  
  │   └── Usage.object.yaml  
  ├── traits/  
  │   ├── billable.trait.yaml  
  │   ├── payable.trait.yaml  
  │   ├── refundable.trait.yaml  
  │   └── metered.trait.yaml  
  └── examples/  
      ├── stripe.json  
      └── chargebee.json

And a canonical status map:

{  
  "subscription": {  
    "incomplete": {  
      "tone": "warning",  
      "label": "Setup Required",  
      "icon": "clock"  
    },  
    "active": {  
      "tone": "success",  
      "label": "Active",  
      "icon": "check-circle"  
    },  
    "past\_due": {  
      "tone": "warning",  
      "label": "Past Due",  
      "icon": "alert-circle"  
    }  
  }  
}

Stripe, Chargebee, or your own billing system become **fixtures** that map into that canonical object. Both normalize into the same Subscription shape and feed the same views and status badges.

The interesting part isn’t “yay, abstraction.” It’s that this setup lets you:

* See provider quirks as *trait parameter differences* instead of scattered `if (provider === 'stripe')` blocks

* Run consistent timelines (from the authority/roles work) over events from multiple providers

* Let agents validate that every subscription state maps to a tone, label, and icon before it ever hits production

The “translation layer as mirror” becomes a reusable, testable asset, not a one-off integration script.

---

## **Authority and Relationships as Traits, Not Afterthoughts**

In the authority piece, I argued that roles, scopes, timelines, and relationships are just as much a design concern as layout. It’s the same objects again — User, Organization, Role, Permission — plus the relationships and facts that make the interface tell the truth.

OODS treats that as another domain of traits:

* `memberOf`: connects a user to organizations/teams

* `permissioned`: wires an object into your authz system (RBAC/ReBAC)

* `timeline`: standardizes event shape for UI and audit

* `approvable`: adds workflow state, approver metadata, and “approved by” UI hooks

From the system’s perspective, an “authority surface” (scope switcher, sharing dialog, audit trail) is just:

Base object (User / Dataset / Subscription) \+ membership traits \+ permission traits \+ timeline traits

Timelines become first-class regions that any object can opt into; events are standardized so you don’t reinvent “who did what, when, and why” for every feature.

Authority isn’t a special case. It’s just more traits on the same objects you’ve been using since the Quintet article.

---

## **Where Agents Actually Fit (and why OODS is agent-native)**

My view on agents keeps evolving, but the reality is simple: generative systems are no longer hypothetical. They’re arriving in enterprise stacks right now.

OODS is built to assume that:

* Agents will **read and write** your design system.

* UI and copy will increasingly be **generated from structured definitions**, not hand-wired one component at a time.

That’s why almost everything in OODS is:

* **Structured data first**

  * Objects, traits, and tokens all live as JSON/YAML.

  * The same definitions that drive React and CSS can be shipped as JSON over an API or exposed through MCP.

* **Semantic by design**

  * Traits carry names like `statusable`, `approvalRequired`, `memberOf`.

  * Tokens are `--sys-status-critical-text`, not `--red-600`.

  * Context is explicit: `data-context="list"`, `data-region="header"`, `data-tone="warning"`.

This matters for agents because it gives them a **vocabulary**:

* “Generate a new invoice detail view” has concrete anchors: the `Invoice` object, its traits, the `detail` context, the `status` system tokens, the `timeline` region.

* “Propose theme variants” means: adjust `--theme-*`, recompute `--sys-*`, preview `--cmp-*` across contexts — not spray-paint random hex values.

In the near term, agents in OODS are librarians and copy editors:

* They run token guardrails, a11y checks, visual regression, and token diff reports.

* They suggest semantic token mappings when you add a new state.

* They keep documentation in sync with the object and trait definitions.

Over time, the same structure makes it realistic to plug generative workflows into other tools:

* Expose OODS via MCP or a simple HTTP API so other systems (orchestration layers, design tools, internal CLIs) can pull **objects \+ traits \+ tokens** on demand.

* Let generative UI tools (think Penpot, Plasmic, or their successors) treat OODS as the semantic source of truth: “here’s what a Subscription is, here are the states, here’s how status surfaces should behave.”

* Allow agents to scaffold new flows by composing traits and contexts, then open those in a visual editor for human refinement.

"Agents propose, humans approve" stops being a slogan and turns into a circuit: structured data → generative proposal → human decision → updated source.

**A concrete example:** OODS's visualization extension (developed post-v1.0) demonstrates how far this structure-first approach scales. Charts aren't "pie chart components with props" — they're trait compositions that declare intent (Mark.Bar + Position.X + Position.Y + Scale.Linear) and compile to multiple renderers (Vega-Lite for grammar-purity, ECharts for Canvas performance). The same normalized spec that powers a React component can be queried by an agent, rendered server-side, or exported to Figma. Dashboards become composable facet grids using Layout traits that work with any OODS object. Interactive filters and zoom controls are declarative traits, not imperative event handlers. The pattern holds even under pressure: structure the meaning once, let the system derive views across renderers, contexts, and tools. When trait composition works for complex, interactive, multi-renderer data visualization — not just status badges — you know the architecture isn't just clever, it's durable.

---

## **What This Buys Actual Teams**

If you strip away the implementation details, an object-oriented, agent-native design system buys you three very practical things:

1. **A shared language that matches how the business thinks**

   * You’re no longer debating props on `InvoiceCard`; you’re co-authoring the `Invoice` object and its traits.

   * The Universal Quintet becomes code, not just a mental model.

2. **A better ratio of thinking to typing**

   * 80% of UI objects are “just” compositions of common traits — status, time, money, relationships, comments.

   * You write YAML and JSON once; the system generates types, views, tokens, tests, and docs.

3. **A clean surface for generative tools**

   * Machines work on the repetitive parts: validation, mapping, snapshots, sync, even first-draft layouts.

   * Humans decide what objects exist, what states matter, and how they should feel in each context and theme.

---

## **The Beginning of The End, v1.0**

The Universal Quintet laid out the recurring cast. *Beyond Components* argued that we should design systems around them, not around individual widgets. The subscriptions and authority pieces showed how much those object models already shape the UI you see.

OODS Foundry is simply the part where the theory has to run code.

It's an opinionated answer to a simple question:

**What would a design system look like if it treated objects — not components — as the primary unit of design, what if we actually cared about states and business logic and captured it too and all while assuming the system was optimized for agents natively?**

That's the question I'm trying to answer. This is my version, but I'm open to contributors, the Storybook is live, and the traits are there to be picked apart. I'd love to see what you'd compose with them next.

---

## **What's Next**

v1.0 delivers the foundation: trait composition, four-layer tokens, multi-brand theming, forced-colors support, and the Universal Quintet as working code.

The roadmap extends in two directions:

**Data Visualization:** The visualization extension (post-v1.0, detailed in a forthcoming deep-dive) proves trait composition scales to complex, interactive patterns. Eighteen viz traits across six categories (Mark, Encoding, Scale, Layout, Interaction, Guide) compose into charts that render via multiple engines, integrate with OODS contexts, and maintain full accessibility. Facet grids, layered overlays, and interactive dashboards emerge from the same trait model that powers subscription cards and user timelines. A bar chart is just another object composition.

**Core Trait Expansion:** Addressable (multi-role addresses with international format support), Classifiable (categories and tags with ltree performance), Preferenceable (user preferences with JSON Schema-driven UI), and Auditable (immutable logs with GDPR compliance) extend the Universal Quintet into a more complete foundation. Each has complete research backing and implementation guides ready.

Beyond that, extension packs for Authorization (RBAC), Communication (notifications, messages), and Content Management (media, comments) provide opt-in domain capabilities without bloating the core.

The pattern is consistent: research-backed decisions, trait-first composition, agent-native structure, and quality maintained throughout. Same philosophy, expanding surface area.

Release artifacts: `dist/releases/2025-11-14T04-05-29-980Z` with SBOM and bundle index under `artifacts/release-dry-run/2025-11-14T04-05-29-980Z`.

