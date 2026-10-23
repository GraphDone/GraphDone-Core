# Builds and save acknowledgements need boundary-specific validation

Date: 2026-10-23. Existing guidance searched: `docs/quality/TEST_STRATEGY.md`,
the dated runtime/durability lessons, and `.agents/issues/INDEX.md`. This pointer
keeps the detailed incident records canonical rather than duplicating them.

| Symptom / cause | Canonical dated evidence, correction and limits |
| --- | --- |
| A successful build hid API peer-resolution and launcher failures | [Runtime validation](../../docs/quality/RUNTIME_VALIDATION_2026-10-23.md): use a pinned clean install, actual startup, supported runtimes and owned browser fixtures. Container/build success alone is not deployment evidence. |
| Missing/default production secrets were accepted; `.env` loaded after key capture | [Production secrets](../../docs/quality/PRODUCTION_SECRETS_2026-10-23.md): validate configuration before authentication initializes; negative controls must stop before DB/listen, with configured positive controls. The later integrated lint check found an ambient type annotation missed by typecheck; the type-only follow-up preserves runtime behavior. |
| A delayed save/refetch erased a newer date edit or repopulated cleared undo history | [Details-save completion](../../docs/quality/DETAILS_SAVE_COMPLETION_2026-10-23.md): preserve newer fields, scope completion to the current editor, require the expected acknowledgement, and retain the undo clear generation. Real Apollo regressions preserve failing-before evidence; they do not replace the combined browser gate. |

Commands, observed outputs, source revisions and scope limits remain in those
dated records and the [Core merge-validation ledger](../../docs/quality/CORE_VALIDATION_2026-10-23.md).
Keep failed runs and synthetic execution failures distinguishable from product
cases. Carry these pointers and their regressions through public review; neither
an unpublished local note nor a pending ledger field is a release pass.
