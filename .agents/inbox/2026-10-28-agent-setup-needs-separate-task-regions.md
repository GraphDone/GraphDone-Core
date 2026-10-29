# Agent setup needs separate task regions and honest access availability

On 2026-10-28, the owner reported that Your agent lacked structure. Headed inspection of dev `00f0211` showed API limits above the first action, followed by token setup, saved access and notes in one undifferentiated column. At phone width the native permission option clipped its explanation. The same component also appears inside the narrower Agents-page column.

## Evidence

- The revised component separates connection setup, project access and shared notes, with collapsed API/sharing details below. Desktop uses two columns; narrow/embedded surfaces retain one. Permission names are short, with complete explanations outside the native select.
- `TEST_URL=<owned-loopback-preview> npx playwright test tests/e2e/quality/agent-collaboration.spec.ts --project=GraphDone-Core/dev-neo4j/chromium --headed --workers=1 --retries=0 --trace=retain-on-failure`: first run 1 passed / 2 failed in 53.63s. Both failures were stale mobile navigation expectations: current mobile/short-landscape entry is More → Connect an agent to this project. No timeout/retry/assertion was relaxed.
- After using the actual entry, 3 cases passed in 32.66s at 390×844, 844×390 and 1440×900. The journeys create owned project-scoped credentials, exchange human/agent notes through the actual API, check read-only enforcement and revocation, and inspect the embedded component. Geometry receipts and screenshots are file-backed attachments; secrets are hidden/masked and owned credentials revoked during cleanup.
- Focused component checks pass 2/2: visible loading and retry after a failed read without access creation; local notes remain usable when token access cannot be fetched, without claiming the token list is empty.
- The existing collaboration spec was not enrolled in the blocking PR matrix. It now has its own bounded serial `agent-connection` sequence, preserving existing sequences. CLI enrollment/failure-evidence controls pass 37/37.

## Cause and corrective rule

A single long form concealed distinct jobs and assumed the viewport width also described the embedded container. Give primary jobs their own headings and boundaries; use readable controls, reserve space for explanations, and keep technical reference secondary. Check the actual phone navigation and embedded placement, not only desktop screenshots. Failed/unavailable reads must not masquerade as an empty successful result. A refresh action should update notes without requiring more background polling.

## Limits

Local visual evidence uses owned Core fixtures, not hosted D1. Component tests model offline availability but do not establish a production offline synchronization contract. The explicit real-inference opt-in remains separate; these API journeys spend no inference credits. Full final-source hosted gates and independent review remain required for integration.
