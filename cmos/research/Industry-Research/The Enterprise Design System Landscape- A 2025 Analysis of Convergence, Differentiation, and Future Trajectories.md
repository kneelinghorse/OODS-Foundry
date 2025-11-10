The Enterprise Design System Landscape: A 2025 Analysis of Convergence, Differentiation, and Future Trajectories
Section 1: Executive Summary: Leaders, Taxonomy, and Strategic Outlook
This document provides a comprehensive analysis of the enterprise design system landscape in 2025, mapping the architectures, philosophies, and strategic differentiators of the industry's most influential systems. The analysis validates the hypothesis that while foundational elements have converged, significant divergence and competitive advantage are found in higher-order concerns like governance, theming, and tooling. The primary finding is a paradigm shift in the design-to-development workflow, driven by the maturation of token standards and the integration of AI-powered tooling, which repositions the design system as a critical, machine-readable API for automated code generation.

Ranked List of Reference Systems
The following systems are ranked based on their maturity, architectural influence, documentation quality, and relevance to enterprise-scale software development.

Rank	System	Maintainer	Significance & Key Differentiator
1	Material Design	Google	
The industry's most influential pioneer, setting foundational concepts. M3's focus on personalization and dynamic color represents the frontier of theming. 

2	IBM Carbon	IBM	
Exemplar for complex enterprise SaaS. Its primary differentiator is a deep library of documented patterns for data-heavy UIs and AI interactions. 

3	Microsoft Fluent	Microsoft	
A massive-scale, cross-platform system for the entire M365 ecosystem. Its two-tier token architecture is a reference for managing complexity. 

4	Atlassian Design System	Atlassian	
Architecturally significant for its "primitives-first" philosophy, empowering developers with unstyled layout components (Box, Stack) for maximum flexibility. 

5	GitHub Primer	GitHub	
A developer-first system with a unique multi-system architecture (Product, Brand), pragmatically separating concerns for different use cases. 

6	Salesforce Lightning (SLDS)	Salesforce	
A leader in enterprise-grade theming through its "styling hooks" architecture, designed for highly customizable, multi-tenant platforms. 

7	Shopify Polaris	Shopify	
The definitive reference for e-commerce and platform-specific ecosystems. Its restricted license highlights its strategic role as a competitive moat. 

8	Adobe Spectrum	Adobe	
A comprehensive system for creative applications, notable for its multiple, framework-specific implementations (Web Components, React) and robust theming. 

9	GOV.UK Design System	UK Government	
The global benchmark for accessibility and public-sector services, demonstrating a community-driven governance model and a focus on user-task patterns. 

10	Uber Base	Uber	
A strong example of a system unifying a diverse product ecosystem (ride-hailing, food delivery) with a clear, token-based foundation. 

11	Zendesk Garden	Zendesk	
A mature, open-source system with a strong focus on accessibility and a comprehensive set of React components. 

12	HubSpot Canvas	HubSpot	
Notable for its well-documented principles and a collaborative, "by the people, for the people" governance model that rotates ownership among teams. 

  
The Unified Taxonomy of a Modern Design System
Modern design systems are best understood as a multi-layered architecture, progressing from abstract decisions to concrete solutions. This model provides a framework for both building and evaluating a system.

Layer 1: Design Tokens: The atomic layer. Tokens are named entities that store indivisible design decisions like color ($color-background-brand), spacing ($space-400), or font styles. They are the abstract source of truth that decouples design intent from specific implementation values (e.g., hex codes).

Layer 2: Primitives: Low-level, unstyled layout and interaction building blocks. These components (e.g., a Box for spacing, a Stack for flexbox layout) consume tokens but do not have a strong visual opinion, providing developers with flexible, system-aware construction tools.

Layer 3: Components: The library of fully styled, reusable UI elements such as buttons, inputs, and modals. These are the most visible part of the system, composed from primitives and styled by tokens.

Layer 4: Patterns: Composed solutions for recurring, multi-step user problems (e.g., a data filtering pattern, a user onboarding flow). Patterns are blueprints that combine multiple components and business logic.

The Ecosystem: Surrounding these layers is the critical ecosystem that ensures adoption and scalability: Documentation (the user manual), Tooling (integrations that embed the system in workflows), and Governance (the human processes for maintenance and contribution).

Key Findings and Strategic Outlook
Convergence is Real, But Foundational: The industry has largely standardized on design tokens as the architectural foundation, with adoption rates reaching 84% in 2025. Similarly, accessibility is a universal, non-negotiable baseline, with all leading systems mapping components to WCAG guidelines.   

Divergence is Where Value is Created: Strategic differentiation occurs in higher-level abstractions. Governance models (open vs. closed), theming architecture (simple swaps vs. styling hooks), API design (primitives vs. pre-composed components), and the depth of domain-specific pattern libraries are the key arenas where systems create unique value and competitive advantage.

The 2025 Paradigm Shift: Design as Context for AI: The most significant trend is the shift from "design handoff" to "design as context." Technologies like Figma's Model Context Protocol (MCP) server are creating a direct pipeline from design tools to developer IDEs, allowing AI code assistants to generate UI code based on the structured data of the design system. This elevates the design system from a passive asset library to an active, queryable API that powers automated development, making a well-structured, machine-readable system a critical strategic asset.   

Section 2: The Anatomy of a Modern Design System: A Unified Taxonomy
To effectively analyze and compare the diverse landscape of enterprise design systems, it is essential to first establish a common language and architectural model. A modern design system is not a monolithic library but a layered collection of abstractions, each serving a distinct purpose. This taxonomy—progressing from abstract design decisions to concrete user interface solutions—provides a robust framework for understanding both the points of industry convergence and the arenas of strategic differentiation.

