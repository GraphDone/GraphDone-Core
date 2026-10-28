# Magic-link symptom index

| Symptom | Evidence and corrective rule |
| --- | --- |
| Login and reset links cross-use, or a reset/reactivation revives old sessions | [Bind purpose and session revision at the write](../inbox/2026-10-27-email-purpose-and-revision-are-auth-boundaries.md); real SQLite/HTTP/WebSocket `auth-link-boundary.test.ts` |
| One email token returns identity more than once under concurrent verification | [Guarded token-consumption lesson](../inbox/2026-10-23-magic-link-consumption.md); `packages/server/tests/magic-link.test.ts` |
| Token consumption fails but the caller still receives identity, or an inactive account signs in by email | [Correction and failure behavior](../../docs/quality/MAGIC_LINK_REPLAY_2026-10-23.md); real SQLite error/inactive-account regressions |
