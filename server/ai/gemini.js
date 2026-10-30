import { GoogleGenAI } from '@google/genai';

let aiInstance = null;

function getAI() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

export async function generateJSON({ system, prompt, schema }) {
  try {
    const ai = getAI();
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: schema
      }
    });

    const parsed = JSON.parse(response.text);
    return { data: parsed, degraded: false };
  } catch (err) {
    console.error('Gemini generateJSON error:', err.message);
    return { data: null, degraded: true };
  }
}

export async function generateText({ system, prompt }) {
  try {
    const ai = getAI();
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature: 0.2
      }
    });

    return { text: response.text, degraded: false };
  } catch (err) {
    console.error('Gemini generateText error:', err.message);
    return { text: null, degraded: true };
  }
}
