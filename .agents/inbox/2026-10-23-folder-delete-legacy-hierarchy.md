# Deletion authority includes pre-existing descendant folders

On 2026-10-23, review of SEC-FOLDER-1 found that validating a folder's owner was insufficient when older records could place another user's folder below it. The new creation/reparenting checks prevent new cross-domain trees, but do not repair existing records.

## Evidence

The real in-memory SQLite fixture initializes with `PRAGMA foreign_keys=0`, matching the store's current connection defaults. Deleting an owned parent succeeds and leaves a foreign descendant with a missing ancestor. With `PRAGMA foreign_keys=1`, the declared `ON DELETE CASCADE` removes the foreign descendant. Both the standalone and Neo4j-generated GraphQL schemas reached this SQLite behavior. No shared or production database was used.

Command: `npm run test --workspace @graphdone/server -- tests/folder-authorization.test.ts` with the new tests copied onto commit `0c2322cdfb2669c7fb2c057ea62df583736aba62`.

Observed on 2026-10-23: **10 failed, 32 passed**. The failures cover nested foreign descendants with foreign keys off/on, another writable ownership domain, and destinations inside the deleted subtree. With foreign keys on, the foreign descendant query returns an empty array after deletion. A legitimate same-domain cascading deletion remains a passing control.

After correction, `npm run test --workspace @graphdone/server` reports **70 passed**, including all 42 folder cases; server typechecking passes. Local evidence: `/tmp/graphdone-folder-subtree-baseline-final.log` and `/tmp/graphdone-folder-subtree-full-green.log`. These local paths are evidence pointers, not published validation artifacts.

## Cause and corrective rule

Authorization must cover every record a destructive operation can affect, including records connected through database cascades. Before moving any graph references or deleting a folder, recursively enumerate existing descendants, require write access to each, and require the same ownership domain. Reject a graph destination that is the deleted folder or one of its descendants. Use a cycle-safe recursive query so malformed legacy trees cannot loop indefinitely.

## Limits

This change does not migrate malformed hierarchies, enable foreign-key enforcement, or redefine valid same-domain folder deletion. It tests actual SQLite and both GraphQL schemas; graph metadata and the Neo4j version probe are simulated. Live backend and browser validation remain separate release gates. The repository had no `.agents/WRITING-IT-DOWN.md` or existing lesson index when this incident was recorded; the related API guidance and regression suite carry the rule with the fix.
