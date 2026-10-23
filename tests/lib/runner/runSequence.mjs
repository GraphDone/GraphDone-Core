import { spawn } from 'node:child_process';

const activeCommands = new Set();
const interruptHandlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map(signal => [signal, () => {
  const hasOtherHandlers = process.listeners(signal).some(handler => handler !== interruptHandlers[signal]);
  for (const stop of [...activeCommands]) stop(signal);
  if (!hasOtherHandlers) process.exit(signal === 'SIGINT' ? 130 : 143);
}]));

function registerCommand(stop) {
  activeCommands.add(stop);
  if (activeCommands.size === 1) {
    for (const [signal, handler] of Object.entries(interruptHandlers)) process.prependListener(signal, handler);
  }
  return () => {
    activeCommands.delete(stop);
    if (activeCommands.size === 0) {
      for (const [signal, handler] of Object.entries(interruptHandlers)) process.removeListener(signal, handler);
    }
  };
}

/**
 * Spawn a child process, capture stdout/stderr/exit/duration. No shell (argv
 * array) so paths/args with spaces are safe. Resolves (never rejects) so the
 * harness can record a failed sequence and continue.
 */
export function runCommand(cmd, args, { cwd, env, timeoutMs, terminationGraceMs = 1000 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const ownsProcessGroup = process.platform !== 'win32';
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, detached: ownsProcessGroup });
    let stdout = '';
    let stderr = '';
    let code = null;
    let error;
    let closed = false;
    let settled = false;
    let forced = false;
    let graceTimer;
    let drainTimer;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    let timedOut = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      clearTimeout(drainTimer);
      unregister();
      child.stdin.destroy();
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      resolve({ code, stdout, stderr, durationMs: Date.now() - start, timedOut, ...(error && { error }) });
    };
    const terminate = signal => {
      if (!Number.isSafeInteger(child.pid) || child.pid <= 0) return;
      try {
        if (ownsProcessGroup) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (err) {
        if (err.code !== 'ESRCH') stderr += `\nFailed to terminate owned command: ${String(err)}`;
      }
    };
    const unregister = registerCommand(signal => {
      error = `Command interrupted by ${signal}`;
      stderr += `\n${error}`;
      terminate('SIGKILL');
      finish();
    });
    const timer = timeoutMs ? setTimeout(() => {
      timedOut = true;
      terminate('SIGTERM');
      graceTimer = setTimeout(() => {
        forced = true;
        terminate('SIGKILL');
        if (closed) finish();
        else drainTimer = setTimeout(finish, 100);
      }, terminationGraceMs);
    }, timeoutMs) : null;
    child.on('exit', exitCode => { code = exitCode; });
    child.on('close', exitCode => {
      code = exitCode;
      closed = true;
      if (!timedOut || forced) finish();
    });
    child.on('error', err => {
      error = String(err);
      stderr += error;
      if (!timedOut) {
        code = -1;
        finish();
      }
    });
  });
}
