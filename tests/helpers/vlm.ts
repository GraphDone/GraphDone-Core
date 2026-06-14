import * as fs from 'fs';
import './testEnv';
import { envList, envNumber } from './testEnv';

/**
 * Protocol-agnostic client for LOCAL Vision-Language-Model servers.
 *
 * The actual endpoints (GPU workstations) live only in `.env.test.local`
 * (gitignored) as VLM_ENDPOINTS — never in the repo. Requests are round-robined
 * across every configured endpoint so visual evaluation spreads over all GPUs.
 *
 * Two wire protocols are supported and auto-detected per endpoint:
 *   - OpenAI-compatible: POST /v1/chat/completions with image_url data URIs
 *     (vLLM, LM Studio, llama.cpp server, Ollama's /v1 compat shim)
 *   - Ollama native:     POST /api/chat with a base64 images[] array
 *
 * Everything degrades gracefully: when VLM_ENDPOINTS is unset or no endpoint is
 * reachable, isVlmAvailable() is false and suites skip — so CI stays green.
 */

export type VlmProtocol = 'openai' | 'ollama';

export interface VlmVerdict {
  pass: boolean;
  score: number; // 0..1
  issues: string[];
  summary: string;
  raw?: string; // raw model text, for the report when parsing is imperfect
}

export interface Persona {
  key: string;
  label: string;
  /** Framing for the model — who it is and what it cares about. */
  system: string;
  /** What "pass" means, appended to every prompt for this persona. */
  rubric: string;
}

/**
 * The evaluation perspectives. Each judges a rendered screenshot from a
 * distinct point of view, so one capture yields several independent reads.
 */
export const PERSONAS: Persona[] = [
  {
    key: 'visual-defects',
    label: 'Visual defects',
    system:
      'You are a meticulous UI rendering QA inspector for a graph-visualization web app. ' +
      'You judge ONLY what is visible in the screenshot — objective rendering correctness.',
    rubric:
      'Fail if you see: nodes overlapping so labels are unreadable, nodes/text cut off at the edges, ' +
      'a broken or empty layout where content is expected, edges that clearly do not connect nodes, ' +
      'obvious visual glitches, or any error message / "Error" badge / blank red state. ' +
      'Pass if the graph (or its empty-state invitation) renders cleanly and legibly.',
  },
  {
    key: 'new-user',
    label: 'New-user clarity',
    system:
      'You are a first-time user who has never seen this product. You are evaluating whether the ' +
      'screen is clear, inviting, and self-explanatory.',
    rubric:
      'Fail if you would feel lost or could not tell what to do next, or the screen looks intimidating ' +
      'or cluttered to a newcomer. Pass if the purpose is clear and there is an obvious next action.',
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    system:
      'You are an accessibility reviewer judging a rendered screenshot for visual a11y.',
    rubric:
      'Fail if text contrast looks too low to read, text is too small, information is conveyed by color ' +
      'alone, or interactive targets look too small to tap. Pass if it appears broadly legible and usable.',
  },
  {
    key: 'living-graph',
    label: 'Living-graph aliveness',
    system:
      'You evaluate whether a graph visualization feels "alive" and communicates work status. Nodes may ' +
      'glow by priority, pulse/breathe when in progress, look settled when complete, or ache when blocked; ' +
      'edges may show energy flow.',
    rubric:
      'Fail if the graph looks completely static/flat with no visual hierarchy or status cues, or if the ' +
      'effects look chaotic/noisy rather than purposeful. Pass if status and priority read clearly and the ' +
      'scene feels alive but legible. (Judge the single frame; do not penalize lack of motion in a still.)',
  },
];

export const personaByKey = (key: string): Persona | undefined =>
  PERSONAS.find((p) => p.key === key);

const TIMEOUT_MS = envNumber('VLM_TIMEOUT_MS', 120_000);
const MAX_CONCURRENCY = Math.max(1, envNumber('VLM_MAX_CONCURRENCY', 3));

let rrCounter = 0;
const protocolCache = new Map<string, VlmProtocol>();

export function vlmEndpoints(): string[] {
  return envList('VLM_ENDPOINTS').map((e) => e.replace(/\/+$/, ''));
}

export function vlmModel(): string {
  return (process.env.VLM_MODEL ?? '').trim();
}

export function isVlmConfigured(): boolean {
  return vlmEndpoints().length > 0 && vlmModel().length > 0;
}

