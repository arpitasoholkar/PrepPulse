// server/memory/extract.js  (Owner: C)
// Called when the student clicks "I understood".
// Saves a learning_preference (style + topic) and a concept_understood memory,
// using the last question and reply as evidence.

import * as lifecycle from './lifecycle.js';

async function saveUnderstood({ userId, topic, style, question, reply, messageId }) {
  if (!topic) return { saved: [], updated: [] };

  const evidenceText = `Said "I understood" after a ${style} explanation of: "${(question || '').slice(0, 80)}"`;

  const pref = await lifecycle.savePreference({ userId, topic, style, evidenceText, refId: messageId });
  const concept = await lifecycle.saveConceptUnderstood({ userId, topic, style, evidenceText, refId: messageId });

  return {
    saved: [...pref.saved, ...concept.saved],
    updated: [...pref.updated, ...concept.updated],
  };
}

export { saveUnderstood };