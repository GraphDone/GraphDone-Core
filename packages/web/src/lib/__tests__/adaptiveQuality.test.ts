import { describe, it, expect, vi } from 'vitest';
import {
  computeTier,
  profileForTier,
  detectSignals,
  QualityGovernor,
  TIER_ORDER,
  type DeviceSignals,
  type QualityTier
} from '../adaptiveQuality';

// Reference profiles from docs/USER_STORIES.md — change both together.
const REFERENCE_PROFILES: Array<{ name: string; signals: DeviceSignals; expected: QualityTier }> = [
  {
    name: 'workstation',
    signals: { hardwareConcurrency: 8, deviceMemory: 8, effectiveType: '4g' },
    expected: 'ULTRA'
  },
  {
    name: 'laptop',
    signals: { hardwareConcurrency: 4, deviceMemory: 8, effectiveType: '4g' },
    expected: 'HIGH'
  },
  {
    name: 'tablet',
    signals: { hardwareConcurrency: 4, deviceMemory: 4, effectiveType: '4g' },
    expected: 'MEDIUM'
  },
  {
    name: 'phone-good',
    signals: { hardwareConcurrency: 4, deviceMemory: 4, effectiveType: '4g', connectionType: 'cellular' },
    expected: 'MEDIUM'
  },
  {
    name: 'phone-constrained',
    signals: { hardwareConcurrency: 2, deviceMemory: 2, effectiveType: '3g', connectionType: 'cellular' },
    expected: 'LOW'
  }
];

