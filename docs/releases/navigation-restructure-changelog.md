# Navigation Restructure Changelog

**Sprints 36-40 | December 2025**

## Overview

Transformed OODS Foundry's Storybook from component-centric navigation
to an object-centric, trait-based architecture that teaches the OODS
philosophy.

## What Changed

### New Documentation (Understanding OODS)
- Philosophy & value proposition
- Core concepts (Objects, Traits, Contexts)
- Trait engine deep-dive
- Getting started guides
- Visualization system overview
- Accessibility approach
- Token architecture

### New Features
- Object Explorer with matrix view
- Context switcher (Detail/List/Card/Form/Timeline/Inline)
- Trait story pattern with consistent structure
- Status registry visualization

### Trait Stories Added
- Addressable, Authable, Statusable (Core)
- Stateful, Timestampable, Archivable, Cancellable (Lifecycle)
- Billable (Domain)
- Classifiable (Organizational)

### Navigation Changes
- Stories reorganized into: Objects, Traits, Contexts, Visualization,
  Primitives, Foundations, Domain Patterns, Proofs
- 26+ story files renamed for consistent hierarchy
- Duplicate stories consolidated

## Migration Notes

If you have bookmarks to old story paths, they may need updating.
The story content is unchanged; only navigation paths changed.

## Known Limitations

- Trait coverage at 9/16 (remaining in Sprint 41)
- Object stories partially complete
- Some context demos rely on Object Explorer rather than dedicated stories

## What's Next (Sprint 41)

- Taggable, Communicable, Preferenceable trait stories
- Financial trait stories (Invoiceable, Subscribable, Refundable)
- Final polish before broader release
