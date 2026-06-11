import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  QualityGovernor,
  detectSignals,
  profileForTier,
  type QualityProfile,
  type QualityTier
} from '../lib/adaptiveQuality';

const OVERRIDE_KEY = 'graphdone.quality.override';

function readOverride(): QualityTier | null {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'ULTRA' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Live adaptive quality for the graph experience (ADAPT-1..6, ADAPT-9).
 *
 * - Detects device + network signals on mount, re-detects on connection change.
 * - Measures real fps via requestAnimationFrame and lets the governor step
 *   tiers with hysteresis.
 * - Honors a persisted manual override from Settings ("Auto" clears it).
 */
export function useAdaptiveQuality(): {
  tier: QualityTier;
  profile: QualityProfile;
  override: QualityTier | null;
  setOverride: (tier: QualityTier | null) => void;
} {
  const governor = useMemo(() => {
    const g = new QualityGovernor(detectSignals());
    g.setOverride(readOverride());
    return g;
  }, []);

  const [tier, setTier] = useState<QualityTier>(governor.tier);
  const [override, setOverrideState] = useState<QualityTier | null>(readOverride());

  useEffect(() => governor.onChange((t) => setTier(t)), [governor]);

  // Re-derive tier when network conditions change (ADAPT-5).
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (!connection?.addEventListener) return;
    const onConnectionChange = () => governor.updateSignals(detectSignals());
    connection.addEventListener('change', onConnectionChange);
    return () => connection.removeEventListener('change', onConnectionChange);
  }, [governor]);

  // FPS sampling: count frames per second, feed smoothed samples to the governor.
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - windowStart >= 1000) {
        governor.reportFps((frames * 1000) / (now - windowStart), now);
        frames = 0;
        windowStart = now;
        setTier(governor.tier);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [governor]);

  const setOverride = useCallback(
    (t: QualityTier | null) => {
      try {
        if (t) localStorage.setItem(OVERRIDE_KEY, t);
        else localStorage.removeItem(OVERRIDE_KEY);
      } catch {
        // localStorage unavailable (private mode) — override is session-only
      }
      governor.setOverride(t);
      setOverrideState(t);
      setTier(governor.tier);
    },
    [governor]
  );

  const profile = useMemo(() => profileForTier(tier, detectSignals()), [tier]);

  return { tier, profile, override, setOverride };
}
