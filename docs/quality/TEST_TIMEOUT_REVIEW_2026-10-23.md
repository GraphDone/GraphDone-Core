# A wrapper timeout must also stop its owned test workers

Date: 2026-10-23. Tracking: [issue #162](https://github.com/GraphDone/GraphDone-Core/issues/162).

## Evidence and cause

The previous `runCommand` killed only its immediate child and resolved on that
child's `close` event. An `npx` wrapper can have test-runner descendants that
inherit its output pipes. Killing the wrapper does not stop those descendants,
and the open pipes keep `close` from firing.

A bounded local Node probe configured `timeoutMs: 100`, started a descendant
that wrote after 1,000 ms, and returned this result on 2026-10-23:

```json
{"code":null,"stdout":"descendant still running after parent timeout\n","durationMs":1069,"timedOut":true}
```

Before the fix, the focused regression command was:

```bash
node --test tests/lib/runner/runSequence.test.mjs
```

The ordinary-descendant and pre-exited-wrapper cases each took approximately
4,060 ms despite a 600 ms timeout. A descendant that closed its output and
ignored SIGTERM remained running after the promise resolved. An escaped-group
fixture also held output pipes open past the deadline.

## Corrective rule

On POSIX, spawn each command in its own process group and address only that
group. On timeout, send SIGTERM, wait the bounded grace period, then send
SIGKILL. Complete forced cleanup even if the wrapper closed during the grace
period. Bound output draining separately so an escaped descendant cannot hold
the caller forever. Always return `timedOut: true` after a deadline, including
when the wrapper exited with code zero.

Detaching a command also separates it from the terminal's process group. The
runner therefore shares one SIGINT/SIGTERM cleanup handler across all active
commands, immediately forces cleanup of their owned groups, and removes its
handlers when the last command settles. Cleanup is prepended ahead of existing
caller-owned handlers, including handlers that exit immediately; those handlers
remain in control of exit behavior. Otherwise cancellation exits with 130/143.

## Regression coverage and limits

The focused file uses real local Node processes and temporary files. It checks
ordinary descendants, ignored SIGTERM, closed pipes, already-exited wrappers,
unrelated-process survival, bounded escaped-group output, simultaneous-command
interrupts, listener removal, and preservation of caller signal handling.
Success output, working directory, environment, literal argv, and spawn errors
remain covered. The existing `npm run test:unified:lib` discovers these tests.

On 2026-10-23, `node --test tests/lib/` passed all 117 tests, including the 12
new process-runner cases; `git diff --check` passed. The failing-before cases
establish that the new checks detect the previous timeout behavior.

Linux validates group cleanup. POSIX-specific tests skip Windows, where the
runner only terminates the direct child and bounds its pipe wait. Deliberately
detached descendants remain outside the original group and are not a supported
containment boundary. The escaped-group fixture is explicitly cleaned up by
its test. SIGKILL of the runner, OS stalls, and a blocked Node event loop cannot
be repaired by a JavaScript signal handler. Production services, application
data, and browser acceptance are outside this regression's scope.