2.1 Design Tokens: The Atomic Source of Truth
At the most fundamental layer of any mature design system are design tokens. These are named entities that store indivisible, repeatable design decisions, acting as the single source of truth for a brand's visual language. Instead of hard-coding a value like a hex code (   

#0062ff) or a pixel value (16px), a developer or designer uses a token that represents the value's semantic purpose, such as $color-interactive-01 or $spacing-05.   

This abstraction is the critical enabler for scalability and consistency. When a brand's primary color needs to be updated, only the token's value is changed; that change then propagates automatically across every component and application consuming it. Industry data confirms that this concept has moved from a niche practice to a mainstream standard. The Zeroheight Design Systems Report 2025 shows token adoption skyrocketing from 56% in 2024 to 84% in 2025, with the majority of teams having used them for 1-2 years.   

The significance of this convergence is amplified by the work of the W3C Design Tokens Community Group (DTCG), which is nearing a v1.0 specification. This standard format promises to create a universal language for design decisions, enabling seamless interoperability between design tools (like Figma) and the myriad build tools and platforms (CSS, iOS, Android) that consume them. Recent progress on a "Resolver spec" and aliasing mechanisms is particularly important, as it provides a standardized way to handle the complex logic required for advanced theming and multi-brand systems.   

2.2 Primitives: The Unstyled Skeleton
Building upon tokens are primitives. These are low-level, often unstyled or "headless" layout and interaction components that provide foundational building blocks without enforcing a specific visual appearance. They manage the logic of layout (like flexbox or grid) and user interaction while consuming design tokens for properties like spacing and breakpoints.

The Atlassian Design System provides the canonical example of a primitives-first philosophy with its Box, Stack, and Inline components. These are not visually distinct elements like a button or a card; rather, they are powerful, token-aware containers that give developers a flexible and consistent way to compose complex layouts. A developer can use    

<Stack gap="space.100"> to create a vertical flexbox container with a standardized gap between its children, confident that the spacing is aligned with the system's rules. This layer represents a key architectural choice: it empowers developers with flexibility while maintaining foundational consistency, contrasting with systems that offer more rigid, pre-composed components.

2.3 Components: The Building Blocks of the UI
The component library is the most visible and widely understood layer of a design system. It is the collection of fully styled, encapsulated, and reusable UI elements that users interact with directly. This includes everything from buttons, form inputs, and modals to more complex elements like data tables and navigation bars.   

Components are composed from primitives and styled by design tokens. For example, a Button component might use a Box primitive for its structure, apply $spacing- tokens for its padding, and use $color- tokens for its background and text colors. The prevailing industry best practice is to design these as "dumb" or presentational components. This principle of separation of concerns dictates that components should receive data and event handlers via their API (e.g., props in React) but should not contain complex application-specific business logic or manage their own state. This makes them highly reusable, predictable, and easier to test and maintain across different contexts.   

2.4 Patterns: Composed Solutions to Common Problems
If components are the bricks, patterns are the blueprints. Patterns are documented, reusable solutions to common, multi-step user experience problems. They are compositions of multiple components, often including prescribed logic and content guidelines, that guide a user through a specific task. Examples include a complex data filtering pattern that combines dropdowns, checkboxes, and text inputs, or a user login flow that orchestrates form fields, buttons, and error messages.   

The existence of a robust pattern library is a sign of a design system's maturity. It demonstrates a shift from simply providing a UI toolkit to offering codified expertise and solutions for domain-specific challenges. Systems like IBM's Carbon and the GOV.UK Design System are leaders in this area, providing extensive documentation on how to solve recurring problems in enterprise software and public services, respectively. This layer is a primary arena for differentiation, as the patterns a system provides are a direct reflection of the unique problems its maintainers are trying to solve.   

2.5 The Ecosystem: Beyond the UI Kit
The layers of tokens, primitives, components, and patterns do not exist in a vacuum. Their success and adoption are dependent on a surrounding ecosystem of documentation, tooling, and governance.

Documentation: This is the essential user manual for the design system, serving a diverse audience of designers, engineers, product managers, and content strategists. Effective documentation provides not only API references for components but also usage guidelines, accessibility requirements, design principles, and live, interactive examples.   

Tooling: The most effective design systems are deeply integrated into team workflows. This is achieved through tooling such as ESLint plugins to enforce token usage (@atlaskit/eslint-plugin-design-system), Figma plugins to apply styles (Atlassian design tokens Figma plugin), CLI tools to scan codebases for component usage, and IDE integrations that bring system documentation directly to the developer.   

Governance: This refers to the human processes that manage the evolution of the system. It defines how new components are proposed, how bugs are fixed, how contributions are managed, and how breaking changes are versioned and communicated. As the Zeroheight report indicates, establishing effective governance and managing contributions are among the most significant challenges for design system teams, particularly those operating under hybrid or federated models.   

Section 3: Analysis of Reference Design Systems: Leaders and Their Philosophies
A theoretical taxonomy is best understood through the practical application and strategic choices of industry leaders. The following analysis profiles the most influential enterprise-grade design systems, examining their core philosophies, architectural decisions, and unique differentiators. This comparison reveals a landscape where, despite sharing a common vocabulary, each system is a tailored solution reflecting the specific domain, scale, and business strategy of its parent organization.

