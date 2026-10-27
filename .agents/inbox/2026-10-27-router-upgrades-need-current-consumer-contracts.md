# Validate the installed router contract and real navigation controls

On 2026-10-27, the #186 router work started at dev
`8712389e24f567f5b3e6ed132c1ac5d4dafb21fa`. A fresh-cache production audit
reported five moderate entries: Router/DOM and UUID/federation/subgraph. The
[navigation advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) and
[hydration advisory](https://github.com/advisories/GHSA-337j-9hxr-rhxg) both
identify7.18.0 as fixed. The selected Router/DOM7.18.4 retains React18 and the
existing declarative BrowserRouter; its Node20 minimum fits supported Node22/24.
The [versioned migration guide](https://reactrouter.com/7.18.4/upgrading/v6)
was checked. No multi-segment splat route, data router or component-local lazy
page declaration was found in the live app routes.

The first navigation test copied an older upstream normalization expectation.
Router6.30.6 failed three mixed-separator cases; installed7.18.4 rejected all four
external-looking destinations instead of navigating to a normalized internal
path. That four-case failure was a test-contract mismatch, not an application
regression. Inspection of the installed `validateNavigationTarget` established
the actual rejection boundary. The corrected control captures the thrown error
and requires the route to remain unchanged. Reinstalling the original locked6.30.6
then running the final control produced **4 failures and1 history pass**;
the7.18.4 control plus existing role guards produced **9 passes**.

The first six actual-browser cases produced **4 failures and2 passes**, with no
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
actual-browser suite covers GraphDone routes at1440px and390px. No hostile
application-controlled destination, SSR hydration surface, live provider
callback, deployed revision or broad security clearance is claimed. Test tokens
are confined to disposable local/CI accounts; failure traces are not public
credential samples. Local evidence is retained in
`/tmp/graphdone-resolution-20261027/router-*` and this record travels with the fix.
