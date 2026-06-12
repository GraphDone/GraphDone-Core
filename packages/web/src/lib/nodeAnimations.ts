/**
 * Living-graph helpers (Epic 1 in docs/USER_STORIES.md).
 *
 * Pure functions only — the D3 layer applies these as classes/styles, CSS in
 * index.css animates them, and [data-quality] / prefers-reduced-motion
 * selectors gate them (ADAPT-3, ADAPT-9). Keeping the logic here makes the
 * living-graph behavior unit-testable without a DOM.
 */

const ACTIVE_STATUSES = new Set(['IN_PROGRESS', 'IN PROGRESS', 'ACTIVE']);
const BLOCKED_STATUSES = new Set(['BLOCKED']);
const COMPLETED_STATUSES = new Set(['COMPLETED', 'DONE']);

const normalize = (status?: string): string => (status ?? '').toUpperCase().replace(/_/g, ' ').trim();

export function isActiveStatus(status?: string): boolean {
  return ACTIVE_STATUSES.has(normalize(status).replace(/ /g, '_')) || ACTIVE_STATUSES.has(normalize(status));
}

export function isBlockedStatus(status?: string): boolean {
  return BLOCKED_STATUSES.has(normalize(status));
}

export function isCompletedStatus(status?: string): boolean {
  return COMPLETED_STATUSES.has(normalize(status));
}

/**
 * Life-state classes for a node card. CSS owns the actual motion:
 *  - node-breathing: gentle glow pulse for in-progress work (LIVE-1)
 *  - node-stuck: desaturated slow dim pulse + dashed ring for blocked (LIVE-4)
 *  - node-settled: calm, dimmed presentation for completed work
 */
export function nodeLifeClasses(status?: string): string {
  if (isActiveStatus(status)) return 'node-breathing';
  if (isBlockedStatus(status)) return 'node-stuck';
  if (isCompletedStatus(status)) return 'node-settled';
  return '';
}

/**
 * Energy flows along an edge when exactly one endpoint is completed (LIVE-2):
 * forward (source→target) when the source is done, reverse when the target
 * is. CSS animates stroke-dashoffset; LOW tier and reduced motion strip it.
 */
export function edgeFlowClass(sourceStatus?: string, targetStatus?: string): string {
  const sourceDone = isCompletedStatus(sourceStatus);
  const targetDone = isCompletedStatus(targetStatus);
  if (sourceDone === targetDone) return '';
  return sourceDone ? 'edge-flowing-forward' : 'edge-flowing-reverse';
}

/** Priority (0..1) → glow step 0..3. Four visually distinct levels (LIVE-5). */
export function priorityGlowStep(priority?: number): 0 | 1 | 2 | 3 {
  const p = typeof priority === 'number' && Number.isFinite(priority) ? priority : 0;
  if (p >= 0.8) return 3;
  if (p >= 0.5) return 2;
  if (p >= 0.2) return 1;
  return 0;
}

const GLOW_RADIUS_PX: Record<1 | 2 | 3, number> = { 1: 4, 2: 8, 3: 14 };
const GLOW_ALPHA: Record<1 | 2 | 3, number> = { 1: 0.35, 2: 0.55, 3: 0.8 };

/**
 * The CSS filter value for a node card: always the base drop shadow, plus a
 * priority-scaled colored halo when the quality profile allows glow.
 */
export function nodeGlowFilter(priority: number | undefined, typeHexColor: string, glowEnabled: boolean): string {
  const base = 'url(#node-drop-shadow)';
  const step = priorityGlowStep(priority);
  if (!glowEnabled || step === 0) return base;
  const alphaHex = Math.round(GLOW_ALPHA[step] * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base} drop-shadow(0 0 ${GLOW_RADIUS_PX[step]}px ${typeHexColor}${alphaHex})`;
}
