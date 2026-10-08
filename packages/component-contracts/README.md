# @oods/component-contracts

Framework-independent component contracts and shared formatting helpers for OODS. A contract lists a component's identity, props, slots, events, states, token roles and accessibility obligations. The package contains data and helpers; it does not render a UI.

## Install

```sh
npm install @oods/component-contracts
```

## First result

Run this in an ES module:

```js
import { componentContracts } from '@oods/component-contracts';
console.log(componentContracts.Button.id); // Button
console.log(componentContracts.Button.events);
console.log(componentContracts.Button.accessibility);
```

Use the contract when writing a component adapter. The `componentCapabilityBaseline` export and `@oods/component-contracts/registry/capabilities` contain the retained capability ledger. Its evidence is scoped to the recorded component scenarios; a declared obligation is not evidence that an arbitrary implementation meets it.

OODS Foundry's mapped-component reports distinguish met, unmet and not-checked obligations. Read their reasons and source identities before using a report as evidence. The package does not certify an application, a third-party library or every possible component state.

## Limits

Use one version of the OODS packages together. Apps that `@oods/foundry` generates pin the tested 0.6.2 set; keep those pins unless you upgrade all of them together. These packages are separate from the local MCP server, `@oods/foundry`. <!-- history -->

## License

Apache License 2.0. See [LICENSE](https://cdn.jsdelivr.net/npm/@oods/component-contracts@0.10.2/LICENSE) and [NOTICE](https://cdn.jsdelivr.net/npm/@oods/component-contracts@0.10.2/NOTICE). Generated output belongs to its user; installed package dependencies retain their own licenses.
