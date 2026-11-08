# Verify emitted typography after refreshing a long-running preview

On 2026-10-28, the owned GraphDone headed preview still displayed some small
text after the readability change. Searching the symptom index and existing
readable-symbol, dependency-parser and preview lessons found no matching
configuration-refresh incident.

The preview and reviewed source had identical `packages/web/tailwind.config.js`
bytes (SHA256 `ab33c1897cd34ea18ff04cd6ef644558b59254dcaeb6120225eef4951e8f3ff8`).
Nevertheless, reading the actual browser CSS rules before restart returned:

```text
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.font-normal { font-weight: 400; }
```

The document root was 16px. Visible graph counts, connection status and sidebar
labels consequently measured 12px. The long-running Vite process had received
source updates; source-file identity did not establish emitted-style identity.
Only the owned Vite process was stopped and restarted from its web package with
the same loopback API proxy. Reloading the same headed browser then returned:

```text
.text-xs { font-size: 0.875rem; line-height: 1.25rem; }
.font-medium { font-weight: 600; }
.font-normal { font-weight: 500; }
```

No product source changed. This establishes stale preview styling, consistent
with retained build/configuration state; it does not isolate a specific Vite or
Tailwind cache implementation. A fresh independent exact-source PostCSS compile
also emitted the intended rules in 1.37 seconds, using locked Tailwind 3.4.19,
PostCSS 8.5.28 and autoprefixer 10.4.21. See [the issue evidence](https://github.com/GraphDone/GraphDone-Core/issues/222#issuecomment-6477709156)
and [independent review](https://github.com/GraphDone/GraphDone-Core/pull/223#pullrequestreview-5688035698).

Corrective rule: after copying build or typography configuration into an existing
preview, restart that owned preview and read computed styles from real controls.
Do not stop unrelated services, assume hot reload refreshed configuration, or
equate matching source hashes with matching generated CSS. Keep one headed
browser and bounded serial checks on the shared workstation.

The existing desktop/phone relationship-priority journeys now measure the actual
graph title, graph counts, visible Connections dock and Links control. They require the 14px/500 secondary
baseline, 14px/600 heading and 16px/600 control, reject a deliberate 12px/400
visible counter, restore its original style, and retain named before/negative/after
computed samples in `priority-typography.json` using file-backed attachments.

Limits: these samples do not audit every page or every font. Earlier local SVG
geometry checks remain evidence for their explicit assertions, not for all app
utilities. The preceding CI build passed but did not retain generated CSS bytes;
neither source compilation nor screenshots are retroactive byte-level inspection
of that CSS. The strengthened journey must pass on its final committed source.

The first refreshed-style run, `priority-typography10`, passed both complete
journeys in 25.28 seconds without retries. Actual JSON samples showed 14/600,
14/500 and 16/600 before/after, and the injected counter was 12/400. Inspection
also exposed a stale relationship count; its separate cause and correction are
recorded in [the deletion lesson](2026-10-28-edge-deletion-must-refresh-subscribed-counts.md).

The phone intentionally hides the header count with its existing responsive
CSS. That sample verifies emitted styling and subscribed data, not visible
phone-counter readability. The final test also requires the actual Connections
dock to be visible and readable, records visibility for every named sample, and
applies the 12px/400 negative to that visible dock on phones.

Final focused run `priority-typography16` passed both full journeys in 25.81
seconds with zero retries. Its JSON explicitly distinguishes the hidden phone
header from the visible 14px/500 dock and records the visible negative target.
