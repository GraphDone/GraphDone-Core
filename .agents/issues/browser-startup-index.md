# Browser startup evidence symptoms

| Symptom | Lesson and regression |
| --- | --- |
| `main` never appears and the screenshot still says GraphDone Loading; failed route is unknown | [Distinguish static shell from mounted application](../inbox/2026-10-23-browser-startup-evidence.md); labeled `button-content.spec.ts` steps and bounded diagnostics |
| Strict zero-retry acceptance has no trace, or a later suite deletes earlier trace/diagnostic files | [Retain failure evidence independently of retries](../inbox/2026-10-23-browser-startup-evidence.md); `tests/lib/runner/unified-cli.test.mjs` |
