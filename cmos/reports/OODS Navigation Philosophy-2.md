# OODS Navigation Philosophy and Inventory

## Introduction

The **Object‑Oriented Design System (OODS) Foundry** is not a traditional component library but a system built around objects, traits and contexts. The project’s README explains that OODS uses a **trait‑first object model** and a deterministic compositor that assembles objects from composable traits[\[1\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L20-L22). Contexts then determine how an object renders in different situations – List, Detail, Form and Timeline[\[2\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L92-L96). Accessibility is not an afterthought: OODS uses semantic HTML, ARIA patterns and a token‑driven colour palette to ensure components work in high‑contrast or forced‑colour modes[\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112). These core principles should be embodied by the navigation structure so that users learn OODS concepts by browsing the design system.

This report inventories the current stories and components, identifies gaps, and proposes a navigation that reflects OODS philosophy. It concludes with a mapping of existing stories to the proposed structure.

## 1 Inventory by OODS Concept

The cmos/planning/oods‑components.json file contains a machine‑generated inventory of OODS. It lists **70 components**, **34 traits**, **12 objects**, **4 contexts** and a small number of patterns and domains. While exhaustive, the current Storybook surface only shows a fraction of these items. Below is an inventory organized by OODS concepts rather than by file location.

### 1.1 Traits (Foundational Capabilities)

Traits describe behaviours and capabilities that objects can have. They are the building blocks of OODS and should be visible to users. The inventory lists 34 traits in categories such as core, lifecycle, domain‑specific and visualization. Important traits include:

| Category | Selected traits | Description |
| :---- | :---- | :---- |
| **Core traits** | **Addressable**, **Archivable**, **Authable**, **Classifiable**, **Labelled**, **Ownerable**, **Preferenceable**, **Statusable**, **Timestampable**, **Taggable** | Provide fundamental capabilities such as multiple addresses, archival lifecycle, role‑based access control, classification/tags, labels and state management. The README notes that canonical traits live in traits/ and compose into objects via a deterministic compositor[\[1\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L20-L22). |
| **Lifecycle traits** | **Cancellable**, **Fulfillable**, **Refundable**, **Suspendable**, **Upgradable** | Model state transitions for subscriptions and invoices – e.g., cancelling a subscription or refunding a transaction. |
| **Domain‑specific traits** | **SaaSBillingBillable**, **SaaSBillingPayable**, **SaaSBillingRefundable**, **SaaSBillingUsable**, **SaaSBillingUpgradable** | Provide behaviours specific to SaaS billing domains, such as billable line items, payable amounts and usage tracking. |
| **Communication traits** | **Communicable** (contact methods), **Temporal** (scheduling/time windows) | Manage communications and scheduling across objects. |
| **Visualization traits** | **Colorized**, **EncodingColor**, **EncodingPositionX/Y**, **EncodingSize**, **MarkBar**, **MarkLine**, **MarkPoint**, **MarkArea** | Support the token‑expression pipeline (TEP) for data visualization; they define how to encode data dimensions (colour, position, size) and mark types in charts. |

**Observation:** Only one trait (Addressable) currently appears in Storybook. Most traits listed above are not directly demonstrated. The trait engine and composition patterns are hidden.

### 1.2 Objects (Central Entities)

Objects are the things users care about (e.g., User, Organization, Product). They are defined in YAML files under objects/ and composed from traits. The inventory lists **12 objects**:

* **Article** – a content item. Composed from Labelled, Stateful, Ownerable and Timestampable traits.

* **Invoice** – a billing document. Uses traits such as Stateful, Timestampable, Cancellable, Refundable, SaaSBillingPayable and SaaSBillingRefundable.

* **Media** – multimedia content. Uses Labelled, Ownerable and Timestampable traits.

* **Organization** – central account entity. Composed from Labelled, Stateful, Ownerable, Timestampable, Taggable, Addressable and Authable traits.

* **Plan** – subscription plan. Uses traits including Labelled, Stateful, Timestampable, SaaSBillingUsable and SaaSBillingUpgradable.

* **Product** – product sold. Composed from Labelled, Stateful, Ownerable, Timestampable, Taggable and Addressable traits.

* **Relationship** – models user–organization relationships. Uses traits like Labelled, Timestampable, Stateful and Ownerable.

* **Subscription** – recurring billing agreement. Uses a rich set of lifecycle and billing traits including Cancellable, Suspendable, Upgradable and various SaaSBilling traits.

* **Transaction** – financial transaction. Uses Timestampable, SaaSBillingPayable and SaaSBillingRefundable traits.

* **Usage** – usage record. Uses traits including Timestampable and SaaSBillingUsable.

* **User** – end user. Composed from Stateful, Timestampable, Taggable, Addressable, Preferenceable and Authable traits.

* **Another domain object** – e.g., **Article** or **Media** – there may be additional domain objects not currently in Storybook.

**Observation:** Only three objects (User, Organization, Product) are shown in the current Storybook navigation. The other nine objects above lack visible demos.

### 1.3 Contexts (Rendering Modes)

Contexts determine how an object renders depending on where it appears. The README lists four canonical contexts: **List**, **Detail**, **Form** and **Timeline**[\[2\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L92-L96). Each context has region contracts (e.g., header, body, actions) and can be modified by pure modifiers (e.g., compact, dense). The inventory also mentions a **Card** and **Dashboard** context used in prototypes, but the canonical set remains List, Detail, Form and Timeline.

**Observation:** In Storybook, context examples are scattered (e.g., proofs/context-gallery.stories.tsx) and not explained. Users cannot easily compare how the same object renders across contexts.

### 1.4 Primitives (Supporting Components)

Primitives are raw UI building blocks such as **Buttons**, **Inputs**, **Tables**, **Tabs**, **Dialogs**, **Pagination** and **Toast**. They support objects but should not be the primary navigation focus. The inventory lists around 70 components across categories like Data Entry (e.g., TextField, Select, Checkbox), Data Display (e.g., Badge, Banner, Table, Card), Composition (e.g., Tabs, Accordion, Grid), Feedback (e.g., Toast), Navigation (e.g., Breadcrumb, Pagination, Link) and Visualization (e.g., BarChart, LineChart). Each component is associated with one or more traits and contexts, as described in the JSON file. Many of these components implement accessibility features and support OODS tokens but are currently front‑and‑centre in Storybook instead of supporting objects.

### 1.5 Accessibility & Guardrails

OODS emphasises accessibility through semantic HTML, ARIA patterns, OKLCH colour tokens and forced‑colour support[\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112). The inventory includes **status-aware announcements** and high‑contrast mode proofs, and many components specify accessible regions and tokens. However, accessibility proofs and documentation are buried in a report; there is no dedicated section in the navigation.

### 1.6 Visualization System (Token‑Expression Pipeline)

The Token‑Expression Pipeline (TEP) is a system for generating data visualisations. It normalises data specifications, selects appropriate renderers and composes charts using traits such as EncodingColor, EncodingPositionX/Y, EncodingSize, MarkBar, MarkLine and MarkPoint. Components like BarChart, LineChart, AreaChart and Treemap are built on this pipeline. Stories exist under viz categories, but the underlying system is not explained; users see individual charts rather than how OODS selects marks and encodings.

## 2 Gap Analysis

Comparing the inventory with the current Storybook navigation reveals several gaps:

1. **Traits Hidden:** Only the Addressable trait is shown; the other 33 traits are absent. Users cannot learn about the trait engine or how traits compose into objects. For instance, traits like Statusable, Classifiable or Temporal are not demonstrated.

2. **Objects Under‑represented:** Only three objects (User, Organization, Product) appear in the nav, leaving nine objects unseen. Without demos for Invoice, Subscription, Plan, Transaction, etc., the central narrative that “Objects are the hero” is lost.

3. **Contexts Not Explained:** While the README emphasises four contexts, the current nav doesn’t group stories by context nor show the same object across contexts. Context proofs are hidden in proofs/context-gallery and not connected to objects.

4. **Primitives Dominate:** The nav is structured as a component library with categories like “Inputs”, “Data display”, “Navigation” and “Forms”. This misleads users into thinking OODS is just another component system rather than an object‑oriented framework.

5. **Accessibility & Tokens Buried:** Accessibility proofs and token documentation are hard to find. There is no visible narrative about how OODS ensures accessibility via colour tokens and state deltas[\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112).

6. **Trait Engine & Composition Invisible:** The deterministic compositor and statusRegistry are not demonstrated. Users cannot see how objects dynamically gain capabilities via traits.

7. **Visualization System Fragmented:** Chart stories show individual visualisations without explaining the TEP engine, tokenisation or encoding selection. There is no central page introducing the viz system.

8. **Domain‑specific Patterns Missing:** Domain traits (SaaS billing) are not surfaced; there is no demonstration of full flows like subscription billing or invoice lifecycles.

These gaps make it difficult for new users to understand OODS philosophy and differentiate it from a generic design system.

## 3 Proposed OODS‑Native Navigation Hierarchy

To teach OODS and reflect its philosophy, the navigation should be restructured around **Objects**, **Traits** and **Contexts**, with supporting sections for primitives, accessibility and visualisation. A suggested hierarchy is shown below.

### 3.1 Understanding OODS (Overview)

This top‑level section introduces the OODS philosophy: trait‑first object model, context‑aware rendering, deterministic compositor, accessibility guardrails and the token‑expression pipeline. It can include high‑level diagrams and links to detailed sections. Citations from the README[\[1\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L20-L22)[\[2\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L92-L96)[\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112) should be included to ground the narrative.

### 3.2 Objects (Central Entities)

This section makes objects the hero. Each object has its own page with:

1. **Definition & Purpose:** Short description and tags.

2. **Trait Composition:** Table showing which traits are composed into the object and parameters for each trait.

3. **Contexts:** Demonstrations of the object in each context (List, Detail, Form, Timeline). Users can switch between contexts to see how the same object renders differently.

4. **Related Components:** Links to primitives used in rendering the object (e.g., Table for list, Form controls for editing).

5. **Examples & Guidance:** Example data and recommended usage patterns.

Objects should be grouped by domain (e.g., **Core**, **Billing**, **Content**). The 12 objects enumerated earlier should each have a dedicated story. Additional domain objects can be added as they are implemented.

### 3.3 Traits (Capabilities)

This section lists all traits with categories (Core, Lifecycle, Domain, Viz) and explains what behaviours they confer. Each trait page should include:

1. **Description & Semantics:** Explanation of the behaviour and relation to tokens or semantics.

2. **Contexts Supported:** Which contexts the trait can render in.

3. **View Extensions:** Components or UI fragments that the trait provides (e.g., AddressCollectionPanel for Addressable).

4. **Objects Using the Trait:** Links back to object pages.

5. **Accessibility & Tokens:** How the trait handles accessibility and uses tokens.

Showing traits as first‑class citizens emphasises that objects are composed rather than monolithic.

### 3.4 Contexts (Rendering Modes)

This section explains the four canonical contexts: List, Detail, Form and Timeline. It should include diagrams of region contracts (header, body, actions, meta) and guidelines for when to use each context. For each context, examples of multiple objects should be provided to illustrate differences. Additional sub‑pages can explain modifiers (dense, compact) and variant contexts like Card or Dashboard.

### 3.5 Visualization System (TEP)

Create a dedicated section describing the token‑expression pipeline. It should explain how visual traits (encoding and mark traits) work together to select the appropriate chart type and how tokens drive styling. Sample visualisations can show how changing data or traits affects the rendered chart. This section can link to each specific chart component but emphasise the underlying system.

### 3.6 Primitives (Supporting Components)

Primitives should be grouped under a “Foundations” or “Primitives” section. Categories could include **Data Entry**, **Data Display**, **Composition & Layout**, **Navigation**, **Feedback** and **Utilities**. The navigation should make clear that these components support objects rather than being the centrepiece. Each primitive page should describe its API and accessibility considerations but also link back to objects or traits that use it.

### 3.7 Accessibility & Tokens

Provide a first‑class section for accessibility guidelines, including colour tokens, forced‑colour support, screen‑reader announcements and keyboard navigation. Also include a sub‑section on the semantic token architecture (Reference → Semantic → Component) and how tokens map to OODS primitives[\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112).

### 3.8 Trait Engine & Composition Demo

Include a dedicated page showing how the trait engine composes objects: given an object definition, the deterministic compositor assembles views by combining trait view extensions. This could be an interactive demo where users choose traits and see the resulting object UI. Additionally, document the statusRegistry and how states drive component choices.

### 3.9 Domain Patterns & Flows

Add sections for domain‑specific patterns, such as SaaS billing workflows. These can demonstrate how multiple objects and traits interact across contexts (e.g., creating a subscription, generating invoices, processing payments). Such flows help anchor OODS concepts in real use cases.

## 4 Story Mapping to the New Hierarchy

The existing Storybook stories can be migrated to the proposed hierarchy. Below is a high‑level mapping for common categories:

| Current category/file type | Proposed placement | Notes |
| :---- | :---- | :---- |
| components/\* (e.g., Buttons, Badge, Table, Tabs) | **Primitives → Data Display/Data Entry/Composition/Navigation** | Primitives should be grouped under Foundations. The API and accessibility details remain, but the nav emphasises that these components support objects. |
| stories/proofs/context-gallery.stories.tsx | **Contexts → Context proofs** | Move these proofs into the Contexts section. Show objects across List, Detail, Form and Timeline contexts rather than isolated components. |
| stories/proofs/viz/... chart stories | **Visualization System → Charts** | Consolidate these stories under the TEP section. Explain encoding and mark traits rather than just showing end results. |
| apps/explorer/src/stories MDX documentation (e.g., Billing/Invoice.Detail.mdx) | **Objects → Invoice (Detail context)** | Reorganise MDX docs into object pages. Each page should have sub‑sections for different contexts rather than separate MDX files for each context. |
| stories/traits/addressable.stories.tsx | **Traits → Addressable** | Expand this to include all traits. Each trait story should show its view extensions across contexts and list objects that use it. |
| stories/objects/User.stories.tsx and similar | **Objects → User** | Keep these pages but enrich them with trait composition tables and cross‑context demos. |
| Accessibility proofs (e.g., high contrast mode) | **Accessibility & Tokens** | Surface these proofs in a dedicated accessibility section rather than burying them in reports. |
| Status components and timeline stories | **Trait Engine & Composition** or **Lifecycle Traits** | Move status and timeline stories into sections explaining lifecycle traits (e.g., Statusable) and the trait engine. |
| Domain stories (e.g., SaaS billing) | **Domain Patterns & Flows** | Group domain stories under patterns and flows to show end‑to‑end use cases. |

This mapping is conceptual; a detailed migration plan should enumerate every story file and assign it to the new hierarchy. The oods‑components.json file provides metadata (categories, contexts, trait usages) that can be used programmatically to generate this mapping.

## Conclusion

The current Storybook navigation presents OODS as a component library, obscuring its unique philosophy. By reorganising the navigation around **Objects**, **Traits** and **Contexts**, and by elevating accessibility and the visualisation system to first‑class concerns, OODS can better teach users how to build domain‑driven, accessible interfaces. The proposed hierarchy emphasises that objects are central, traits are foundational, contexts determine rendering, primitives are supporting cast, and domain patterns provide real‑world examples. Implementing this navigation will enable new users to internalise OODS principles and differentiate it from generic design systems.

---

[\[1\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L20-L22) [\[2\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L92-L96) [\[3\]](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md#L107-L112) README.md

[https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md](https://github.com/kneelinghorse/OODS-Foundry/blob/HEAD/README.md)