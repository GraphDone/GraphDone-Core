/**
 * Pure narration-script builder: turns real report/git/metric data into ordered
 * spoken segments (each with the on-screen media to show while it plays). No I/O,
 * no piper — the driver (scripts/narrate-report.mjs) renders these to audio.
 * Segment.media tells the dashboard what to display: a trend chart, a video, an
 * image, or nothing.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function spokenDate(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return 'today';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function spokenUrl(url) {
  if (!url) return 'the application';
  return String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
}

const UNIT_WORD = { fps: 'frames per second', ms: 'milliseconds', s: 'seconds', px: 'pixels', '%': 'percent', count: '', kb: 'kilobytes', score: 'out of one' };

// Strip a conventional-commit prefix + PR number tail → a spoken-readable clause.
export function cleanTitle(t) {
  return String(t || '')
    .replace(/^[a-z]+(\([^)]*\))?:\s*/i, '')
    .replace(/\s*\(#\d+\)\s*$/, '')
    .replace(/`/g, '')
    .trim();
}

function spokenMetric(m) {
  const unit = UNIT_WORD[m.unit] ?? m.unit ?? '';
  const v = Math.round(m.value * 10) / 10;
  return `${m.label} ${v}${unit ? ' ' + unit : ''}`.trim();
}

/**
 * input: {
 *   dateISO, voiceName,
 *   health: { cases, sequences, passed, failed, warned, passRate, target },
 *   shipped: [{ title }],
 *   perf: [{ label, value, unit, better }],
 *   tour: [{ name, note, kind, runId, href }],   // kind: 'video'|'image'
 * }
 * returns { generatedAt: null, voice, segments: [{ id, title, text, media }], meta }
 */
export function buildNarration(input = {}) {
  const { dateISO = '', voiceName = '', health = {}, shipped = [], perf = [], tour = [] } = input;
  const segments = [];
  const push = (id, title, text, media = { kind: 'none' }) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t) segments.push({ id, title, text: t, media });
  };

  push('intro', 'Introduction',
    `GraphDone progress report for ${spokenDate(dateISO)}. This is an automated, narrated walkthrough of the system's current health, the work we've shipped recently, and a tour of what a user can do.`,
    { kind: 'chart', ref: 'suite.passRate' });

  if (health.cases) {
    const warnPart = health.warned ? `, alongside ${plural(health.warned, 'warning')} that are accepted by design` : '';
    push('health', 'Test health',
      `The unified test suite is reporting ${plural(health.cases, 'check')} across ${plural(health.sequences, 'area')}. ${health.passRate} percent are passing, with ${plural(health.failed, 'failure')}${warnPart}. The target under test is ${spokenUrl(health.target)}. Test health is tracked over time, so every run either confirms progress or surfaces a regression immediately.`,
      { kind: 'chart', ref: 'suite.passRate' });
  }

  const ships = shipped.map((s) => cleanTitle(s.title)).filter(Boolean).slice(0, 7);
  if (ships.length) {
    push('shipped', 'Recently shipped',
      `Here is what we've shipped recently. ${ships.map((t) => t.replace(/\.$/, '')).join('. ')}. Each of these landed only after passing the smoke gate that proves the application works from a real user's point of view.`,
      { kind: 'chart', ref: 'suite.cases' });
  }

  const perfReal = perf.filter((p) => p && isFinite(p.value));
  if (perfReal.length) {
    push('performance', 'Performance',
      `On performance: ${perfReal.slice(0, 5).map(spokenMetric).join(', ')}. These numbers are charted across runs, so we can see at a glance whether the system is getting faster or slower as it grows.`,
      { kind: 'chart', ref: perfReal.find((p) => p.unit === 'fps')?.metric || perfReal[0].metric });
  }

  const clips = tour.slice(0, 8);
  if (clips.length) {
    push('tour-intro', 'Feature tour',
      `Now, a short tour of the live experience. Each clip you'll see was recorded against the running site.`,
      clips[0] ? { kind: clips[0].kind, runId: clips[0].runId, href: clips[0].href } : { kind: 'none' });
    for (const c of clips) {
      const name = cleanTitle(c.name).replace(/-/g, ' ');
      const note = String(c.note || '').split('·')[0].trim();
      push(`tour-${c.name}`, name,
        `${name}. ${note}`,
        { kind: c.kind || 'video', runId: c.runId, href: c.href });
    }
  }

  push('outro', 'Summary',
    `That's the current state of GraphDone. This report is generated on demand and narrated by Piper text to speech. The dashboard updates itself live as new test runs land, so this narration always reflects the latest verified progress.`,
    { kind: 'chart', ref: 'suite.passRate' });

  return {
    generatedAt: null,
    voice: voiceName,
    segments,
    meta: { shippedCount: ships.length, perfCount: perfReal.length, tourCount: clips.length, tourTruncated: tour.length > clips.length },
  };
}