System	Maintainer	Domain Focus	Core Philosophy	Governance Model	Theming Architecture	Primary Framework(s)
Material Design	Google	OS / General Purpose	Metaphorical, adaptable, and expressive, with a focus on personalization.	Centralized (Open Source)	Color, type, and shape systems; M3 introduces dynamic color from user context.	Android, Flutter, Web
IBM Carbon	IBM	Enterprise B2B SaaS	Open, modular, and pattern-driven, solving for complex data and AI interactions.	Centralized (Open Source)	Four core themes (White, G10, G90, G100) customized via Sass tokens/CSS variables.	React, Web Components, Angular, Vue, Svelte
Microsoft Fluent	Microsoft	OS / Productivity Suite	Cross-platform cohesion ("Unmistakably Microsoft") that feels native to each device.	Centralized (Open Source)	Two-tier token system (Global + Alias) for managing light, dark, and high-contrast modes.	React, Web Components, Windows, iOS, Android
Atlassian DS	Atlassian	B2B Collaboration	Foundational and harmonious, empowering developers with layout primitives.	Centralized (Internal)	Token-based, supporting light and dark modes via a Figma plugin and CSS variables.	React
GitHub Primer	GitHub	Developer Tooling	Developer-first, pragmatic, and context-aware with distinct sub-systems.	Centralized (Internal)	Multi-scheme theming (light, dark, dimmed) via CSS variables and theme objects.	React, ViewComponents (Rails)
Salesforce SLDS	Salesforce	Enterprise CRM	Consistency and efficiency for the Salesforce platform, enabling deep customization.	Centralized (Open Source)	"Styling Hooks" (CSS custom properties) for granular, theme-aware customization.	Lightning Web Components (LWC)
Shopify Polaris	Shopify	E-commerce Platform	A cohesive merchant experience, tightly integrated with the Shopify ecosystem.	Centralized (Restricted OS)	Token-based theming via a React AppProvider or Web Component styling.	React, Web Components
Adobe Spectrum	Adobe	Creative Software	Cohesive across Adobe's suite, providing adaptive and accessible components.	Centralized (Open Source)	Token-based with distinct themes (e.g., Spectrum, Express) for different product lines.	Web Components, React, CSS
GOV.UK DS	UK Government	Public Sector Services	Accessibility, simplicity, and consistency, driven by user research and community.	Federated / Community	Single, highly consistent theme based on GOV.UK branding. Not designed for customization.	Nunjucks, HTML/CSS

Export to Sheets
3.1 IBM Carbon: The Enterprise Pattern-Master
Carbon is IBM's open-source design system, built upon the foundation of the IBM Design Language. Its core philosophy is to be open, modular, and inclusive, serving as a distributed effort where users are also makers. It is explicitly designed for the complex needs of enterprise products and digital experiences.   

Architecturally, Carbon provides a comprehensive ecosystem of working code, design tools, and human interface guidelines. It demonstrates a clear layered model, translating the foundational IBM Design Language into concrete tokens for color, type, and spacing. Its most significant differentiator is its emphasis on    

patterns. Beyond a simple component library, Carbon offers detailed guidance and code for complex, recurring UI challenges such as data filtering, forms, and data visualization. This focus extends to emerging areas, with dedicated patterns for designing AI-infused interfaces, indicating where AI-generated content is present within a UI. Carbon's technical implementation is notably broad, with official support for React and Web Components, and community-maintained libraries for Angular, Vue, and Svelte, making it one of the most framework-versatile systems.   

3.2 Shopify Polaris: The E-commerce Specialist
Polaris is Shopify's design system, with the singular goal of enabling developers and designers to build a great, consistent experience for all Shopify merchants. Its principles are rooted in consistency, accessibility, and scalability to ensure that every app feels native to the Shopify admin ecosystem.   

The system is architecturally robust, organized as a monorepo containing distinct packages for React components, design tokens, and icons. While historically focused on React , Polaris is evolving into a unified framework built on framework-agnostic Web Components, allowing it to be used across all of Shopify's surfaces, from the main admin to POS and checkout extensions. Theming is handled through a React    

AppProvider that consumes a theme object built on design tokens. Polaris's key strategic differentiator lies in its    

governance and licensing. While the source code is open, its custom MIT-based license explicitly restricts usage to applications that "integrate or interoperate with Shopify software or services". This turns the design system into a strategic asset that reinforces the Shopify platform, acting as both a tool for partners and a competitive moat.   

3.3 Microsoft Fluent: The Cross-Platform Behemoth
Fluent (or Fluent 2) is Microsoft's ambitious design system, a revamp of previous efforts like Microsoft Design Language and UI Fabric. Its guiding principles are to create experiences that feel "Natural on every platform," are "Built for focus," inclusive ("One for all, all for one"), and "Unmistakably Microsoft". It is the design language underpinning the entire Microsoft 365 product suite, from Word and Excel to Teams.   

Given its vast scope, Fluent's architecture is necessarily complex and designed for cross-platform cohesion. It is a collection of UX frameworks with implementations for Web (React and Web Components), native Windows (WinUI), iOS, Android, and macOS. Its most insightful architectural feature is its    

two-tier token system. It starts with global tokens, which are context-agnostic raw values (e.g., hex codes). These are then mapped to semantic alias tokens (e.g., colorNeutralForeground1), which describe intent. This two-layer abstraction is what enables Fluent's powerful theming capabilities, allowing components to adapt seamlessly to light mode, dark mode, high-contrast themes, and brand variations across the entire Microsoft ecosystem.   

3.4 Atlassian Design System (Atlaskit): The Primitives-First Architect
The Atlassian Design System (ADS), with its technical implementation known as Atlaskit, powers the user interfaces of products like Jira and Confluence. Its values are to be foundational, harmonious, and empowering, with a stated principle of prioritizing "trusted fundamentals before comprehensive patterns".   

This philosophy is directly reflected in its architecture. While ADS provides a full suite of components, its key differentiator is a strong emphasis on layout primitives. Components like Box, Stack, and Inline are generic, token-aware containers that provide developers with direct access to flexbox and grid layout capabilities. This "primitives-first" approach grants developers significant flexibility to compose custom UIs that are still fundamentally aligned with the system's spacing and sizing rules. The system is implemented in React and TypeScript  and relies on a highly structured, three-part token naming convention (   

