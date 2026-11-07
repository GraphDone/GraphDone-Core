# Development quick login does not verify the manual sign-in path

The first isolated production run on 2026-10-24 used clean candidate
`83400ac5522c02a80eb50586b187fb33724635fb`. Build, API/Neo4j readiness, generated
admin HTTP login, owned graph seed/readback/cleanup and API recreation passed.
All six actual browser smoke cases then failed; the strict adapter also recorded
the nonzero process exit. The source fingerprint stayed unchanged and owned
containers, volumes and networks were confirmed removed.

The retained `test-artifacts/release-production/run-rgaac8/smoke/report.json`
reported `passed: 0`, `failed: 7`, `skipped: 0`; each real case said:

```text
Login failed after 3 attempts for user: admin. Last error: Password field not found
```

The first screenshot (`assets/prod-smoke/0.png`) showed the Passwordless tab
selected. Its trace (`1.zip`) recorded repeated visits to `/login-form`, but
`App.tsx` only defines `/login`; the wildcard sends the obsolete route back to
the default sign-in page. `Signin.tsx` defaults `initialMagicLink=true` and
exposes an accessible `Password` tab. The helper's development quick-login path
bypassed mode selection, hiding the defect until production removed those
development controls.

The correction is in the test helper: navigate to `/login`, explicitly select
the exact Password tab, assert its selected state and the actual labeled form
fields, then enter the generated credentials through the existing form flow.
It changes no application authentication behavior, verification controls,
test deadlines or retries. The unchanged six-case strict production sequence is
the regression: each fresh browser context must use the actual production form.
Its next run must be retained separately; the initial failure is not overwritten
or reclassified as passing. Production evidence remains pending until that run
and its cleanup complete.

The rule is to exercise each authentication path in the environment where it
exists. Success through a development shortcut says nothing about the manual
form's selected mode, accessible fields or production credentials.
