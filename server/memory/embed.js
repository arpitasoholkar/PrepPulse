// server/memory/embed.js
// Gemini embeddings over plain HTTPS. embedText() NEVER throws: it returns null on any problem,
// and a circuit breaker stops us from slowing every request down when the API is unavailable.
//
// Env (all optional):  EMBED_MODEL=gemini-embedding-001  EMBED_DIMS=768  EMBED_TIMEOUT_MS=5000
//                      DISABLE_VECTOR=1  (turns semantic recall off completely)

export const EMBED_MODEL = process.env.EMBED_MODEL || 'gemini-embedding-001';
export const EMBED_DIMS = Number(process.env.EMBED_DIMS) || 768;
const TIMEOUT_MS = Number(process.env.EMBED_TIMEOUT_MS) || 5000;
const BREAKER_MS = 60000;

let breakerUntil = 0;
let shape = null; // remembers which request body shape the API accepted: 'flat' | 'config'
let lastError = null;
let warnedDims = false;

export function embeddingsEnabled() {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.DISABLE_VECTOR !== '1';
}

export function embedStatus() {
  return {
    enabled: embeddingsEnabled(),
    model: EMBED_MODEL,
    dims: EMBED_DIMS,
    breakerOpen: Date.now() < breakerUntil,
    lastError,
  };
}

function bodyFor(kind, text, taskType) {
  const base = { model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] } };
  if (kind === 'flat') return { ...base, taskType, outputDimensionality: EMBED_DIMS };
  return { ...base, embedContentConfig: { taskType, outputDimensionality: EMBED_DIMS } };
}

async function post(kind, text, taskType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify(bodyFor(kind, text, taskType)),
        signal: controller.signal,
      }
    );
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalise(values) {
  let sum = 0;
  for (const v of values) sum += v * v;
  const norm = Math.sqrt(sum) || 1;
  return values.map((v) => v / norm);
}

/**
 * embedText(text, taskType) -> number[EMBED_DIMS] | null
 * taskType: 'RETRIEVAL_DOCUMENT' (stored memories) or 'RETRIEVAL_QUERY' (the student's question)
 */
export async function embedText(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean || !embeddingsEnabled() || Date.now() < breakerUntil) return null;

  const order = shape ? [shape] : ['flat', 'config'];
  for (const kind of order) {
    try {
      const data = await post(kind, clean, taskType);
      const values = data?.embedding?.values;
      if (!Array.isArray(values) || values.length === 0 || !values.every(Number.isFinite)) {
        throw new Error('no embedding values in response');
      }
      if (values.length !== EMBED_DIMS) {
        if (!warnedDims) {
          warnedDims = true;
          console.error(
            `[embed] model returned ${values.length} dims but EMBED_DIMS=${EMBED_DIMS}. ` +
              `Set EMBED_DIMS=${values.length} AND recreate the vector index with the same value.`
          );
        }
        lastError = `dimension mismatch (${values.length} != ${EMBED_DIMS})`;
        return null;
      }
      shape = kind;
      lastError = null;
      return normalise(values);
    } catch (err) {
      lastError = String(err.message).slice(0, 160);
      // 400 = this body shape is not accepted -> try the other one. Anything else -> back off.
      if (err.status === 400 && !shape && kind !== order[order.length - 1]) continue;
      console.error(`[embed] ${lastError}`);
      breakerUntil = Date.now() + BREAKER_MS;
      return null;
    }
  }
  breakerUntil = Date.now() + BREAKER_MS;
  return null;
}

/** test hook: clear breaker and remembered request shape */
export function _resetEmbedState() {
  breakerUntil = 0;
  shape = null;
  lastError = null;
}