foundation.property.modifier). Its governance model is currently focused on internal needs, with contributions only open to Atlassian employees, reflecting a strategy centered on internal product coherence.   

3.5 GitHub Primer: The Developer's Design System
Primer is GitHub's design system, and its philosophy is inherently developer-first. Its documentation principles emphasize being concise, universally understood, and providing production-quality code examples that promote best practices.   

Primer's most unique architectural feature is its multi-system structure. It is not a single, monolithic system but is divided into distinct toolkits for different contexts: Primer Product UI for the core GitHub application, Primer Brand UI for marketing websites, and a Brand toolkit. This pragmatic separation acknowledges that the needs of a complex web application are different from those of a static marketing page. All sub-systems are built on a shared foundation of    

Primitives—design tokens for color, spacing, and typography. This architecture allows for contextual specificity while maintaining brand consistency. Theming is a strong point, with robust support for multiple color schemes (light, dark, dimmed, high-contrast) implemented via CSS variables and a React    

ThemeProvider.   

3.6 Google Material Design: The Influential Pioneer
Material Design is arguably the most influential design system of the last decade. Created by Google, its core metaphor is inspired by the physical world, using concepts of light, depth, and motion to create bold, graphic, and intentional interfaces. Now in its third major iteration (M3), the system has evolved to focus on personalization and expressiveness.   

Its architecture is comprehensive, providing guidelines, components, and developer resources for Android, iOS, Flutter, and the Web. Theming is a central concept, allowing customization of color, typography, and shape to express a unique brand identity. Material 3's key differentiator is the introduction of    

dynamic color. This feature, available on Android 12+, derives a custom color scheme from a user's wallpaper and applies it to the UI, creating a deeply personal experience. This represents the frontier of automated and user-centric theming, moving beyond simple light/dark modes to a fully adaptive system.   

3.7 Salesforce Lightning (SLDS): The Enterprise CRM Framework
The Salesforce Lightning Design System (SLDS) is the CSS framework that provides the look and feel of the Salesforce Lightning Experience. It is an open-source, platform-agnostic system designed for the scale and complexity of enterprise CRM applications, built on pillars of clarity, efficiency, consistency, and beauty.   

The system's architecture is defined by framework-agnostic Component Blueprints (HTML and CSS structures) and a significant evolution in its theming technology. The key differentiator in SLDS 2 is the move away from traditional design tokens to a system of    

"styling hooks". These are namespaced CSS custom properties (e.g.,    

--slds-g-color-brand) that allow for granular customization of component styles while maintaining alignment with the core system. This architecture is particularly well-suited for the multi-tenant, highly brandable nature of the Salesforce platform, allowing customers to theme their orgs while custom components adapt automatically. The ecosystem is supported by strong developer tooling, including the SLDS Linter and Validator for VS Code, which guide developers toward best practices.   

Section 4: The Great Convergence: Where Systems Align
Despite their diverse philosophies and target domains, the leading enterprise design systems exhibit a remarkable degree of convergence on foundational principles and technologies. This alignment is not accidental; it reflects a maturing industry that has collectively identified a set of best practices essential for building scalable and maintainable user interfaces. This convergence validates the hypothesis that at the lower levels of the design system stack, the "how" is largely a solved problem, allowing teams to focus their efforts on higher-order, differentiating concerns.

4.1 The Ubiquity of Design Tokens
The most significant area of convergence is the universal adoption of design tokens as the architectural bedrock. As detailed in the Zeroheight 2025 report, an overwhelming 84% of design system teams now use tokens, a dramatic increase from 56% the previous year. This quantitative data is corroborated by a qualitative analysis of every major reference system: IBM Carbon, Shopify Polaris, Microsoft Fluent, Atlassian's ADS, GitHub Primer, Google Material, and Salesforce Lightning are all architected around a core set of design tokens that define their visual language.   

