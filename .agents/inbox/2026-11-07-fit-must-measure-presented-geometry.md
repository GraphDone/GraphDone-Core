# Camera fit must measure the geometry it will present; focus follows detail

Observed 2026-11-07 while clearing the hosted gate's release blockers for the
first alpha release. The hosted gate builds Core `dev` (fb83fec4) with its
offline/hosted settings and drives it headed at phone, landscape and desktop
viewports. Existing LOD hysteresis/focus and responsive-acceptance lessons were
searched first; this concerns camera fitting across the compact-card threshold.

## Evidence

- Reproduced locally against an owned offline fixture with the gate's own cases:
  focus not returned to the quick-edit gear at 320x568/390x844/430x932, expand
  focus not returned at 844x390, the quick editor never opening at 667x375 and
  the gear "not stable" then "not visible" at 844x390.
- Attribute tracing at 390x844 after Zoom to fit showed the framing retries
  alternating every 250ms: scale 0.893 with `data-detail=compact`, then 1.083
  with `data-detail=full`, repeated for seconds. Each compact pass set
  `display:none` on the focused header icon and Chrome moved focus to `<body>`.
- Cause: `fitViewToNodes` measured cards with `getNodeDimensions`, i.e. the
  geometry of the *current* zoom. Full cards need a scale below 1, which makes
  them compact (smaller), so the next fit zooms back above 1, and so on. Its
  60px padding also forced a 320px-max card below 100% on a 390px phone.
- The new `fit-focus.spec.ts` fails on the old source with
  `0.992 full, 0.886 compact, 1.083 full, 0.886 compact, ...` and a focus loss;
  it passes on the corrected source (headed and headless, CI-like fonts).
- Agent approval at 320x568 measured 603px with DejaVu Sans (the CI runner's
  default) after `text-xs` became 14px; it fit with narrower local fonts. The
  Agents page Access/About selects were 642px wide at 844px.

## Corrective rules

- Fit with the geometry the cards will have at the fitted scale
  (`lib/graphFit.ts`): keep full cards at 100% when they fit with a 12px margin;
  otherwise fit compact geometry and stay below the threshold. The result must
  not depend on the current zoom, so framing retries and resizes settle.
- When detail changes hide the keyboard-focused (`:focus-visible`) control,
  move focus to the control that replaces it (header icon <-> compact card) and
  return to the same icon afterwards; never hand a mouse user a focus ring.
  Dialog close returns focus to the visible equivalent of the invoking control.
- Geometry probes for "what if" scales must reuse the presented layout when the
  layout key matches and keep any extra cache bounded: a live resize refits
  every frame.
- A state change that replaces the focused buttons (approve/reject) shows its
  result above requester-supplied text and moves focus there; shrinking copy to
  fit one fixture does not survive a longer user-written field.
- Check text-heavy phone layouts with the CI runner's wider default font, not
  only the workstation's (`FONTCONFIG_FILE` pointing at DejaVu Sans reproduces).
- Prefer role-based or exact locators: `getByLabel('Shared notes')` also matched
  the "Refresh shared notes" button.

## Limits

A single card wider than ~296px still cannot be shown at 100% on a 320px phone;
by design it is a compact card whose keyboard control is the card itself.
Hosted-gate parity is established only by the hosted gate's own run.
