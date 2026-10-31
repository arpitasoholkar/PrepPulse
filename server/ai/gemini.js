// server/ai/gemini.js  (Owner: C)
// Plain HTTPS (Node 18+ has fetch). Providers are tried in order:
//   1. Gemini, GEMINI_MODEL
//   2. Gemini, GEMINI_FALLBACK_MODEL          (optional, same key)
//   3. Any OpenAI-compatible API via FALLBACK_* (xAI Grok, Groq, OpenRouter...) (optional)
// generateJSON / generateText NEVER throw. They return { degraded: true } if every provider fails.

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 15000;
const COOLDOWN_MS = 45000;
const cooldown = new Map(); // provider name -> skip until this time

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function providers() {
  const list = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  const primary = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

  if (geminiKey) {
    list.push({ kind: 'gemini', name: `gemini:${primary}`, key: geminiKey, model: primary });
    const backup = process.env.GEMINI_FALLBACK_MODEL;
    if (backup && backup !== primary) {
      list.push({ kind: 'gemini', name: `gemini:${backup}`, key: geminiKey, model: backup });
    }
  }
  if (process.env.FALLBACK_API_KEY && process.env.FALLBACK_MODEL) {
    list.push({
      kind: 'openai',
      name: `fallback:${process.env.FALLBACK_MODEL}`,
      key: process.env.FALLBACK_API_KEY,
      model: process.env.FALLBACK_MODEL,
      baseUrl: (process.env.FALLBACK_BASE_URL || 'https://api.x.ai/v1').replace(/\/+$/, ''),
    });
  }
  return list;
}

// Skip providers that failed in the last 45s, unless that would leave nothing.
function usable(chain) {
  const now = Date.now();
  const ready = chain.filter((p) => (cooldown.get(p.name) || 0) <= now);
  return ready.length > 0 ? ready : chain;
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(p, { system, prompt, json }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: json ? 0 : 0.4 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (json) body.generationConfig.responseMimeType = 'application/json';

  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.key },
      body: JSON.stringify(body),
    }
  );
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((x) => x.text || '').join('').trim();
  if (!text) throw new Error('empty text');
  return text;
}

async function callOpenAI(p, { system, prompt, json }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  const body = { model: p.model, messages, temperature: json ? 0 : 0.4 };
  if (json) body.response_format = { type: 'json_object' };

  const data = await fetchJson(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
    body: JSON.stringify(body),
  });
  const text = (data?.choices?.[0]?.message?.content || '').trim();
  if (!text) throw new Error('empty text');
  return text;
}

function parseJSON(text) {
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  return JSON.parse(clean);
}

async function run({ system, prompt, json, parse }) {
  const chain = usable(providers());
  if (chain.length === 0) {
    console.error('[ai] no provider configured (set GEMINI_API_KEY)');
    return null;
  }
  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    const attempts = i === chain.length - 1 ? 2 : 1; // only the last provider gets a retry
    for (let a = 1; a <= attempts; a++) {
      try {
        const text =
          p.kind === 'gemini'
            ? await callGemini(p, { system, prompt, json })
            : await callOpenAI(p, { system, prompt, json });
        const value = parse ? parse(text) : text; // bad JSON counts as a failure too
        cooldown.delete(p.name);
        if (i > 0) console.log(`[ai] answered by backup ${p.name}`);
        return { value, provider: p.name };
      } catch (err) {
        console.error(`[ai] ${p.name} attempt ${a} failed: ${String(err.message).slice(0, 160)}`);
        if (a < attempts) await sleep(700);
      }
    }
    cooldown.set(p.name, Date.now() + COOLDOWN_MS);
  }
  return null;
}

/** generateJSON({ system, prompt, schema }) -> { data, degraded, provider } */
async function generateJSON({ system, prompt, schema }) {
  const fullPrompt = schema
    ? `${prompt}\n\nReturn ONLY valid JSON in exactly this shape:\n${schema}`
    : prompt;
  const r = await run({ system, prompt: fullPrompt, json: true, parse: parseJSON });
  return r
    ? { data: r.value, degraded: false, provider: r.provider }
    : { data: null, degraded: true };
}

/** generateText({ system, prompt }) -> { text, degraded, provider } */
async function generateText({ system, prompt }) {
  const r = await run({ system, prompt, json: false });
  return r
    ? { text: r.value, degraded: false, provider: r.provider }
    : { text: '', degraded: true };
}

export { generateJSON, generateText };