import { spawn } from 'node:child_process';

/**
 * Spawn a child process, capture stdout/stderr/exit/duration. No shell (argv
 * array) so paths/args with spaces are safe. Resolves (never rejects) so the
 * harness can record a failed sequence and continue.
 */
export function runCommand(cmd, args, { cwd, env, timeoutMs } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs) : null;
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, durationMs: Date.now() - start, timedOut });
    });
    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(err), durationMs: Date.now() - start, error: String(err) });
    });
  });
}
