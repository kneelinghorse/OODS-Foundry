Tool Contracts (v0.1)

- tokens.build
  - input: brand A, theme light|dark|hc, apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

- a11y.scan, purity.audit, vrt.run, reviewKit.create, release.verify, release.tag, diag.snapshot
  - input: apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

- billing.reviewKit
  - input: object Subscription|Invoice|Plan|Usage, fixtures["stripe","chargebee"], apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath, preview diffs/specimens

- billing.switchFixtures
  - input: provider stripe|chargebee, apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath, preview diffs/stories

Transport: newline-delimited JSON via stdio: { id?, tool, input }
