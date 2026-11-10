# `packages/server/src/routes/` — unused Express router

This folder holds one older Express auth router. It is not mounted by the
server: nothing imports it. The live `/auth/*` routes are defined directly in
[`../index.ts`](../index.ts) with handlers from [`../auth/`](../auth/README.md).

```mermaid
flowchart LR
  routes["routes/auth.ts"] -.->|"not imported"| index["index.ts"]
  index -->|"defines /auth/* itself"| handlers["auth/ handlers"]
```

## What's here

| Path | What it is |
| --- | --- |
| [`auth.ts`](auth.ts) | A Passport-based router with its own JWT helper and OAuth callback routes. Unused. |

Up: [`src/`](../README.md)
