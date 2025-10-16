# Artifact Viewer

The Agent panel now includes a persistent Artifact Viewer so engineers can browse the current run and historical bundles without leaving Storybook.

## Panel Experience

- **Latest Run** selects the most recent bundle returned by the bridge.
- **Run history…** opens an overlay to choose any stored run; selections announce to screen readers and refresh the table in-place.
- **File table** renders a virtualized view (200+ rows) with columns for file name, purpose, size, short hash, and an `Open` action. Hash copy uses the system clipboard and announces success/failure.
- **Diagnostics payload** collapses into a details element for quick inspection of `diagnostics.json` when present.

## Bridge Endpoints

| Method & Path              | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `GET /runs`                | Lists runs as `{ id, date, summary, tool? }`.     |
| `GET /runs/:id`            | Returns the `diagnostics.json` payload (or null). |
| `GET /runs/:id/files`      | Lists bundle files with `{ id, name, purpose, size, sha256, openUrl }`. |
| `GET /runs/:id/files/:fileId/open` | Redirects to a sanitized static artifact URL. |

Run and file identifiers are base64url-encoded; the UI never constructs paths manually and always follows the returned `openUrl`. Server-side guards ensure access stays within `artifacts/current-state`.
