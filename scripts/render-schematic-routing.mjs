import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  routeSchematicConnections,
  measureSchematicClutter,
} from '../packages/web/src/lib/schematicRouting.ts';
import {
  schematicFixtures,
  spaghettiFixture,
} from '../tests/visual/schematic-fixtures.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out')
  throw new Error(
    'Usage: node scripts/render-schematic-routing.mjs --out <owned-output-directory>'
  );
const out = resolve(args[1]);
mkdirSync(out, { recursive: true });
const escape = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const palette = [
  '#5eead4',
  '#a5b4fc',
  '#fbbf24',
  '#f9a8d4',
  '#7dd3fc',
  '#c4b5fd',
  '#bef264',
  '#fdba74',
];
const words = (label, max = 14) => {
  const lines = [''];
  for (const word of label.split(' ')) {
    if ((lines.at(-1) + word).length > max && lines.at(-1)) lines.push('');
    lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
  }
  return lines;
};
function svg(fixture, result) {
  const sources = [...new Set(fixture.cards.map(card => card.id))].sort();
  const color = id => palette[sources.indexOf(id) % palette.length];
  const edges = fixture.connections.reduce(
    (sum, connection) => sum + connection.edgeIds.length,
    0
  );
  const collapsed = result.deferred.reduce(
    (sum, route) => sum + route.edgeIds.length,
    0
  );
  const paths = result.routes
    .map(
      route =>
        `<path data-source="${escape(route.source)}" d="${route.points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')}" stroke="${color(route.source)}" marker-end="url(#arrow-${sources.indexOf(route.source)})"><title>${escape(route.source)} → ${escape(route.target)} · ${route.edgeIds.length} exact relationships</title></path>`
    )
    .join('');
  const junctions = result.junctions.map(
    p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color(p.bus)}"/>`
  );
  const cards = fixture.cards
    .map(card => {
      const outgoing = fixture.connections
        .filter(connection => connection.source === card.id)
        .reduce((sum, connection) => sum + connection.edgeIds.length, 0);
      const incoming = fixture.connections
        .filter(connection => connection.target === card.id)
        .reduce((sum, connection) => sum + connection.edgeIds.length, 0);
      return `<g data-card="${escape(card.id)}"><rect x="${card.x}" y="${card.y}" width="${card.width}" height="${card.height}" rx="9" fill="#111e31" stroke="#3c506c"/><rect x="${card.x}" y="${card.y + 12}" width="3" height="${card.height - 24}" rx="1.5" fill="${color(card.id)}"/><text x="${card.x + 13}" y="${card.y + 22}" fill="#e7f1ff" font-size="14" font-weight="600">${words(
        card.label ?? card.id
      )
        .map(
          (line, i) =>
            `<tspan x="${card.x + 13}" dy="${i ? 16 : 0}">${escape(line)}</tspan>`
        )
        .join(
          ''
        )}</text><text x="${card.x + 13}" y="${card.y + card.height - 10}" fill="#a5b4c8" font-size="11">${incoming} in · ${outgoing} out</text></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fixture.width}" height="${fixture.height}" viewBox="0 0 ${fixture.width} ${fixture.height}" role="img" aria-label="${escape(fixture.title)}"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#27364b"/></pattern>${sources.map((id, i) => `<marker id="arrow-${i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M1,1 L7,4 L1,7" fill="none" stroke="${color(id)}" stroke-width="1.5"/></marker>`).join('')}</defs><rect width="100%" height="100%" fill="#080f1d"/><rect width="100%" height="100%" fill="url(#dots)"/><g font-family="DejaVu Sans, sans-serif"><text x="24" y="30" fill="#9bb5cd" font-size="10" letter-spacing="2">GRAPHDONE / CONNECTION STUDY</text><text x="24" y="55" fill="#e7f1ff" font-size="${fixture.width < 600 ? 15 : 20}" font-weight="600">${escape(fixture.title)}</text><g fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${paths}</g>${junctions.join('')}${cards}<text x="24" y="${fixture.height - 38}" fill="#a5b4c8" font-size="12">${edges} relationships · ${result.routes.length} routed branches</text><text x="24" y="${fixture.height - 18}" fill="${collapsed ? '#fbbf24' : '#5eead4'}" font-size="12">${collapsed ? `${collapsed} relationships collapsed · inspect the complete list` : 'All relationships represented · no unrelated crossings'}</text></g></svg>`;
}

const reports = [];
for (const fixture of schematicFixtures) {
  const result = routeSchematicConnections(
    fixture.cards,
    fixture.connections,
    fixture.width,
    fixture.height
  );
  writeFileSync(join(out, `${fixture.name}.svg`), svg(fixture, result));
  reports.push({
    name: fixture.name,
    title: fixture.title,
    sourceRelationships: fixture.connections.reduce(
      (sum, connection) => sum + connection.edgeIds.length,
      0
    ),
    routedRelationships: result.routes.reduce(
      (sum, route) => sum + route.edgeIds.length,
      0
    ),
    collapsedRelationships: result.deferred.reduce(
      (sum, route) => sum + route.edgeIds.length,
      0
    ),
    routedBranches: result.routes.length,
    metrics: result.metrics,
    work: result.work,
    deferred: Object.fromEntries(
      [...new Set(result.deferred.map(route => route.reason))].map(reason => [
        reason,
        {
          branches: result.deferred.filter(route => route.reason === reason)
            .length,
          relationships: result.deferred
            .filter(route => route.reason === reason)
            .reduce((sum, route) => sum + route.edgeIds.length, 0),
        },
      ])
    ),
  });
}
const negativeMetrics = measureSchematicClutter(
  spaghettiFixture.cards,
  spaghettiFixture.segments
);
writeFileSync(
  join(out, 'metrics.json'),
  JSON.stringify(
    {
      schema: 'graphdone.schematic-study/1',
      fixtures: reports,
      rejectedNegative: negativeMetrics,
    },
    null,
    2
  )
);
writeFileSync(
  join(out, 'index.html'),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GraphDone connection studies</title><style>body{background:#080f1d;color:#e7f1ff;font:16px system-ui;margin:32px auto;max-width:1100px;padding:0 20px}p{color:#a5b4c8;line-height:1.6}article{margin:32px 0;border:1px solid #27364b;border-radius:12px;padding:20px}img{max-width:100%;height:auto;display:block;margin:auto}a{color:#5eead4}code{font-size:12px}</style><h1>Organized connections, exact source relationships</h1><p>Small routing studies from GraphDone's candidate production routing module. Shared colors and junction dots mark an intentional source bus. Arrowheads preserve direction. Dense views disclose every collapsed relationship; the exact list remains required for production integration. These are visual fixtures, not a shipped application claim.</p><p><a href="metrics.json">Geometry and relationship accounting</a> · Deliberate spaghetti fixture rejected: ${negativeMetrics.cardIntersections} card intersections, ${negativeMetrics.unrelatedCrossings} unrelated crossings, ${negativeMetrics.unrelatedOverlaps} unrelated overlaps.</p>${reports.map(report => `<article><h2>${escape(report.title)}</h2><img src="${report.name}.svg" alt="${escape(report.title)}"><p>${report.routedRelationships} represented + ${report.collapsedRelationships} collapsed = ${report.sourceRelationships} original relationships.</p><code>${escape(JSON.stringify(report.metrics))}</code></article>`).join('')}</html>`
);
console.log(
  `Wrote ${reports.length} SVG fixtures, metrics and gallery to ${out}`
);
