# Additional fixture edges must share ownership cancellation and draining

Observed 2026-10-28 UTC during independent review of
`2df89e003327cc5065ca48ea2fe0e89fcd6f4d47`. The existing cold-fixture and ownership
lessons were searched first. This is the same timeout class at an extra-write
boundary, not a reason to raise a browser test timeout.

## Evidence

The reviewed nested fixture added four batches after `ownedGraphIds.seed()` had
resolved. Those writes were outside the owner's AbortController/pending-task set.
Review identified that a setup timeout could start cleanup while later batches
continued. This race was found in source review; it was not observed against a
real database and is not claimed as a reproduced production incident.

```text
2026-10-28, Node 22.18.0, browser-free child runner
node --test --test-name-pattern=late-edge-response tests/lib/runner/owned-graph-fixture.test.mjs
  before seed support: 0 passed, 1 failed (1.59s)
  old seeder ignored additionalEdges; child succeeded instead of exercising
  the required delayed extra-edge timeout

node --test tests/lib/runner/owned-graph-fixture.test.mjs
  corrected final source: 4 passed, 0 failed, no skips (6.07s)
  observed order: create graph, create nodes, request two edges, finish response,
  unroute, delete edges, delete items, delete graph, verify graph absent
  no subsequent edge batch after timeout
```

The regression runs the actual owned fixture/seed helper through Playwright's
runner with a fake Page. It launches no browser or database. Retained logs:
`schematic-owned-extra-edges-negative.log` and
`schematic-owned-extra-edges-final.log` under the owned evidence directory.

## Corrective rule

Pass additional typed edges as source/target indices into the existing seed
operation. Validate indices before writes, resolve IDs after node creation, and
append the extra edges to the same bounded, signalled batch loop. Verify every
batch's returned count. The owned fixture then aborts future batches and drains
the in-flight response before edge-first cleanup. Do not create a second, untracked
mutation loop after a tracked seeder has resolved.

## Limits

The small regression proves lifecycle ordering under a controlled delayed response,
not backend correctness or browser acceptance. The 72-node real CI fixture must
still prove all 71 hub neighbors, exactly one self-loop, exact internal/bundle
partitions and unchanged final API readback. Preserve its existing fixture/test
budgets, one worker, zero retries and strict cleanup. No heavy local stack is needed.
