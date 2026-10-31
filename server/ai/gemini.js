// server/ai/gemini.js  (Owner: C)
// Talks to Gemini over plain HTTPS (no extra npm package needed, Node 18+ has fetch).
// Both functions NEVER throw. They return { degraded: true } when something fails.

const TIMEOUT_MS = 15000;

function modelName() {
  // Change the model in .env without touching code
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

async function callGemini({ system, prompt, json }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: json ? 0 : 0.4 },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (json) body.generationConfig.responseMimeType = 'application/json';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName()}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini returned empty text');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseJSON(text) {
  // Remove ```json fences if the model adds them anyway
  const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  return JSON.parse(clean);
}

/**
 * generateJSON({ system, prompt, schema })
 * schema = a short string showing the JSON shape you want (added to the prompt)
 * returns { data, degraded }
 */
async function generateJSON({ system, prompt, schema }) {
  const fullPrompt = schema
    ? `${prompt}\n\nReturn ONLY valid JSON in exactly this shape:\n${schema}`
    : prompt;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini({ system, prompt: fullPrompt, json: true });
      return { data: parseJSON(text), degraded: false };
    } catch (err) {
      console.error(`[gemini] generateJSON attempt ${attempt} failed:`, err.message);
    }
  }
  return { data: null, degraded: true };
}

/**
 * generateText({ system, prompt })
 * returns { text, degraded }
 */
async function generateText({ system, prompt }) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callGemini({ system, prompt, json: false });
      return { text, degraded: false };
    } catch (err) {
      console.error(`[gemini] generateText attempt ${attempt} failed:`, err.message);
    }
  }
  return { text: '', degraded: true };
}

export { generateJSON, generateText };