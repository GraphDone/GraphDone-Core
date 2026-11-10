# `packages/server/src/types/` — type declarations for libraries

TypeScript declaration files that fill gaps in third-party typings. They hold
no runtime code; `tsc` picks them up so the server compiles cleanly.

```mermaid
flowchart LR
  rl["express-rate-limit.d.ts"] -->|"adds req.rateLimit"| index["index.ts rate limiters"]
  oidc["passport-openidconnect.d.ts"] -->|"types the Strategy"| oauth["auth/oauth-strategies.ts"]
```

## What's here

| Path | What it is |
| --- | --- |
| [`express-rate-limit.d.ts`](express-rate-limit.d.ts) | Adds the `rateLimit` field (limit, current, remaining, reset time) to Express's `Request`. |
| [`passport-openidconnect.d.ts`](passport-openidconnect.d.ts) | Declares the `passport-openidconnect` module, which ships no types; used for LinkedIn sign-in. |

Up: [`src/`](../README.md)
