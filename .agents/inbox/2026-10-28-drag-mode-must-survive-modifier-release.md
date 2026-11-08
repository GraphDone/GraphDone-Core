# A drag must retain its starting mode and discard temporary state when it ends

Date: 2026-10-28. Existing inspector/read-only-gesture, durable-layout and
interaction-context lessons were searched before this follow-up to issue225.

## Evidence and cause

Independent probes extracted the actual D3 callbacks from dev a531823 and
candidate6f9379a. In both, holding Alt at pointer-down returned before setting
`_dragStart`. Releasing Alt before movement then read an undefined start and
threw. After a previous real drag, both reused its stale start/neighbor metadata
and persisted an unintended position. Candidate6f9379a also reheated before the
fresh-node error. The underlying missing/stale state predates this PR; the
candidate did not eliminate it.

The real headed browser negative on6f9379a failed in11.69s with three page errors:
`Cannot read properties of undefined (reading 'x')`. Command:
`playwright test tests/e2e/graph/layout-recovery.spec.ts --grep 'latest real drag'
--project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0
--trace=retain-on-failure --reporter=json`. Only an owned disposable graph was
used. The failure occurred in the fresh-node Alt-release sequence before the
normal drag/recovery steps, so that run proves the fresh-node failure only.

## Corrective rule

Choose drag versus connection intent at pointer-down. Clear old temporary state
before making that choice. Only a gesture initialized for movement may move,
pin, reheat or enqueue positions; changing a modifier mid-gesture must not
reinterpret it using missing or stale metadata. Clear temporary start/neighbor
state and the dragging flag on every end in the active graph/simulation scope,
including no-op and connection exits. Preserve the existing scope guards,
accepted-position queue and durable recovery protocol.

## Regression and limits

The existing actual latest-drag recovery journey now releases Alt during a
fresh gesture and again after two real drags. It checks no page errors, unchanged
node positions, no extra queue attempts and unchanged durable receipts before
the original reload/IndexedDB hydration/retry checks. Its result is a real JSON
attachment file. The inspector desktop/phone no-write journeys also reran. All three local
journeys passed in53.80s, zero retries, with fresh and post-drag Alt gestures
leaving positions unchanged and zero page errors. This is focused browser
evidence, not a replacement for the full hosted matrix.
Independent callback probes distinguish pre-existing behavior from the current
correction; they do not replace actual native-browser evidence.

This does not establish every relationship-creation gesture or solve item
obstacle routing. Those retain their own interaction and geometry acceptance.
Final exact-source review, complete relevant CI/artifacts and actual post-dev
acceptance remain required; retain the failing run as well as the correction.
