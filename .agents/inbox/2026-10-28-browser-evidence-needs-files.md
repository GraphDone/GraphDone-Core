# Browser evidence must exist as files before report collection

2026-10-28, PR #224. Independent review comment4404454674 verified that
`runPlaywrightSequence` ignores attachments without a path. The new priority
journeys used `info.attach({body})`; the actual Playwright JSON normalizer retained
body/no path, and the real adapter probe returned a passing case with zero
attachments and zero errors. The517742c2,000-item stage completed successfully
in CI40742884920 at18:22:57UTC, but this did not establish retained priority
accounting evidence. Preserve that distinction and the earlier report.

Cause: producer-side inline attachments did not meet the existing unified
collector's file-path contract. A green browser assertion alone does not prove
that another machine can inspect its measurements or screenshots.

Corrective rule: write JSON via `info.outputPath` and `writeFile`, save screenshots
to output paths, then attach by `path`. Required evidence must survive the actual
unified report and uploaded archive, not only Playwright's in-memory report.
Do not weaken owned-path checks or silently call missing evidence accepted.

The corrected1440px headed priority journey passed in13.09s with one worker and
zero retries. Its actual JSON report lists file attachments for
`priority-accounting.json` (3193 bytes) and `priority-fallback.png` (61545 bytes),
and both files exist. Retained local report: `priority-artifacts6.json` in the
owned resolution evidence directory. The2,000-item case now writes and attaches
`two-thousand-priority.json` by the same existing pattern; it is not rerun locally
under the workstation resource constraint.

Limits: this is a correction to the new test producers, not a claim that all
legacy inline attachments are collected. Final exact-source CI must execute the
large case and independently verify its retained counts, screenshots, artifact
paths and source fingerprint. No runtime or policy behavior changed.

Independent inspection of the materialized 9b8409c image found a second evidence
gap: the screenshot showed an almost empty canvas after reload/inspection, even
though canonical fallback IDs were correct. The test now waits for camera
readiness, frames the owned pair, and requires its actual painted stroke and
visible “Depends On +1” label. It uses the shared symbol oracle, including useful
visible titles, minimum text/wire weight, and label/card/wire clearance.

The first strengthened run (`priority-artifacts7`) rejected a painted horizontal
SVG path because Playwright's area-based visibility predicate sees zero height.
The replacement checks ancestor visibility, actual stroke/opacity/length and
viewport intersection. The next run (`priority-artifacts8`) correctly rejected
the 390px scene: its horizontal endpoint titles were both off-screen. The phone
fixture now positions the same owned Gateway/Worker pair vertically before the
API baseline is recorded. No assertion or source-position invariant was relaxed.
Both desktop 1440 and phone 390 journeys passed in 25.17s in
`priority-artifacts9`, with actual geometry JSON, PNG and accounting files. The
phone image shows both endpoint titles and the fallback connection; the desktop
image shows four cards. All failed reports/images remain retained. This remains
a test/evidence correction; no product defect was established by these failures.
