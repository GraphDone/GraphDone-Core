# Validate the installed router contract and real navigation controls

On 2026-10-27, the #186 router work started at dev
`8712389e24f567f5b3e6ed132c1ac5d4dafb21fa`. A fresh-cache production audit
reported five moderate entries: Router/DOM and UUID/federation/subgraph. The
[navigation advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) and
[hydration advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg) both
identify 7.18.0 as fixed. The selected Router/DOM 7.18.4 retains React 18 and the
existing declarative BrowserRouter; its Node 20 minimum fits supported Node 22/24.
The [versioned migration guide](https://reactrouter.com/7.18.4/upgrading/v6)
was checked. No multi-segment splat route, data router or component-local lazy
page declaration was found in the live app routes.

The first navigation test copied an older upstream normalization expectation.
Router 6.30.6 failed three mixed-separator cases; installed 7.18.4 rejected all four
external-looking destinations instead of navigating to a normalized internal
path. That four-case failure was a test-contract mismatch, not an application
regression. Inspection of the installed `validateNavigationTarget` established
the actual rejection boundary. The corrected control captures the thrown error
and requires the route to remain unchanged. Reinstalling the original locked 6.30.6
then running the final control produced **4 failures and 1 history pass**;
the 7.18.4 control plus existing role guards produced **9 passes**.

The first six actual-browser cases produced **4 failures and 2 passes**, with no
retries. The two failing assumptions on each viewport were that the sign-in
page always selected Password, and that Admin opened its Users tab. The current
UI preserves the sign-in method and opens Feedback & operations. The corrected
test explicitly selects Password and Users, retains the exact route/content
assertions, and checks that denied users cannot mount the administration heading.
History, lazy-page navigation, viewer guards and fresh-context callback routing
remain required. Final browser and integrated results belong in the PR.

Corrective rule: use the installed consumer and current UI to establish a
regression contract, then run the exact final negative control against the old
locked consumer. Preserve the earlier failing logs; do not treat a test rewrite
or a successful install as proof that navigation remains usable. The lock
regression checks every Router/DOM resolution, not just the manifest range.

Limits: MemoryRouter tests establish library navigation behavior, while the
actual-browser suite covers GraphDone routes at 1440px and 390px. No hostile
application-controlled destination, SSR hydration surface, live provider
callback, deployed revision or broad security clearance is claimed. Test tokens
are confined to disposable local/CI accounts; failure traces are not public
credential samples. Local evidence is retained in
`/tmp/graphdone-resolution-20261027/router-*` and this record travels with the fix.

At frozen `3e5a761dc0b067ed3827dd29fca50d45fb5d3952`, the corrected browser suite
passed 6/6 without retries, the full web suite passed 340/340 and the harness
passed 167/167. Review found the inventory overstated the installed-version guard:
it checked locked ranges and installed-pair equality, which could accept two
equally stale installed copies. The guard now requires each actual web consumer
to satisfy the fixed range and match its resolved lock entry. The inventory
states that exact scope. Refresh the changed harness and final CI before merge.

## Empty-account CI correction

Composed Router head `14a4fcc` [CI 40584829418](https://github.com/GraphDone/GraphDone-Core/actions/runs/40584829418)
completed 50 browser cases in 854 seconds: 48 passed, two viewer cases failed,
plus the harness's failed-process row. This was not a process-budget timeout.
Retained screenshots show the authenticated empty workspace at both widths.
The desktop assertion incorrectly required a populated graph's `view-content`;
the phone login helper did not recognize an authenticated account without a
graph selector. The local fixture had graphs and hid both assumptions.

Use the existing authenticated `workspace-content` container for account-level
route checks and keep login-form exclusion. Router cases additionally assert
`me.role === VIEWER` through the real API before and after the fresh-context
callback. A standalone real-browser control recognizes an empty workspace,
rejects a password form even with workspace markup, and rejects a loading page.
With the old helper, the empty-workspace positive failed deterministically;
this helper correction adds no retry, wait or timeout. Original CI artifacts
remain evidence, and final current-head browser/full CI gates still apply.

The first empty-workspace/password-form negative used a zero-height empty main;
independent review measured it invisible, so that case could pass for the wrong
reason. It now retains visible content and asserts both the workspace and the
password field are visible before requiring an unauthenticated result.

Gate capacity is separate from that failure: focus CI's 44-case new-user sequence
passed in 892 seconds, only eight below the 900-second process budget; UUID's
same suite took 768 seconds. Required LOD and route acceptance now run as separate
blocking sequences after the 42-case new-user suite. All 51 cases remain required
(42 existing, two LOD, seven route/helper controls), with unchanged per-action
and per-test deadlines, one worker and zero retries. CI runs and uploads each
result independently; pr/full profiles also include both new sequences. CLI
contract tests execute the enrollment/trace arguments. Do not describe this as
fixing the original two viewer failures or count superseded runs as passes.
