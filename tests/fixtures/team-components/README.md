# Sprint 214 team library fixture

An authored test library, not a supported third-party design system. React and Vue exports replace the OODS Foundry Button, StatusBadge and Input. Button uses caption/appearance, StatusBadge uses state, and Input uses caption/currentValue. BrokenButton deliberately violates naming, keyboard, disabled and activation obligations for the contract report's negative control.

Install development dependencies with `npm install`, then build JavaScript and declaration files with `node build.mjs`, then `npm pack --pack-destination <receipt directory>`. The framework peer is supplied by the consuming app. Nothing is published.

Mappings pin the fixture to version 1.0.0. Unlisted normalized props pass through by default, with children, slots and event handlers preserving framework conventions. One mapping owns each OODS Foundry component; put both framework implementations in that record. The library is local, so install its packed tarball instead of the registry install step.
