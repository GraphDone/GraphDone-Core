import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

// Every tracked folder keeps a README.md with a diagram and working links, so
// the repository can be navigated from GitHub (the folder-readme skill says
// what a useful one contains; this checks the parts a program can).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const webRequire = createRequire(resolve(root, 'packages/web/package.json'));

// Folders that must not or need not carry a README:
// - packages/web/public/** is copied into the live site, so a README there
//   would be publicly served; packages/web/README.md describes it.
// - .agents/skills/<name>/ is described by its SKILL.md.
export function exempt(dir) {
  return dir === 'packages/web/public' || dir.startsWith('packages/web/public/') || /^\.agents\/skills\/[^/]+(\/|$)/.test(dir);
}

export function foldersOf(paths) {
  const dirs = new Set(['.']);
  for (const path of paths) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
  }
  return [...dirs].filter((dir) => !exempt(dir)).sort();
}

export function relativeLinks(text) {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^[a-z]+:/i.test(target));
}

export function mermaidBlocks(text) {
  return [...text.replace(/\r\n/g, '\n').matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function trackedPaths() {
  // Committed and staged files only: local untracked folders (editor settings,
  // scratch output) are not part of the repository and need no README.
  const result = spawnSync('git', ['ls-files', '--cached', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ls-files failed: ${result.stderr}`);
  return result.stdout.split('\0').filter(Boolean).filter((path) => existsSync(resolve(root, path)));
}

const readmes = foldersOf(trackedPaths()).map((dir) => (dir === '.' ? 'README.md' : `${dir}/README.md`));

test('every folder has a README.md with a diagram', () => {
  const missing = readmes.filter((path) => !existsSync(resolve(root, path)));
  assert.deepEqual(missing, [], `Folders without a README (see the folder-readme skill): ${missing.join(', ')}`);
  const noDiagram = readmes.filter((path) => mermaidBlocks(readFileSync(resolve(root, path), 'utf8')).length === 0);
  assert.deepEqual(noDiagram, [], `READMEs without a mermaid diagram: ${noDiagram.join(', ')}`);
  assert.ok(!existsSync(resolve(root, 'packages/web/public/README.md')), 'packages/web/public/ is served publicly; describe it in packages/web/README.md');
});

test('README links resolve', () => {
  const broken = [];
  for (const path of readmes) {
    for (const target of relativeLinks(readFileSync(resolve(root, path), 'utf8'))) {
      if (!existsSync(resolve(root, dirname(path), target))) broken.push(`${path} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test('README diagrams parse with the installed Mermaid', { timeout: 120000 }, async () => {
  const browser = await chromium.launch(process.env.QC_BROWSER_PORT ? { channel: 'chrome' } : {});
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    await page.setContent('<div></div>');
    await page.addScriptTag({ path: webRequire.resolve('mermaid/dist/mermaid.min.js') });
    await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' }));
    const failures = [];
    for (const path of readmes) {
      for (const source of mermaidBlocks(readFileSync(resolve(root, path), 'utf8'))) {
        const error = await page.evaluate(async (text) => {
          try { await window.mermaid.parse(text); return null; } catch (e) { return String(e?.message ?? e).split('\n').slice(0, 3).join(' '); }
        }, source);
        if (error) failures.push(`${path}: ${error}`);
      }
    }
    assert.deepEqual(failures, []);
    const bad = await page.evaluate(async () => {
      try { await window.mermaid.parse('flowchart LR\n  a[unclosed --> b'); return false; } catch { return true; }
    });
    assert.ok(bad, 'the parser must reject a broken diagram');
  } finally {
    await browser.close();
  }
});

test('folder rules', () => {
  assert.deepEqual(foldersOf(['a/b/c.ts', 'packages/web/public/x.svg', '.agents/skills/s/SKILL.md']), ['.', '.agents', '.agents/skills', 'a', 'a/b', 'packages', 'packages/web']);
  assert.equal(mermaidBlocks('x\n```mermaid\nflowchart LR\n  a --> b\n```\n').length, 1);
});
