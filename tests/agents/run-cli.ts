import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Runs a real, bounded CLI agent in an empty scratch directory. Never logs credentials. */
export async function runAgent(provider: 'claude' | 'codex', prompt: string) {
  const cwd = await mkdtemp(join(tmpdir(), 'graphdone-agent-eval-'));
  const model = provider === 'claude' ? (process.env.QC_CLAUDE_MODEL || 'haiku') : (process.env.QC_CODEX_MODEL || 'gpt-5.4-mini');
  const bridge = join(__dirname, 'local-mcp.mjs');
  const credential = join(cwd, 'connection.json');
  if (provider === 'codex') {
    await writeFile(credential, JSON.stringify({ base: prompt.match(/Base URL: (\S+)/)![1], graphId: prompt.match(/Project ID: (\S+)/)![1], token: prompt.match(/Bearer (gd_agent_\S+)/)![1] }), { mode: 0o600 });
    prompt += '\nUse the configured graphdone_context, graphdone_update and graphdone_note MCP tools for this handoff. They call exactly the local API above. No shell is needed.';
  }
  const args = provider === 'claude'
    ? ['-p', '--model', model, '--output-format', 'json', '--max-budget-usd', '0.25', '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config', '--tools', 'Bash', '--allowedTools', 'Bash(curl *)']
    : ['exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--json', '-m', model, '-s', 'read-only', '-c', 'web_search="disabled"', '-c', `mcp_servers.graphdone.command=${JSON.stringify(process.execPath)}`, '-c', `mcp_servers.graphdone.args=${JSON.stringify([bridge, credential])}`, ...['graphdone_context','graphdone_update','graphdone_note'].flatMap(tool => ['-c', `mcp_servers.graphdone.tools.${tool}.approval_mode="approve"`]), '-'];
  try {
    return await new Promise<{provider: string; model: string; exitCode: number | null; output: string; elapsedMs: number}>((resolve, reject) => {
      const started = Date.now();
      const child = spawn(provider, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
      let output = ''; let error = ''; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, 180000);
      child.stdout.on('data', d => { output += d; });
      child.stderr.on('data', d => { error += d; });
      child.on('error', e => { clearTimeout(timer); reject(e); });
      child.on('close', code => {
        clearTimeout(timer);
        const safe = `${output}\n${error}`.replace(/gd_agent_[A-Za-z0-9_-]+/g, '[REDACTED]');
        resolve({ provider, model, exitCode: timedOut ? 124 : code, output: safe, elapsedMs: Date.now() - started });
      });
      child.stdin.end(prompt);
    });
  } finally { await rm(cwd, { recursive: true, force: true }); }
}
