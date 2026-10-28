# Browser acceptance needs an owned session bus when the desktop bus disconnects

Observed 2026-10-28 UTC during the frozen nested LOD candidate validation. A
search of `.agents/`, browser helpers and Playwright configuration found no
existing D-Bus disconnection lesson. This is an infrastructure failure, not a
passing browser run or evidence of an application regression.

## Evidence

```text
2026-10-28
xvfb-run --auto-servernum node tests/run-unified.mjs --sequence layout-recovery
source: a311154bf154af977a238d4b5de55773efa4e2dc, clean and unchanged
result: 8 passed, 1 browser case failed, 1 execution-evidence failure, exit 1
Chrome: FATAL:dbus/bus.cc:1245] D-Bus connection was disconnected. Aborting.
case: revoked graph writes and deleted graphs retain scoped recovery
```

Retained report/trace: `/tmp/graphdone-resolution-20261027/nested-layout-a311154-owned-env/`.
The invoking process inherited a session bus address under `/run/user/`; that bus
path existed during the subsequent check. The evidence does not identify what
disconnected the bus, whether the session or system connection caused the fatal
error, or another process responsible. Do not invent an attribution.

A previous run at the same source failed the explicit owned-Neo4j credential
precondition before that case performed mutations. Its eight passes and failed
precondition remain in `nested-layout-a311154/`. Supplying only the three owned
Neo4j variables corrected that setup error; it did not excuse this later abort.

## Corrective rule

Keep the source and index frozen, preserve the failed trace, and run the browser
under `dbus-run-session -- xvfb-run --auto-servernum ...` with the same cases,
assertions, budgets and zero retries. This gives the invocation its own session
bus without changing the user's services or killing unrelated processes. Use
only the owned database credentials and retain strict teardown. The isolated
run still must pass; launching it alone is not acceptance.

## Avoid desktop service activation in the owned bus

The default private-session run also failed and remains retained in
`nested-layout-a311154-private-bus/`: eight cases passed; the owned Chrome
SIGKILL/restart case exceeded its unchanged 90s budget. Its two first app
navigations took 26.353s and 27.587s. The log records desktop portal/secret-service
activation reaching the default 120s service-start timeout. Review confirmed the
portal was initially requested by ordinary Playwright Chrome, which already uses
isolated password-store flags. These correlated observations do not prove the
raw helper's missing flags caused the delays.

The installed `dbus-daemon(1)` documentation and `/usr/share/dbus-1/session.conf`
show that service directories enable automatic desktop-service activation. A
narrower invocation uses a temporary private config with a Unix socket, EXTERNAL
authentication, session type and same-user messaging policy, with no service
directories or inherited configuration. It changes no desktop/system service.
Retained `browser-session-bus.conf` and `browser-session-bus-preflight.log` show
`ListActivatableNames` returning only `org.freedesktop.DBus`. The strict command
adds `--config-file=/tmp/graphdone-resolution-20261027/browser-session-bus.conf`
to `dbus-run-session`; all application/test source, cases, limits and retries
remain unchanged. Actual resulting acceptance remains required.

## Limits

This local invocation adjustment does not prove the desktop bus root cause or
prevent every system-bus/Chrome crash. It does not change CI policy or justify
retrying unexplained application failures into a pass. No application code or
browser timeout was changed for this incident.

## Owner-directed workstation limits

On 2026-10-28 the owner reported a window-manager crash and requested small visual
checks without overloading the local PC. The minimal-bus run was interrupted at
that point: 7 cases passed (including owned SIGKILL/restart and revoked/deleted
access), 2 required cases skipped, and execution evidence failed. It remains
incomplete at `nested-layout-a311154-minimal-bus/`; neither the earlier remote CI
pass nor the seven local cases turn that interruption into a local suite pass.

The host snapshot showed 45 GiB used RAM, 13 GiB swap used and load averages
13.59/23.09/44.31. This is observation after the report, not proof that GraphDone
or another process caused the desktop crash. The agent stopped its active test
process group, 14 verified owned API/Vite/preview listeners and 3 owned containers.
The owner's localhost 8540 and unrelated processes were left untouched. Retained
fixtures/data and negative artifacts were not deleted.

Use small deterministic geometry tests and static SVG rendering for iteration.
Run scoped component checks serially at low priority, with one worker; no browser
or database is needed for the basic wire-clutter gate. Put full build/database/
browser/image matrices in CI. Bring up only the specific owned preview needed
for a bounded inspection, then stop it. Do not accumulate obsolete previews or
turn each uncertain timeout into another local full-suite run. Geometry metrics
must include exact relationship accounting and useful visible content so hiding
all wires cannot manufacture a clean result.
