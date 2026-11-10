# `docs/features/` — feature walkthroughs

Longer, user-side guides to individual features: where to find them in the app,
what each screen does, and who is allowed to use it.

```mermaid
flowchart LR
  user["Signed-in user"] --> graphs["Create and share a graph"]
  admin["User with ADMIN role"] --> panel["/admin pages"]
  graphs -.guide.-> gc["graph-creation.md"]
  panel -.guide.-> as["admin-system.md"]
```

## What's here

| File | What it covers |
| --- | --- |
| [`graph-creation.md`](graph-creation.md) | Creating a graph and taking it from first idea to shared work with a team |
| [`admin-system.md`](admin-system.md) | The `/admin` pages for users, security and system operations; needs the `ADMIN` role |

The design rules these features follow are in [`../design/`](../design/README.md).

Up: [`docs/`](../README.md)
