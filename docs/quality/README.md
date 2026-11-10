# `docs/quality/` — quality gates, runbooks and validation records

How we decide GraphDone is good enough to ship, and the evidence from each time we
checked. Standing documents define the gates and how to run them. Dated records
(`*_YYYY-MM-DD.md`) each capture one investigation: the commit tested, the
commands run, what was observed and what remains unproven.

```mermaid
flowchart LR
  gates["Standing gates"] --> runbook["RUNBOOK.md sequences"]
  runbook --> harness["tests/ unified harness and CI"]
  harness --> records["Dated validation records"]
  records --> lessons[".agents/inbox lessons"]
```

## Standing documents

Start with [`RELEASE_GATES.md`](RELEASE_GATES.md) to see what must pass before a
release, then [`RUNBOOK.md`](RUNBOOK.md) to run the same checks yourself.

| File | What it is |
| --- | --- |
| [`RELEASE_GATES.md`](RELEASE_GATES.md) | How promotion to `main`, image publication and deployment are gated |
| [`RUNBOOK.md`](RUNBOOK.md) | Repeatable quality sequences to run locally against disposable fixtures |
| [`TEST_STRATEGY.md`](TEST_STRATEGY.md) | What the suites cover and, just as important, what they do not prove |
| [`RELEASE_QC.md`](RELEASE_QC.md) | Release QC ledger |
| [`NEW_USER_GATE.md`](NEW_USER_GATE.md) | The questions a first-time user would ask, checked at every gate |
| [`UI_FIT.md`](UI_FIT.md) | The UI fit gate: every screen on iPhone, iPad and desktop |
| [`SCENARIOS.md`](SCENARIOS.md), [`SCENARIO_RESULT_TEMPLATE.md`](SCENARIO_RESULT_TEMPLATE.md) | End-to-end scenario catalogue, and the form for recording a run |
| [`AUTH_LINK_LIFECYCLE.md`](AUTH_LINK_LIFECYCLE.md), [`OAUTH_IDENTITY.md`](OAUTH_IDENTITY.md) | Contracts for email-link sessions and OAuth account linking |

## Dated records (October 2026)

Most titles state the rule the investigation established.

| File | What it established |
| --- | --- |
| [`CORE_VALIDATION_2026-10-23.md`](CORE_VALIDATION_2026-10-23.md) | Core merge validation |
| [`DETAILS_SAVE_COMPLETION_2026-10-23.md`](DETAILS_SAVE_COMPLETION_2026-10-23.md) | A save acknowledgement must keep edits made after submitting |
| [`DURABILITY_REVIEW_2026-10-23.md`](DURABILITY_REVIEW_2026-10-23.md) | Pending saves must survive switching views; deleting needs settled connection evidence |
| [`LAYOUT_RECOVERY_BROWSER_2026-10-23.md`](LAYOUT_RECOVERY_BROWSER_2026-10-23.md) | Layout recovery needs a real navigation and server read-back test |
| [`MAGIC_LINK_REPLAY_2026-10-23.md`](MAGIC_LINK_REPLAY_2026-10-23.md) | A single-use email token is consumed before identity is returned |
| [`MCP_CPU_TESTING_2026-10-23.md`](MCP_CPU_TESTING_2026-10-23.md) | Graph unit tests control CPU samples without disabling CPU protection |
| [`NEW_USER_GATE_REVIEW_2026-10-23.md`](NEW_USER_GATE_REVIEW_2026-10-23.md) | Wait for a save acknowledgement before testing saved-state navigation |
| [`PASSWORD_LOGIN_LIMITS_2026-10-23.md`](PASSWORD_LOGIN_LIMITS_2026-10-23.md) | Password failures are counted on the server for every login call |
| [`PRODUCTION_SECRETS_2026-10-23.md`](PRODUCTION_SECRETS_2026-10-23.md) | Production startup rejects default secrets |
| [`RUNTIME_VALIDATION_2026-10-23.md`](RUNTIME_VALIDATION_2026-10-23.md) | Runtime upgrades are tested through startup and owned browser fixtures |
| [`SECURITY_SCOPE_2026-10-23.md`](SECURITY_SCOPE_2026-10-23.md) | Security coverage and remaining work from the October 23 sweep |
| [`TEST_TIMEOUT_REVIEW_2026-10-23.md`](TEST_TIMEOUT_REVIEW_2026-10-23.md) | A wrapper timeout must also stop its test workers |
| [`DYNAMIC_LOD_VALIDATION_2026-10-27.md`](DYNAMIC_LOD_VALIDATION_2026-10-27.md) | Semantic overview validation, with desktop and phone screenshots |
| [`REMAINING_TOOLING_2026-10-27.md`](REMAINING_TOOLING_2026-10-27.md) | Turbo and Mermaid consumer migration |
| [`RUNTIME_IMAGE_PACKAGING_2026-10-27.md`](RUNTIME_IMAGE_PACKAGING_2026-10-27.md) | Runtime dependency packaging in the container images |
| [`TOOLCHAIN_MIGRATION_2026-10-27.md`](TOOLCHAIN_MIGRATION_2026-10-27.md) | Patched build and test toolchain |
| [`LAYOUT_RECOVERY_2026-10-28.md`](LAYOUT_RECOVERY_2026-10-28.md) | Pending layout recovery across reload and browser crashes |
| [`NESTED_LOD_VALIDATION_2026-10-28.md`](NESTED_LOD_VALIDATION_2026-10-28.md) | Nested semantic LOD validation |
| [`SCHEMATIC_ROUTING_VALIDATION_2026-10-28.md`](SCHEMATIC_ROUTING_VALIDATION_2026-10-28.md) | Schematic routing validation (study in `schematic-routing-study/`) |
| [`SELF_HOST_OS_TRIAGE_2026-10-28.md`](SELF_HOST_OS_TRIAGE_2026-10-28.md) | Self-host base image maintenance; the full Debian advisory list is the `.csv` beside it |

## Folders

| Path | What it is |
| --- | --- |
| [`images/`](images/README.md) | Screenshots embedded in the LOD validation record |
| [`schematic-routing-study/`](schematic-routing-study/README.md) | Contact sheet and metrics for the wire-routing studies |

Up: [`docs/`](../README.md)