describe('computeTier (ADAPT-1)', () => {
  it.each(REFERENCE_PROFILES)('maps reference profile $name → $expected', ({ signals, expected }) => {
    expect(computeTier(signals)).toBe(expected);
  });

  it('caps tier at LOW on 2g and slow-2g networks', () => {
    const beefy = { hardwareConcurrency: 16, deviceMemory: 8 };
    expect(computeTier({ ...beefy, effectiveType: '2g' })).toBe('LOW');
    expect(computeTier({ ...beefy, effectiveType: 'slow-2g' })).toBe('LOW');
  });

  it('caps tier at MEDIUM on 3g even with strong hardware', () => {
    expect(computeTier({ hardwareConcurrency: 16, deviceMemory: 8, effectiveType: '3g' })).toBe('MEDIUM');
  });

  it('caps tier at MEDIUM when Save-Data is on (ADAPT-2)', () => {
    expect(computeTier({ hardwareConcurrency: 8, deviceMemory: 8, effectiveType: '4g', saveData: true })).toBe('MEDIUM');
  });

  it('caps tier at MEDIUM on cellular connections (ADAPT-2)', () => {
    expect(
      computeTier({ hardwareConcurrency: 8, deviceMemory: 8, effectiveType: '4g', connectionType: 'cellular' })
    ).toBe('MEDIUM');
  });

  it('treats missing network info as uncapped (desktop browsers without the API)', () => {
    expect(computeTier({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe('ULTRA');
  });

  it('is conservative when hardware signals are missing entirely', () => {
    const tier = computeTier({});
    expect(['MEDIUM', 'HIGH']).toContain(tier);
    expect(tier).not.toBe('ULTRA');
  });
});

describe('profileForTier (ADAPT-3, ADAPT-2, ADAPT-9)', () => {
  it('disables glow, animations and celebrations at LOW', () => {
    const p = profileForTier('LOW', {});
    expect(p.glowEffects).toBe(false);
    expect(p.animations).toBe(false);
    expect(p.particleCelebrations).toBe(false);
    expect(p.entranceAnimation).toBe(false);
  });

  it('does not autoload attachment previews at LOW (preview size 0)', () => {
    expect(profileForTier('LOW', {}).attachmentPreviewSize).toBe(0);
  });

  it('enables the full living-graph experience at ULTRA', () => {
    const p = profileForTier('ULTRA', {});
    expect(p.glowEffects).toBe(true);
    expect(p.animations).toBe(true);
    expect(p.particleCelebrations).toBe(true);
    expect(p.entranceAnimation).toBe(true);
  });

  it('degrades effects before interactivity: every tier keeps interaction on', () => {
    for (const tier of TIER_ORDER) {
      expect(profileForTier(tier, {}).maxInitialNodes).toBeGreaterThan(0);
    }
  });

  it('shrinks initial node budget monotonically as tier drops (ADAPT-4 groundwork)', () => {
    const budgets = TIER_ORDER.map((t) => profileForTier(t, {}).maxInitialNodes);
    for (let i = 1; i < budgets.length; i++) {
      expect(budgets[i]).toBeGreaterThan(budgets[i - 1]);
    }
  });

  it('clamps attachment previews to ≤256px under Save-Data at any tier (ADAPT-2)', () => {
    for (const tier of TIER_ORDER) {
      expect(profileForTier(tier, { saveData: true }).attachmentPreviewSize).toBeLessThanOrEqual(256);
    }
  });

  it('clamps attachment previews to ≤256px on cellular (ADAPT-2)', () => {
    expect(profileForTier('ULTRA', { connectionType: 'cellular' }).attachmentPreviewSize).toBeLessThanOrEqual(256);
  });

  it('forces all animation off under prefers-reduced-motion, even at ULTRA (ADAPT-9)', () => {
    const p = profileForTier('ULTRA', { reducedMotion: true });
    expect(p.animations).toBe(false);
    expect(p.entranceAnimation).toBe(false);
    expect(p.particleCelebrations).toBe(false);
    // Static glow is allowed — it does not move.
    expect(p.glowEffects).toBe(true);
  });
});

describe('detectSignals', () => {
  it('reads connection, memory, cores and reduced-motion from a navigator-like object', () => {
    const fakeNav = {
      hardwareConcurrency: 4,
      deviceMemory: 4,
      connection: { effectiveType: '3g', saveData: true, type: 'cellular' }
    } as unknown as Navigator;
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    const s = detectSignals(fakeNav, matchMedia as unknown as typeof window.matchMedia);
    expect(s.hardwareConcurrency).toBe(4);
    expect(s.deviceMemory).toBe(4);
    expect(s.effectiveType).toBe('3g');
    expect(s.saveData).toBe(true);
    expect(s.connectionType).toBe('cellular');
    expect(s.reducedMotion).toBe(true);
  });

  it('survives a navigator with none of the optional APIs', () => {
    const s = detectSignals({} as Navigator, undefined);
    expect(s.effectiveType).toBeUndefined();
    expect(s.deviceMemory).toBeUndefined();
    expect(s.reducedMotion).toBe(false);
  });
});

describe('QualityGovernor (ADAPT-3, ADAPT-5, ADAPT-6)', () => {
  const signals: DeviceSignals = { hardwareConcurrency: 8, deviceMemory: 8, effectiveType: '4g' };

  it('starts at the tier computed from signals', () => {
    const g = new QualityGovernor(signals);
    expect(g.tier).toBe('ULTRA');
  });

  it('steps down one tier after sustained low fps (<30 for 3s)', () => {
    const g = new QualityGovernor(signals);
    let t = 0;
    for (; t <= 3100; t += 100) g.reportFps(25, t);
    expect(g.tier).toBe('HIGH');
  });

  it('drops straight to LOW on severe fps (<15 sustained 1s)', () => {
    const g = new QualityGovernor(signals);
    for (let t = 0; t <= 1100; t += 100) g.reportFps(10, t);
    expect(g.tier).toBe('LOW');
  });

  it('does not step down on a brief dip', () => {
    const g = new QualityGovernor(signals);
    g.reportFps(60, 0);
    g.reportFps(20, 100); // one bad frame sample
    g.reportFps(60, 200);
    for (let t = 300; t <= 4000; t += 100) g.reportFps(60, t);
    expect(g.tier).toBe('ULTRA');
  });

  it('steps back up after sustained good fps, with ≥10s hysteresis (ADAPT-5)', () => {
    const g = new QualityGovernor(signals);
    let t = 0;
    for (; t <= 3100; t += 100) g.reportFps(25, t); // down to HIGH
    expect(g.tier).toBe('HIGH');
    const downAt = t;
    for (; t <= downAt + 9000; t += 100) g.reportFps(60, t);
    expect(g.tier).toBe('HIGH'); // not yet — hysteresis
    for (; t <= downAt + 11000; t += 100) g.reportFps(60, t);
    expect(g.tier).toBe('ULTRA');
  });

  it('never steps up beyond the ceiling computed from signals', () => {
    const g = new QualityGovernor({ ...signals, effectiveType: '3g' }); // ceiling MEDIUM
    let t = 0;
    for (; t <= 60000; t += 100) g.reportFps(60, t);
    expect(g.tier).toBe('MEDIUM');
  });

  it('re-evaluates the ceiling when network conditions change (ADAPT-5)', () => {
    const g = new QualityGovernor(signals);
    g.updateSignals({ ...signals, effectiveType: '2g' });
    expect(g.tier).toBe('LOW');
    g.updateSignals(signals);
    // back up immediately on explicit condition change (not fps-driven)
    expect(g.tier).toBe('ULTRA');
  });

  it('honors a manual override and returns to auto when cleared (ADAPT-6)', () => {
    const g = new QualityGovernor(signals);
    g.setOverride('LOW');
    expect(g.tier).toBe('LOW');
    // fps reports must not move an overridden tier
    for (let t = 0; t <= 20000; t += 100) g.reportFps(60, t);
    expect(g.tier).toBe('LOW');
    g.setOverride(null);
    expect(g.tier).toBe('ULTRA');
  });

  it('notifies subscribers exactly once per tier change', () => {
    const g = new QualityGovernor(signals);
    const seen: QualityTier[] = [];
    g.onChange((tier) => seen.push(tier));
    for (let t = 0; t <= 3200; t += 100) g.reportFps(25, t);
    expect(seen).toEqual(['HIGH']);
  });
});
