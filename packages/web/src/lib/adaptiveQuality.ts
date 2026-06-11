/**
 * Adaptive quality engine — GraphDone runs beautifully on a workstation and
 * gracefully on a phone on cellular. Quality scales with available compute and
 * bandwidth, automatically.
 *
 * Stories: ADAPT-1..9 in docs/USER_STORIES.md. The reference hardware/network
 * profiles at the bottom of that doc are encoded in the unit tests for this
 * file — change them together.
 *
 * Design: pure, deterministic functions (computeTier, profileForTier) plus a
 * small stateful FPS governor. No Date.now() inside — callers inject
 * timestamps, which keeps every behavior unit-testable.
 */

export type QualityTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

/** Lowest → highest. Index in this array is used for tier arithmetic. */
export const TIER_ORDER: readonly QualityTier[] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];

export interface DeviceSignals {
  /** navigator.connection.effectiveType */
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  /** navigator.connection.type — 'cellular' triggers data-respect caps */
  connectionType?: string;
  /** navigator.connection.saveData */
  saveData?: boolean;
  /** navigator.deviceMemory in GB (spec caps reporting at 8) */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  /** matchMedia('(prefers-reduced-motion: reduce)') */
  reducedMotion?: boolean;
}

export interface QualityProfile {
  tier: QualityTier;
  /** Static glow filters on nodes (allowed under reduced motion — it doesn't move). */
  glowEffects: boolean;
  /** Breathing pulses, energy flow on edges (LIVE-1, LIVE-2). */
  animations: boolean;
  /** Staggered node entrance on graph open (LIVE-8). */
  entranceAnimation: boolean;
  /** Completion particle bursts (LIVE-3). */
  particleCelebrations: boolean;
  /** Progressive-loading budget for the first graph paint (ADAPT-4). */
  maxInitialNodes: number;
  /** Requested px for attachment previews; 0 = don't autoload (ADAPT-2). */
  attachmentPreviewSize: number;
  /** Zoom level above which node labels render (ADAPT-7). */
  labelLodZoom: number;
  targetFps: number;
}

const tierIndex = (t: QualityTier): number => TIER_ORDER.indexOf(t);
const minTier = (a: QualityTier, b: QualityTier): QualityTier =>
  TIER_ORDER[Math.min(tierIndex(a), tierIndex(b))];