This industry-wide consensus stems from the fundamental value proposition of tokens: they create a necessary layer of abstraction. By separating the semantic intent of a design choice (e.g., "the primary text color") from its literal value (e.g., #171717), tokens make a system scalable, maintainable, and themeable. This shared understanding has paved the way for the W3C Design Tokens Community Group (DTCG) to formalize a standard data format for tokens. The group's progress toward a v1.0 specification is both a consequence of this convergence and a powerful catalyst for its future, promising an ecosystem of interoperable tools that can read, write, and transform tokens regardless of their origin.   

4.2 Accessibility as a Non-Negotiable Foundation
A second, equally important area of convergence is the treatment of accessibility not as a feature or an add-on, but as a core, non-negotiable architectural principle. The world's leading design systems are built with accessibility at their foundation, ensuring that their components are usable by people of all abilities from the outset.

This "accessibility-first" approach is evident across the board. IBM Carbon's components adhere to the IBM Accessibility Checklist, which is based on WCAG AA standards. Shopify Polaris explicitly lists accessibility as a core principle, with components following WCAG standards for color contrast, keyboard navigation, and screen reader compatibility. GitHub Primer provides designers with a detailed accessibility checklist to assess their work against criteria for focus order, color contrast, and keyboard access. Similarly, Google Material, Atlassian's ADS, and Salesforce Lightning all provide extensive documentation and guidelines rooted in WCAG principles.   

This convergence has a direct impact on the architecture and API design of components. It is no longer acceptable to build a button that cannot be operated by a keyboard or a form field without a proper label. As a result, component APIs have standardized around props that support accessibility, such as aria-label and aria-expanded, and behaviors like focus management and keyboard navigation are now built-in features rather than developer responsibilities. This ensures a high-quality, inclusive baseline experience for all users.   

4.3 The "Dumb" Component Consensus
The third major point of convergence lies in the architectural philosophy of the components themselves. The prevailing industry best practice is to design "dumb" or "presentational" components. This principle dictates that components within the design system should be primarily responsible for rendering the UI based on the data they are given, but should not contain complex business logic, application state, or data-fetching capabilities.

An analysis of the component APIs from leading systems confirms this trend. A Button component from Primer, Polaris, or Carbon will typically expose props to control its visual appearance (variant, size, icon), its state (disabled, loading), and a simple callback for user interaction (onClick). The component does not know    

why it is being clicked or what should happen as a result; it simply reports the interaction to its parent, which contains the application logic.

This approach is a direct application of the "separation of concerns" principle in software architecture. By keeping components free of business logic, design systems ensure that they are highly reusable, predictable, and decoupled from any single application's context. This makes the system easier to adopt, test, and maintain, as the behavior of a component is determined entirely by its inputs, leading to a more stable and scalable front-end architecture.

Section 5: Arenas of Differentiation: Where Systems Diverge
While the foundations of design systems are converging, this standardization has not led to homogeneity. Instead, it has shifted the focus of innovation and competition to higher levels of abstraction. The strategic value and competitive advantage of a design system are now defined not by its foundational elements, but by the deliberate architectural and philosophical choices made in areas of divergence. These arenas are where organizations express their unique product strategies, developer cultures, and business goals.

Taxonomy Layer	Level of Convergence	Key Area of Divergence	Strategic Implication
Tokens	High	Naming Convention & Theming Structure	The structure of token aliases and themes directly impacts the system's ability to support multi-brand, multi-product, or white-label scenarios.
Primitives	Low	Philosophy (Primitives vs. Pre-composed)	A primitives-first approach (e.g., Atlassian) offers developers maximum layout flexibility, while a pre-composed approach prioritizes consistency and speed.
Components	Medium	API Shape & Framework Choice	The design of component props (API) reflects the system's opinion on developer experience. The choice between native (React) and agnostic (Web Components) technologies dictates performance, interoperability, and required team skills.
Patterns	Low	Domain Specificity & Depth	The pattern library is the primary expression of business value, providing codified solutions for industry-specific problems (e.g., e-commerce vs. enterprise data vs. public services).

Export to Sheets
5.1 Governance and Contribution Models
The "human layer" of a design system—its governance model—is a primary point of strategic differentiation. This model dictates who can contribute, how decisions are made, and how the system evolves, directly reflecting the organization's business strategy.

Centralized & Closed Models: Systems like Atlassian's ADS and GitHub Primer are currently closed to external contributions. This centralized approach prioritizes internal product coherence, brand control, and development velocity. Decisions can be made quickly to serve the immediate needs of the parent company's product roadmap.   

Centralized & Open Models: IBM Carbon and Salesforce Lightning are fully open-source, actively encouraging community contributions. This model aims to establish the system as an industry standard, benefiting from a wider pool of contributors and fostering a broad ecosystem.   

Restricted Open-Source Models: Shopify Polaris occupies a unique middle ground. Its code is publicly available, but the license restricts its use to the Shopify ecosystem. This is a powerful strategic choice, using the transparency of open source to empower platform partners while ensuring the system exclusively benefits Shopify's business.   

The Zeroheight report highlights the operational reality of these models, showing a near-even split between centralized (50%) and hybrid (41%) approaches in the industry, with the latter facing significant challenges in managing and encouraging contributions from federated teams.   

5.2 Theming Architecture
As products and brands scale, the ability to apply different visual themes becomes critical. Theming architecture has evolved far beyond simple light and dark modes and is now a key differentiator for supporting multi-brand portfolios, white-label products, and deep personalization.

Sophisticated Token Structures: Microsoft Fluent's two-tier system of global and alias tokens is a powerful architecture for managing the complexity of theming across a vast product suite like Microsoft 365.   

CSS Custom Properties as a Theming Engine: Salesforce Lightning's "styling hooks" are a prime example of leveraging modern CSS. These are namespaced CSS custom properties that allow for granular, component-level overrides that are still theme-aware, providing a robust solution for the highly customizable nature of the Salesforce platform.   

Contextual Theming: GitHub Primer's separation into Product and Brand systems demonstrates a pragmatic approach, acknowledging that different contexts require fundamentally different themes and components. Adobe Spectrum follows a similar path with its distinct    

Express theme tailored for a different user audience than its core creative applications.   

5.3 API Shapes and Developer Experience (DX)
The Application Programming Interface (API) of a component—typically its set of props in a framework like React—is the contract between the design system and its developer users. The design of this API is a major point of philosophical divergence.

Primitives vs. Pre-composition: Atlassian's primitives-first approach provides developers with flexible, low-level layout tools like Box and Stack. This contrasts with a system like IBM Carbon, which offers more pre-composed, opinionated patterns for complex UIs. The former prioritizes developer flexibility and composition, while the latter prioritizes consistency and speed for known use cases.   

Framework-Native vs. Framework-Agnostic: The choice of underlying technology has profound implications for DX. Systems like Primer React  and Atlassian's ADS  are built specifically for the React ecosystem, offering a seamless experience for teams using that stack. Conversely, the increasing adoption of Web Components by systems like Carbon, Polaris, and Spectrum aims for framework agnosticism, promising greater longevity and interoperability at the cost of a potentially less idiomatic experience within any single framework.   

5.4 The Pattern Library
While convergence is high for atomic components like buttons, the greatest divergence—and the greatest expression of business value—is found in the pattern library. This is where a design system moves beyond providing a generic toolkit and starts providing codified, domain-specific expertise.

The patterns offered by a system are a direct reflection of the core business of its maintainer.

Shopify Polaris provides components and patterns tailored for e-commerce, such as product page layouts and checkout flows.   

IBM Carbon offers deep patterns for enterprise applications, including complex data tables, filtering mechanisms, and data visualization charts.   

The GOV.UK Design System has patterns for common civic tasks, such as "Ask users for an address" or "Help users check their answers," which are based on extensive user research within the public sector.   

This divergence underscores a critical strategic point: the most valuable design systems are not just collections of UI elements, but repositories of solved problems for a specific industry or user base.

Section 6: The Next Frontier: 2025 Trends and Strategic Implications
The design system landscape is on the cusp of a fundamental transformation. The convergence on foundational standards has set the stage for a new wave of innovation focused on the integration of artificial intelligence and the automation of the design-to-development workflow. These emerging trends are poised to redefine team roles, required skill sets, and the very nature of how digital products are built, elevating the design system from a library of assets to the central nervous system of product development.

6.1 AI-Augmented Implementation: The End of Handoff
The traditional, often fraught, process of "handing off" static design mockups from designers to developers is becoming obsolete. The most significant trend for 2025 is the rise of AI-augmented implementation, where the design system provides live, structured context to AI agents operating directly within a developer's Integrated Development Environment (IDE).

The key enabling technology is Figma's Model Context Protocol (MCP) server. This feature, currently in beta, exposes a design file's data—not as a flat image, but as a structured model of components, variables (tokens), styles, and metadata—through a standardized protocol. AI coding assistants like GitHub Copilot, integrated into IDEs like VS Code, can connect to this MCP server. This allows a developer to select a frame in Figma and instruct the AI to "generate this as a React component". The AI doesn't guess at pixels; it reads the component names, layout constraints, and token values directly from the design file, producing code that is far more accurate and system-aligned.   

This workflow is further enhanced by Figma's Code Connect feature, which allows design components to be explicitly mapped to their corresponding code components in a repository. When this mapping exists, the MCP server can instruct the AI agent to use the    

actual, production-ready design system component, rather than generating new code from scratch.   

This shift has profound implications. It repositions the design system from a passive library for humans to an active, queryable API for AI. The quality of AI-generated code becomes directly proportional to the quality, consistency, and semantic richness of the design system's data. A well-structured design file, with proper use of components, auto-layout, and variables, is no longer just a matter of good practice for designers; it is a prerequisite for effective automation.

6.2 The Token Standard Matures
The acceleration of AI-driven workflows is heavily dependent on the standardization of the foundational data layer: design tokens. The progress of the W3C Design Tokens Community Group (DTCG) toward a v1.0 specification is therefore a critical parallel trend.   

A stable, universally adopted standard for the format and structure of design tokens will catalyze an explosion in the third-party tooling ecosystem. Currently, significant engineering effort is spent building custom pipelines to transform tokens from a design tool's format into the various formats required by different platforms (e.g., CSS custom properties, iOS Swift files, Android XML). A common standard will eliminate this friction.

The maturation of the spec, including recent work on a "Resolver specification" for handling aliases and theming logic, will unlock a new generation of powerful, interoperable tools. This will enable "write once, publish everywhere" theming systems, automated documentation generators that can read any standard token file, and design-to-code tools that are no longer locked into a single vendor's ecosystem. For enterprise teams, this standardization de-risks investment in a token-based architecture and promises to significantly reduce the overhead of maintaining cross-platform visual consistency.   

6.3 The Blurring Line Between Design and Development
The combined impact of AI integration and token standardization is the accelerating dissolution of the traditional boundary between design and development. Tools are evolving from serving one discipline to creating a shared, collaborative workspace.

Figma's Dev Mode is a clear manifestation of this trend. It provides a developer-centric view of a design file, surfacing critical information like variable names, alias chains, and direct links to component documentation or code repositories. Instead of a designer "redlining" a spec, the design file itself becomes the living specification, explorable and queryable by the developer within their own context.   

This creates a more continuous, integrated workflow. A designer marks a section as "Ready for dev" in Figma; a developer in VS Code sees this status update, inspects the design using the Figma extension, and uses an AI agent with MCP access to generate the initial implementation. If a developer needs to add a new state (e.g., a hover effect) not present in the design, they can implement it in code and link it back to the Figma component, closing the loop. This transforms the linear "handoff" into a dynamic, bidirectional conversation mediated by shared tools and a common data model—the design system. This shift will demand new skills: designers will need to think more like systems engineers, structuring their files for machine consumption, while developers will interact more directly with design artifacts as part of their daily workflow.   

Section 7: Strategic Recommendations for Enterprise Build Teams
The analysis of the 2025 design system landscape reveals a clear path forward for enterprise build teams aiming to create scalable, efficient, and competitive UI ecosystems. The era of debating foundational principles is over; the new imperative is to build upon the industry's converged standards while making deliberate, strategic choices in the areas of differentiation. The following recommendations provide an actionable framework for navigating this mature landscape and preparing for the next wave of AI-driven innovation.

Adopt a Layered Architecture
The most robust and flexible design systems are built on a layered model of abstraction. Teams should structure their systems according to this hierarchy:

Tokens: Establish design tokens as the non-negotiable single source of truth for all visual styles. This foundational layer is the prerequisite for consistency, theming, and future automation.

Primitives: Develop a small set of unstyled, token-aware layout primitives (e.g., Box, Stack, Grid). This provides developers with a flexible, system-compliant toolkit for composing custom layouts without breaking foundational rules, striking a balance between freedom and constraint.

Components: Build a comprehensive library of styled, presentational ("dumb") UI components. These should be composed from primitives and styled exclusively with tokens.

Patterns: As the system matures, invest in identifying and codifying reusable patterns. This is where the system delivers the most direct business value by providing pre-built solutions to recurring, domain-specific user problems.

This layered approach maximizes both consistency at the foundational level and flexibility at the compositional level, allowing the system to serve a wide range of product needs efficiently.

Invest in Your Token Pipeline
Given the universal convergence on tokens and their critical role in powering next-generation AI tooling, a well-structured and automated token pipeline is no longer a "nice-to-have" but the central engine of a modern UI infrastructure. Teams should prioritize:

Standardization: Align token formats with the emerging W3C DTCG specification to ensure future compatibility with the growing ecosystem of third-party tools.   

Automation: Implement a CI/CD pipeline that automatically transforms tokens from a central source into the various formats required by all target platforms (e.g., CSS, JSON, Swift, XML).   

Semantic Naming: Enforce a clear, semantic token naming convention (e.g., [category].[property].[modifier]) that communicates intent, not value. This is crucial for maintainability and for providing clear context to AI agents.   

Prioritize Developer Experience (DX)
A design system only provides value when it is adopted. The primary driver of adoption is a superior developer experience. Investment should be focused on:

High-Quality Documentation: Provide clear, comprehensive, and easily searchable documentation with interactive examples for every component and pattern.

Robust Tooling: Integrate the design system directly into the developer's workflow with tools like IDE extensions, code linters that enforce token usage, and CLI utilities for upgrading versions.

Clear Contribution Workflows: Establish a well-defined and transparent governance model for reporting bugs, requesting new features, and contributing back to the system. This fosters a sense of community ownership and ensures the system evolves to meet real-world needs.

Prepare for an AI-Driven Workflow
The shift toward AI-augmented implementation requires a proactive approach. To position a design system for this future, teams should:

Structure for Machine Readability: Enforce best practices in design files. Use components and variables consistently, name layers semantically, and leverage auto-layout. Treat the design file not as a static mockup, but as a structured database for an AI to query.

Experiment with Emerging Tools: Begin experimenting with Figma's Dev Mode, Code Connect, and the MCP server to understand how they function. Create proof-of-concept projects to evaluate the quality of AI-generated code based on the current system's structure.   

Elevate the Role of the Design System: Champion the understanding within the organization that the design system is evolving from a component library into a critical API that will power the future of automated UI development.

Make Strategic Bets on Divergence
Finally, while it is wise to follow industry convergence on foundations like tokens and accessibility, competitive advantage comes from making deliberate choices in the areas of divergence. Do not simply replicate a system like Material or Carbon. Instead, use this report's analysis to ask strategic questions:

Governance: Does our business strategy call for a closed, internally-focused system that prioritizes speed and brand control, or an open system that aims to build a wider community?

Theming: What is the complexity of our product portfolio? Do we need a simple theme swap, or a sophisticated architecture like styling hooks to support white-labeling and deep customization?

API Philosophy: Does our developer culture favor the flexibility of primitives, or the speed and consistency of pre-composed components?

Patterns: What are the unique, high-value, recurring problems within our specific domain? How can our pattern library become a repository of codified expertise that gives our teams a competitive edge?

By building on a converged foundation and making conscious, strategic bets in these differentiating arenas, enterprise teams can construct a design system that not only ensures consistency and efficiency but also serves as a powerful engine for innovation and a durable competitive advantage.


Sources used in the report

m3.material.io
Material Design 3 - Google's latest open source design system
Opens in a new window

adhamdannaway.com
Best design system examples in 2025 - Adham Dannaway
Opens in a new window

carbondesignsystem.com
Carbon Design System
Opens in a new window

developer.microsoft.com
Fluent UI - Get started - Microsoft Developer
Opens in a new window

fluent2.microsoft.design
Design tokens - Fluent 2 Design System - Microsoft Design
Opens in a new window

atlassian.design
Atlassian Design System
Opens in a new window

primer.style
Primer
Opens in a new window

developer.salesforce.com
SLDS Design Tokens | Create Lightning Web Components - Salesforce Developers
Opens in a new window

developer.salesforce.com
SLDS Styling Hooks | Create Lightning Web Components - Salesforce Developers
Opens in a new window

jhkinfotech.com
Shopify Polaris Guide: Components, Icons & Design System – Jhk Blog
Opens in a new window

github.com
Shopify/polaris: Shopify's design system to help us work together to build a great experience for all of our merchants. - GitHub
Opens in a new window

spectrum.adobe.com
Spectrum, Adobe's design system
Opens in a new window

spectrum.adobe.com
Theming - Spectrum, Adobe's design system
Opens in a new window

design-system.service.gov.uk
GOV.UK Design System: Home
Opens in a new window

eleken.co
10 Inspiring Design System Examples (And How to Build Yours) - Eleken
Opens in a new window

base.uber.com
Welcome to Base - Base design system - Uber
Opens in a new window

garden.zendesk.com
Zendesk Garden
Opens in a new window

developer.zendesk.com
Designing with Zendesk Garden
Opens in a new window

canvas.hubspot.com
Canvas Design System
Opens in a new window

webdesignerdepot.com
Zeroheight Releases Its Design Systems Report 2025 - Web Designer Depot
Opens in a new window

othr.zeroheight.com
Brought to you by - Zeroheight
Opens in a new window

carbondesignsystem.com
IBM accessibility standards - Carbon Design System
Opens in a new window

shopify.dev
Accessibility best practices for Shopify apps
Opens in a new window

fluent2.microsoft.design
Accessibility - Fluent 2 Design System
Opens in a new window

medium.com
Figma Dev Mode + VS Code: The Ultimate Guide to MCP Integration | by Samer S Tallauze
Opens in a new window

help.figma.com
Guide to the Figma MCP server – Figma Learn - Help Center
Opens in a new window

designtokens.org
Design Tokens Technical Reports
Opens in a new window

base.uber.com
Design tokens - Base design system - Uber
Opens in a new window

atlassian.design
Design tokens explained - Tokens - Atlassian Design System
Opens in a new window

v10.carbondesignsystem.com
Themes – Carbon Design System
Opens in a new window

zeroheight.com
Design Systems Report 2025 - An overview - Zeroheight
Opens in a new window

w3.org
September | 2025 | Community and Business Groups - W3C
Opens in a new window

w3.org
Request For Comments: new Resolver specification, groups & Aliases updates | Design Tokens Community Group - W3C
Opens in a new window

w3.org
Design Tokens Community Group - W3C
Opens in a new window

aufaitux.com
18 Best Design Systems Examples from Top Companies - Aufait UX
Opens in a new window

design-system.service.gov.uk
Components - GOV.UK Design System
Opens in a new window

primer.style
Components - Primer
Opens in a new window

react.fluentui.dev
Components / Field - Docs ⋅ Storybook
Opens in a new window

v10.carbondesignsystem.com
Documentation - Carbon Design System
Opens in a new window

primer.style
Documentation | Primer
Opens in a new window

base.uber.com
5. Document, update, and maintain - Base design system - Uber
Opens in a new window

atlassian.design
Develop - Atlassian Design System
Opens in a new window

atlassian.design
Overview - Atlassian Design System
Opens in a new window

zeroheight.com
Level up your design system in 2025 - Zeroheight
Opens in a new window

carbondesignsystem.com
What is Carbon? - Carbon Design System
Opens in a new window

atlassian.design
Overview - Contribution - Atlassian Design System
Opens in a new window

carbondesignsystem.com
Get started - Carbon Design System
Opens in a new window

carbondesignsystem.com
Get started – Carbon Design System
Opens in a new window

uxpin.com
13 Best Design System Examples in 2025 - UXPin
Opens in a new window

carbondesignsystem.com
Data table - Carbon Design System
Opens in a new window

en.wikipedia.org
Carbon Design System - Wikipedia
Opens in a new window

jimmorgan.hashnode.dev
Full Guide on Shopify Polaris 2025 - JimShine
Opens in a new window

shopify.dev
Polaris - Shopify developer documentation
Opens in a new window

shopify.dev
Polaris web components - Shopify developer documentation
Opens in a new window

brainspate.com
Shopify Polaris Guide: Build Beautiful Shopify Apps Fast - BrainSpate
Opens in a new window

en.wikipedia.org
Fluent Design System - Wikipedia
Opens in a new window

fluent2.microsoft.design
Design principles - Fluent 2 Design System - Microsoft Design
Opens in a new window

hackmd.io
Fluent UI Insights - Theming - HackMD
Opens in a new window

atlassian.design
Learn about the design system, the benefits of using it, and our values and principles. - Atlassian Design System
Opens in a new window

github.com
primer/github-vscode-theme: GitHub's VS Code themes
Opens in a new window

primer.style
Theming | Primer
Opens in a new window

m2.material.io
Introduction - Material Design
Opens in a new window

m3.material.io
Develop with Material Design 3 for Android & Web
Opens in a new window

m2.material.io
Develop - Material Design
Opens in a new window

m2.material.io
Guidelines - Material Design
Opens in a new window

developer.android.com
Material Design 3 in Compose | Jetpack Compose - Android Developers
Opens in a new window

developer.salesforce.com
Style with Lightning Design System | Create Lightning Web ...
Opens in a new window

salesforceben.com
Welcome to the Salesforce Lightning Design System (SLDS)
Opens in a new window

nsiqinfotech.com
An In-Depth Guide to Salesforce Lightning Design System (SLDS) - NSIQ INFOTECH
Opens in a new window

developer.salesforce.com
SLDS Blueprints | Create Lightning Web Components | Lightning ...
Opens in a new window

lightningdesignsystem.com
Developers · Lightning Design System 2
Opens in a new window

npmjs.com
shopify/polaris-tokens - NPM
Opens in a new window

spectrum.adobe.com
Design tokens - Spectrum, Adobe's design system
Opens in a new window

carbondesignsystem.com
Themes - Carbon Design System
Opens in a new window

w3.org
2025 | Design Tokens Community Group - W3C
Opens in a new window

m3.material.io
Accessibility designing – Material Design 3
Opens in a new window

twistellar.com
Salesforce Accessibility Overview: Features and Tips - Twistellar
Opens in a new window

m2.material.io
Accessibility - Material Design
Opens in a new window

ownego.github.io
Button — Shopify Polaris Vue by ownego
Opens in a new window

carbondesignsystem.com
Button - Carbon Design System
Opens in a new window

primer.style
Button - Primer Design System
Opens in a new window

primer.style
Contribution guidelines - Primer
Opens in a new window

carbon-website-git-fork-aagonzales-dialog-pattern.carbon-design-system.vercel.app
Opens in a new window

github.com
An implementation of GitHub's Primer Design System using React
Opens in a new window

designsystemscollective.com
Dev Mode MCP Server in Figma: Step-by-Step with VS Code - Design Systems Collective
Opens in a new window

kahunam.com
How to Turn Your Figma Designs Into Code with Dev Mode MCP Server - Kahunam
Opens in a new window

youtube.com
Dev Mode MCP Server: Improving design to code | Figma - YouTube
Opens in a new window

skywork.ai
Figma Dev Mode Review (2025): Does It Finally Fix Design‑to‑Code Handoff?
Opens in a new window

francescoimprota.com
Design Systems Report 2025 - Francesco Improta