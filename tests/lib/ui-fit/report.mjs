#!/usr/bin/env node
// Build a review gallery from a UI fit run:
//   node tests/lib/ui-fit/report.mjs [test-artifacts/ui-fit]
// Writes index.html (every screen × device, annotated screenshots, findings)
// and summary.md (for the CI job summary) into the same folder.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RULES, REPORT_ONLY } from './rules.mjs';
import { UI_FIT_DEVICES } from './devices.mjs';

const dir = process.argv[2] || 'test-artifacts/ui-fit';
if (!existsSync(dir)) {
  console.error(`No UI fit results in ${dir}`);
  process.exit(1);
}

const devices = UI_FIT_DEVICES.filter(device => existsSync(join(dir, device.id)));
const results = new Map(); // screen -> device id -> record
for (const device of devices) {
  for (const file of readdirSync(join(dir, device.id)).filter(name => name.endsWith('.json'))) {
    const record = JSON.parse(readFileSync(join(dir, device.id, file), 'utf8'));
    if (!results.has(record.screen)) results.set(record.screen, new Map());
    results.get(record.screen).set(device.id, record);
  }
}
const screens = [...results.keys()];
const escape = text => String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const describe = f => `${f.rule}: ${f.key} — ${f.message}${f.count > 1 ? ` (×${f.count})` : ''}`;

let failing = 0;
let measured = 0;
const rows = screens.map(screen => {
  const cells = devices.map(device => {
    const record = results.get(screen).get(device.id);
    if (!record) return '<td class="missing">not run</td>';
    failing += record.failing.length;
    measured += record.controls.length;
    const comfort = record.findings.filter(f => REPORT_ONLY.has(f.rule)).reduce((n, f) => n + f.count, 0);
    const status = record.failing.length ? `<b class="bad">${record.failing.length} problem${record.failing.length === 1 ? '' : 's'}</b>` : '<b class="ok">fits</b>';
    const list = record.failing.map(f => `<li>${escape(describe(f))}</li>`).join('');
    const img = `${device.id}/${screen}.png`;
    return `<td><a href="${img}"><img loading="lazy" src="${img}" alt="${escape(`${screen} on ${device.label}`)}"></a>
      <div class="meta">${status} · ${record.controls.length} controls${device.touch ? ` · ${comfort} under 44px` : ''}</div>${list ? `<ul>${list}</ul>` : ''}</td>`;
  }).join('');
  return `<tr><th scope="row">${escape(screen)}</th>${cells}</tr>`;
}).join('\n');

const rules = Object.entries(RULES).map(([id, text]) => `<li><code>${id}</code> ${escape(text)}</li>`).join('');
writeFileSync(join(dir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>UI fit</title>
<style>
:root{color-scheme:dark;--bg:#0f1419;--fg:#e6e8eb;--muted:#9aa4af;--line:#2a323c;--ok:#34c759;--bad:#ff453a}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
table{border-collapse:collapse}th,td{border:1px solid var(--line);padding:8px;vertical-align:top}
thead th{position:sticky;top:0;background:var(--bg)}th[scope=row]{text-align:left;white-space:nowrap}
td{width:260px}img{display:block;max-width:240px;max-height:420px;border:1px solid var(--line)}
.meta{color:var(--muted);margin-top:6px}.ok{color:var(--ok)}.bad{color:var(--bad)}ul{margin:4px 0 0;padding-left:18px}
.wrap{overflow-x:auto}
</style></head><body>
<h1>UI fit: ${screens.length} screens × ${devices.length} devices</h1>
<p>${measured} control measurements, <b class="${failing ? 'bad' : 'ok'}">${failing} problem${failing === 1 ? '' : 's'}</b>.
Green outlines: controls that fit. Red: controls with a problem.</p>
<details><summary>Rules</summary><ul>${rules}<li><code>touch-comfort</code> Touch targets under 44 px are counted on touch devices (reported, not gated).</li></ul></details>
<div class="wrap"><table><thead><tr><th>Screen</th>${devices.map(d => `<th>${escape(d.label)}</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody></table></div></body></html>
`);

const lines = [`### UI fit: ${screens.length} screens × ${devices.length} devices — ${failing ? `❌ ${failing} problem(s)` : '✅ everything fits'}`, ''];
for (const screen of screens) {
  for (const device of devices) {
    const record = results.get(screen).get(device.id);
    for (const f of record?.failing ?? []) lines.push(`- **${screen}** on ${device.label}: ${describe(f)}`);
  }
}
lines.push('', `${measured} control measurements. Gallery: the \`ui-fit\` artifact, open \`index.html\`.`);
writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
console.log(`UI fit gallery: ${join(dir, 'index.html')} (${failing} problem(s))`);