/** Read signals from the browser. Both params injectable for tests. */
export function detectSignals(
  nav: Navigator = typeof navigator !== 'undefined' ? navigator : ({} as Navigator),
  matchMediaFn: typeof window.matchMedia | undefined = typeof window !== 'undefined'
    ? window.matchMedia?.bind(window)
    : undefined
): DeviceSignals {
  const connection = (nav as Navigator & { connection?: Record<string, unknown> }).connection;
  return {
    effectiveType: connection?.effectiveType as DeviceSignals['effectiveType'],
    connectionType: connection?.type as string | undefined,
    saveData: connection?.saveData as boolean | undefined,
    deviceMemory: (nav as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    reducedMotion: matchMediaFn ? matchMediaFn('(prefers-reduced-motion: reduce)').matches : false
  };
}

/**
 * Deterministic tier from device + network signals (ADAPT-1).
 * Compute decides the ceiling; the network can only cap it down.
 */
export function computeTier(signals: DeviceSignals): QualityTier {
  const cores = signals.hardwareConcurrency ?? 4;
  // deviceMemory is absent on Firefox/Safari; many-core machines without the
  // API are almost certainly desktops, so assume enough memory and let the
  // FPS governor correct us if we guessed high.
  const mem = signals.deviceMemory ?? (cores >= 8 ? 8 : 4);

  let compute: QualityTier;
  if (cores >= 8 && mem >= 8) compute = 'ULTRA';
  else if (cores >= 4 && mem >= 8) compute = 'HIGH';
  else if (cores >= 4 && mem >= 4) compute = 'MEDIUM';
  else compute = 'LOW';

  let cap: QualityTier = 'ULTRA';
  if (signals.effectiveType === '2g' || signals.effectiveType === 'slow-2g') cap = 'LOW';
  else if (signals.effectiveType === '3g') cap = 'MEDIUM';
  // Respect the user's data plan and explicit wish (ADAPT-2).
  if (signals.saveData || signals.connectionType === 'cellular') cap = minTier(cap, 'MEDIUM');

  return minTier(compute, cap);
}

const BASE_PROFILES: Record<QualityTier, Omit<QualityProfile, 'tier'>> = {
  ULTRA: {
    glowEffects: true,
    animations: true,
    entranceAnimation: true,
    particleCelebrations: true,
    maxInitialNodes: 500,
    attachmentPreviewSize: 1024,
    labelLodZoom: 0.3,
    targetFps: 60
  },
  HIGH: {
    glowEffects: true,
    animations: true,
    entranceAnimation: true,
    particleCelebrations: true,
    maxInitialNodes: 300,
    attachmentPreviewSize: 512,
    labelLodZoom: 0.4,
    targetFps: 60
  },
  MEDIUM: {
    glowEffects: true,
    animations: true,
    entranceAnimation: false,
    particleCelebrations: false,
    maxInitialNodes: 150,
    attachmentPreviewSize: 256,
    labelLodZoom: 0.6,
    targetFps: 30
  },
  LOW: {
    glowEffects: false,
    animations: false,
    entranceAnimation: false,
    particleCelebrations: false,
    maxInitialNodes: 75,
    attachmentPreviewSize: 0,
    labelLodZoom: 0.8,
    targetFps: 30
  }
};

/** Effects map per tier (ADAPT-3), with accessibility and data-respect overrides. */
export function profileForTier(tier: QualityTier, signals: DeviceSignals): QualityProfile {
  const profile: QualityProfile = { tier, ...BASE_PROFILES[tier] };

  // Accessibility beats aesthetics (ADAPT-9). Static glow may stay.
  if (signals.reducedMotion) {
    profile.animations = false;
    profile.entranceAnimation = false;
    profile.particleCelebrations = false;
  }

  // Data respect (ADAPT-2): cellular or Save-Data shrinks previews everywhere.
  if (signals.saveData || signals.connectionType === 'cellular') {
    profile.attachmentPreviewSize = Math.min(profile.attachmentPreviewSize, 256);
  }

  return profile;
}

type TierListener = (tier: QualityTier, profile: QualityProfile) => void;

/**
 * FPS-driven tier governor with hysteresis (ADAPT-3, ADAPT-5, ADAPT-6).
 *
 * - sustained < 30fps for 3s → step down one tier
 * - sustained < 15fps for 1s → drop straight to LOW
 * - sustained ≥ 50fps for 10s → step up one tier, never above the signal
 *   ceiling, at most once per 10s
 * - manual override pins the tier until cleared
 *
 * Timestamps are injected (ms, monotonic) so behavior is fully testable.
 */
export class QualityGovernor {
  private signals: DeviceSignals;
  private ceiling: QualityTier;
  private current: QualityTier;
  private override: QualityTier | null = null;
  private listeners: TierListener[] = [];

  private badSince: number | null = null;
  private severeSince: number | null = null;
  private goodSince: number | null = null;
  private lastShift: number | null = null;

  private static readonly STEP_DOWN_MS = 3000;
  private static readonly SEVERE_MS = 1000;
  private static readonly STEP_UP_MS = 10000;

  constructor(signals: DeviceSignals) {
    this.signals = signals;
    this.ceiling = computeTier(signals);
    this.current = this.ceiling;
  }

  get tier(): QualityTier {
    return this.override ?? this.current;
  }

  get profile(): QualityProfile {
    return profileForTier(this.tier, this.signals);
  }

  onChange(listener: TierListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Pin a tier (Settings → quality). Pass null to return to auto (ADAPT-6). */
  setOverride(tier: QualityTier | null): void {
    const before = this.tier;
    this.override = tier;
    if (this.tier !== before) this.emit();
  }

  /** Conditions changed (network/connection event) — re-derive immediately (ADAPT-5). */
  updateSignals(signals: DeviceSignals): void {
    const before = this.tier;
    this.signals = signals;
    this.ceiling = computeTier(signals);
    this.current = this.ceiling;
    this.badSince = this.severeSince = this.goodSince = null;
    if (this.tier !== before) this.emit();
  }

  /** Feed a smoothed fps sample with its timestamp (ms). */
  reportFps(fps: number, now: number): void {
    if (this.override) return;

    if (fps < 15) {
      this.severeSince ??= now;
      if (now - this.severeSince >= QualityGovernor.SEVERE_MS && this.current !== 'LOW') {
        this.shiftTo('LOW', now);
        return;
      }
    } else {
      this.severeSince = null;
    }

    if (fps < 30) {
      this.goodSince = null;
      this.badSince ??= now;
      if (now - this.badSince >= QualityGovernor.STEP_DOWN_MS) {
        const down = TIER_ORDER[Math.max(0, tierIndex(this.current) - 1)];
        if (down !== this.current) this.shiftTo(down, now);
        this.badSince = null;
      }
      return;
    }

    this.badSince = null;

    if (fps >= 50 && tierIndex(this.current) < tierIndex(this.ceiling)) {
      this.goodSince ??= now;
      const settled = now - this.goodSince >= QualityGovernor.STEP_UP_MS;
      const spaced = this.lastShift === null || now - this.lastShift >= QualityGovernor.STEP_UP_MS;
      if (settled && spaced) {
        this.shiftTo(TIER_ORDER[tierIndex(this.current) + 1], now);
        this.goodSince = null;
      }
    } else if (fps < 50) {
      this.goodSince = null;
    }
  }

  private shiftTo(tier: QualityTier, now: number): void {
    this.current = tier;
    this.lastShift = now;
    this.badSince = this.severeSince = this.goodSince = null;
    this.emit();
  }

  private emit(): void {
    const profile = this.profile;
    for (const l of this.listeners) l(this.tier, profile);
  }
}