function authHeaders(): Record<string, string> {
  const key = (process.env.VLM_API_KEY ?? '').trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Detect (and cache) the wire protocol for a single endpoint. */
async function detectProtocol(base: string): Promise<VlmProtocol | null> {
  const forced = (process.env.VLM_PROTOCOL ?? 'auto').trim().toLowerCase();
  if (forced === 'openai' || forced === 'ollama') return forced;
  if (protocolCache.has(base)) return protocolCache.get(base)!;
  // OpenAI-compatible servers expose /v1/models.
  try {
    const r = await fetchWithTimeout(`${base}/v1/models`, { headers: authHeaders() }, 5000);
    if (r.ok) { protocolCache.set(base, 'openai'); return 'openai'; }
  } catch { /* try next */ }
  // Ollama exposes /api/tags.
  try {
    const r = await fetchWithTimeout(`${base}/api/tags`, {}, 5000);
    if (r.ok) { protocolCache.set(base, 'ollama'); return 'ollama'; }
  } catch { /* unreachable */ }
  return null;
}

/** Endpoints that are configured AND currently reachable, with their protocol. */
export async function reachableEndpoints(): Promise<Array<{ base: string; protocol: VlmProtocol }>> {
  const out: Array<{ base: string; protocol: VlmProtocol }> = [];
  await Promise.all(
    vlmEndpoints().map(async (base) => {
      const protocol = await detectProtocol(base);
      if (protocol) out.push({ base, protocol });
    })
  );
  return out;
}

let availabilityCache: boolean | null = null;
/** True only if VLM is configured and at least one endpoint responds. */
export async function isVlmAvailable(): Promise<boolean> {
  if (!isVlmConfigured()) return false;
  if (availabilityCache !== null) return availabilityCache;
  availabilityCache = (await reachableEndpoints()).length > 0;
  return availabilityCache;
}

function extractVerdict(text: string): VlmVerdict {
  // Models wrap JSON in prose or code fences; grab the first balanced object.
  let parsed: Record<string, unknown> | null = null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { parsed = JSON.parse(candidate.slice(start, end + 1)); } catch { /* fall through */ }
  }
  if (!parsed) {
    return { pass: false, score: 0, issues: ['Could not parse a JSON verdict from the model'], summary: text.slice(0, 300), raw: text };
  }
  const issuesRaw = parsed.issues;
  const issues = Array.isArray(issuesRaw) ? issuesRaw.map((i) => String(i)) : issuesRaw ? [String(issuesRaw)] : [];
  let score = Number(parsed.score);
  if (!Number.isFinite(score)) score = parsed.pass ? 1 : 0;
  if (score > 1) score = score / 100; // tolerate 0-100 scales
  return {
    pass: Boolean(parsed.pass),
    score: Math.max(0, Math.min(1, score)),
    issues,
    summary: String(parsed.summary ?? '').slice(0, 600),
    raw: text,
  };
}

const PROMPT_TAIL =
  'Respond with ONLY a JSON object, no prose, of exactly this shape: ' +
  '{"pass": boolean, "score": number between 0 and 1, "issues": string[], "summary": string}. ' +
  'Keep issues short and specific. Be fair: this is a still frame.';

function buildPrompt(persona: Persona, context: string): string {
  return `Context: this screenshot shows ${context}.\n\n${persona.rubric}\n\n${PROMPT_TAIL}`;
}

async function callOpenAI(base: string, model: string, system: string, prompt: string, b64: string): Promise<string> {
  const r = await fetchWithTimeout(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI VLM ${base} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callOllama(base: string, model: string, system: string, prompt: string, b64: string): Promise<string> {
  const r = await fetchWithTimeout(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt, images: [b64] },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Ollama VLM ${base} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data?.message?.content ?? '';
}

/**
 * Evaluate one screenshot from one persona's perspective. Round-robins across
 * reachable endpoints. Never throws — failures come back as a non-pass verdict
 * so the report is always complete.
 */
export async function evaluateImage(
  imagePath: string,
  persona: Persona,
  context: string,
  endpoints?: Array<{ base: string; protocol: VlmProtocol }>
): Promise<VlmVerdict> {
  const eps = endpoints ?? (await reachableEndpoints());
  if (eps.length === 0) {
    return { pass: false, score: 0, issues: ['No reachable VLM endpoint'], summary: '' };
  }
  const { base, protocol } = eps[rrCounter++ % eps.length];
  const model = vlmModel();
  const prompt = buildPrompt(persona, context);
  try {
    const b64 = fs.readFileSync(imagePath).toString('base64');
    const text =
      protocol === 'openai'
        ? await callOpenAI(base, model, persona.system, prompt, b64)
        : await callOllama(base, model, persona.system, prompt, b64);
    return extractVerdict(text);
  } catch (err) {
    return {
      pass: false,
      score: 0,
      issues: [`VLM request failed: ${err instanceof Error ? err.message : String(err)}`],
      summary: '',
    };
  }
}

/** Run a batch of {imagePath, persona, context} jobs with bounded concurrency. */
export async function evaluateBatch(
  jobs: Array<{ imagePath: string; persona: Persona; context: string; meta?: Record<string, unknown> }>
): Promise<Array<{ persona: string; context: string; imagePath: string; verdict: VlmVerdict; meta?: Record<string, unknown> }>> {
  const eps = await reachableEndpoints();
  const results: Array<{ persona: string; context: string; imagePath: string; verdict: VlmVerdict; meta?: Record<string, unknown> }> = [];
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const job = jobs[idx++];
      const verdict = await evaluateImage(job.imagePath, job.persona, job.context, eps);
      results.push({ persona: job.persona.key, context: job.context, imagePath: job.imagePath, verdict, meta: job.meta });
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, jobs.length) }, worker));
  return results;
}
