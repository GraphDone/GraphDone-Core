# The “dumb questions” quality gate

These are product acceptance questions, not questions the user has to answer. Ask them at every QC gate from a fresh user's perspective. A screenshot or a successful HTTP response alone is not a pass.

For every question record **PASS**, **FAIL**, **BLOCKED**, or **NOT APPLICABLE**, with the exact build, backend, viewport/input mode, reproduction steps and evidence. Unchecked questions remain BLOCKED. A failure in a primary journey blocks release; optional unsupported features must clearly say so and must not appear to work.

## First visit

1. What is this, and what can I accomplish here?
2. Can I try it without creating an account?
3. What can a guest actually do, and will my work disappear?
4. Why am I being asked to do this extra step? Can it be removed?
5. Can I sign in, recover access, sign out, and tell which account I am using?
6. If an account or provider is unavailable, does the app explain it honestly?

## Finding my way

7. Where am I, which graph am I changing, and how do I get home?
8. Can I switch graphs without showing or editing the previous graph's work?
9. Can I reach every view on my phone without knowing a keyboard shortcut?
10. Can I return from a detail, menu, or dialog with one obvious action?
11. Does browser Back, Forward, a bookmarked route, and a direct reload work?
12. Is the same navigation predictable in portrait, landscape and desktop?

## Doing useful work

13. Can I create my first work item from an empty graph?
14. Can I give it a useful title without filling out a form full of optional fields?
15. Can I open and edit it in one tap/click? Does Enter work on keyboard targets?
16. How do I change status, priority, description, tags, and due date?
17. Did it really save? Is the result still there after reload and in another view?
18. Can I add a progress note, read it later, and distinguish it from verified history?
19. How do I connect existing work or grow a connected item?
20. How do I fix a wrong connection, reverse it, or remove it?
21. Can I undo an accidental change? Is destructive work clearly identified?
22. What happens if saving fails or the network disappears? Can I retry without losing text or duplicating work?
23. What is the fewest number of actions needed to achieve this outcome? Are we making the user do bookkeeping the system already knows?

## Every mode, using the same saved fixture

24. **Graph:** Can I see, frame, select, edit, and connect the real work? Are small controls usable at this zoom?
25. **List:** Can I find and open work without reading every badge?
26. **Overview:** What is happening, what needs attention, and can I open that work directly?
27. **Table:** Are fields understandable, reachable, and consistent with saved data?
28. **Board:** Is actual work visible before empty lanes? Can I open a card and move its status?
29. **Timeline:** Are dates real? What does an unscheduled item mean? Are zoom and navigation useful?
30. **Calendar:** Does scheduled work appear on the correct day? Can I navigate dates and open an item?
31. **Activity:** What actually changed? Is this recorded data, with no fabricated events or authors?
32. **Analytics:** Do totals and filters match this graph, including empty/error states?
33. **Ontology:** What do types and connections mean? Are usage and requirement coverage real?
34. **Settings/Admin:** Does every offered action persist? Are unavailable controls honest and role restrictions enforced by the server?
35. **AI:** What is an agent actually doing? Is a contribution record clearly distinguished from a running, verified agent?

## Comfort and accessibility

36. Is the primary work visible before summaries, empty sections, and configuration?
37. Can I read labels and identify actions without interpreting colors or hover alone?
38. Can I use touch, keyboard, and focus navigation without getting trapped or losing my place?
39. Why is there a scrollbar? Is content genuinely too large, or did we create a redundant/nested scroll region?
40. Can I reach all content without clipping, horizontal page overflow, or hiding essential controls?
41. Does an open dialog still fit after rotation, zoom, or opening the mobile keyboard?
42. Are loading, empty, error, offline, success and disabled states distinguishable?
43. Do reduced-motion and high-contrast preferences preserve a usable interface?

## Online release

44. Does this exact static build load through Cloudflare Pages, including deep links and hashed assets?
45. Is it calling the intended API rather than localhost or a different environment?
46. Do create/edit/connect/delete and all views work against D1, not only the development database?
47. Can one account read or change another account's private graph?
48. Are dates, tags, metadata, relationships and supported settings retained through the hosted API?
49. Do refresh/reconnect and expired credentials recover clearly?
50. Are secrets absent from browser assets and are cache/security headers correct?
51. Can we identify the released source, apply migrations, roll back the frontend, and see failures and usage?
52. Are unsupported advanced managed capabilities clearly separate from the free Core?

53. When I stop dragging or editing, do nodes and labels stop shaking? Does refresh or rotation unexpectedly move work I placed? Does the camera keep work centered when the window grows as well as shrinks, including gradual changes?

## Required gate procedure

- Run `TEST_URL=http://localhost:3127 npm run qc:new-user` against Core with the local app/API available. Browser checks are headed and serial by default. On Linux use a running DISPLAY, or `xvfb-run --auto-servernum` in CI; install Chromium with `npx playwright install chromium` first. The CI smoke job and PR template both require this gate.
- Run the same all-mode fixture against the Cloud-configured frontend and local D1 API with `QC_BACKEND=cloud QC_API_URL=http://localhost:8797/api/graphql TEST_URL=http://localhost:3129 npm run qc:modes`.
- Inspect screenshots as well as assertions. The all-mode test checks the same saved work through actual view navigation; it does not replace mutation, authorization, error-recovery or accessibility tests.
- Before deployment, validate the staged production Pages artifact, record the cloud integration results and finish the release ledger. No skipped test or unavailable provider counts as a pass.
- Cover 320/360/390px phones, short landscape, tablets, laptop and desktop. Native mobile keyboards, screen readers and remote account/email flows require explicit evidence and cannot be inferred from desktop browser emulation.

Use `SCENARIOS.md` for the diverse user/team catalog and `SCENARIO_RESULT_TEMPLATE.md` for consistent results.

See `RELEASE_QC.md` for the current sweep and remaining blockers.

### Working with my agent

54. Can I understand from the title page how my agent and I work together?
55. Can I connect an agent from my graph without giving it my login?
56. Can I tell exactly which project and actions its token permits?
57. Can my agent review priorities and leave a question where I can see it?
58. Can I distinguish my note from an authenticated agent's update?
59. Can I revoke access, and does a subsequent agent request actually fail?
60. Does read-only access prevent every supported write operation?
61. Does the UI describe unavailable capabilities honestly (model execution, task creation, MCP/provider connections)?
62. Can I copy the connection details once, hide them, and recover by replacing the credential if I lose it?
