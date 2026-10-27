import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const webRequire = createRequire(resolve(root, 'packages/web/package.json'));

test('installed Mermaid renders exported syntax and KaTeX rejects inherited trust', { timeout: 30000 }, async () => {
  const mermaidRequire = createRequire(webRequire.resolve('mermaid'));
  const katex = mermaidRequire('katex');
  const options = Object.assign(Object.create({ trust: true }), { throwOnError: false });
  const markup = katex.renderToString('\\href{javascript:graphdoneProbe}{probe}', options);
  assert.doesNotMatch(markup, /<a\b|href="javascript:/i);
  const browser = await chromium.launch(process.env.QC_BROWSER_PORT ? { channel: 'chrome' } : {});
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.setContent('<div id="diagram"></div>');
    await page.addScriptTag({ path: webRequire.resolve('mermaid/dist/mermaid.min.js') });
    const result = await page.evaluate(async () => {
      window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', layout: 'dagre', theme: 'default', look: 'classic' });
      const source = 'flowchart LR\n  a["Plan the launch 🚀"] -->|DEPENDS_ON| b["Review &amp; ship"]';
      await window.mermaid.parse(source);
      const { svg } = await window.mermaid.render('owned-diagram', source);
      document.querySelector('#diagram').innerHTML = svg;
      return { nodes: document.querySelectorAll('.node').length, edges: document.querySelectorAll('.flowchart-link').length, text: document.body.textContent };
    });
    assert.equal(result.nodes, 2);
    assert.equal(result.edges, 1);
    assert.match(result.text, /Plan the launch 🚀/);
  } finally {
    await browser.close();
  }
});
