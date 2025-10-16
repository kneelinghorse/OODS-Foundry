Tool Contracts (v0.1)

- tokens.build
  - input: brand A, theme light|dark|hc, apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

- a11y.scan, purity.audit, vrt.run, reviewKit.create, release.verify, release.tag, diag.snapshot
  - input: apply=false
  - output: artifacts[], transcriptPath, bundleIndexPath

Transport: newline-delimited JSON via stdio: { id?, tool, input }
