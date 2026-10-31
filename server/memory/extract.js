// server/memory/extract.js  (Owner: C)
// Section 8: P1 Free-text facts extraction via LLM.
// Extracts durable learning facts from ONE chat message using generateJSON.

import { generateJSON } from '../ai/gemini.js';
import { TOPICS, Memory } from './deps.js';
import { shouldSave } from './gate.js';
import * as lifecycle from './lifecycle.js';

const EXTRACT_SYSTEM = `You extract durable learning facts about a student from ONE chat message.
Return JSON: {"facts":[{"type":"weakness|strength|mistake|learning_preference|revision_needed","topic":"one of the allowed topics or *","content":"short sentence in third person","importance":1-5,"about_learning":true|false}]}
Rules: only facts about how this student learns DSA (struggles, strengths, preferences, deadlines).
Ignore greetings, thanks, jokes, questions about concepts, and any personal data.
If there is nothing worth saving return {"facts":[]}. Never invent facts.`;

const EXTRACT_SCHEMA = `{
  "facts": [
    {
      "type": "weakness | strength | mistake | learning_preference | revision_needed",
      "topic": "one of the allowed topics or *",
      "content": "short sentence in third person",
      "importance": 3,
      "about_learning": true
    }
  ]
}`;

/**
 * Extracts facts from free-form student text in chat.
 * Saves facts if importance >= 3 and about_learning is true.
 * Checks for contradictions (e.g., student says they are comfortable with a topic where they had a weakness).
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.message
 * @param {string} params.messageId
 * @returns {Promise<{ saved: Array<Object>, updated: Array<Object>, skipped: Array<Object> }>}
 */
export async function extractFactsFromChat({ userId, message, messageId }) {
  const saved = [];
  const updated = [];
  const skipped = [];

  if (!message || typeof message !== 'string') {
    return { saved, updated, skipped };
  }

  // 1. Contradiction check: "I'm comfortable with X now", "I understand X now"
  // If student states comfort with a topic with active weakness, lower weakness confidence by 0.25 and set needs_verification
  const comfortMatch = message.match(/\b(?:comfortable with|confident in|good at|mastered|got the hang of)\s+([a-zA-Z-]+)\b/i);
  if (comfortMatch) {
    const matchedTopic = comfortMatch[1].toLowerCase();
    const validTopic = TOPICS.find((t) => t.toLowerCase() === matchedTopic || matchedTopic.includes(t.toLowerCase()));
    if (validTopic) {
      const activeWeakness = await Memory.findOne({
        userId,
        type: 'weakness',
        topic: validTopic,
        status: 'active',
      });

      if (activeWeakness && activeWeakness.status !== 'corrected') {
        const newConf = Math.max(0.1, (activeWeakness.confidence || 0.7) - 0.25);
        const up = await Memory.findByIdAndUpdate(
          activeWeakness._id,
          {
            $set: {
              confidence: newConf,
              'meta.needs_verification': true,
              lastVerified: new Date(),
            },
            $push: {
              evidence: {
                text: `Student stated: "${message.slice(0, 80)}" in chat`,
                source: 'chat',
                refId: messageId,
                at: new Date(),
              },
            },
          },
          { new: true }
        );
        updated.push(up.toObject ? up.toObject() : up);
      }
    }
  }

  // 2. Call Gemini to extract durable learning facts
  try {
    const { data, degraded } = await generateJSON({
      system: EXTRACT_SYSTEM,
      prompt: `Student message: "${message}"\nAllowed topics: ${TOPICS.join(', ')}.`,
      schema: EXTRACT_SCHEMA,
    });

    if (degraded || !data || !Array.isArray(data.facts)) {
      return { saved, updated, skipped };
    }

    // At most 2 new memories per chat message
    const candidates = data.facts.slice(0, 2);

    for (const fact of candidates) {
      const gateResult = shouldSave({
        userId,
        type: fact.type,
        topic: fact.topic,
        evidenceText: message,
        content: fact.content,
        aboutLearning: fact.about_learning,
        importance: fact.importance,
        degraded: false,
      });

      if (!gateResult.ok) {
        skipped.push({ text: fact.content || message, reason: gateResult.reason });
        continue;
      }

      if (fact.about_learning && (fact.importance || 0) >= 3) {
        // Create tentative memory with 7-day TTL
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const created = await Memory.create({
          userId,
          type: fact.type || 'learning_preference',
          topic: fact.topic || '*',
          content: fact.content,
          evidence: [
            {
              text: `Extracted from chat: "${message.slice(0, 80)}"`,
              source: 'chat',
              refId: messageId,
              at: new Date(),
            },
          ],
          confidence: 0.5,
          status: 'active',
          meta: {
            tentative: true,
            importance: fact.importance,
          },
          source: 'chat',
          lastVerified: new Date(),
          expiresAt,
        });

        saved.push(created.toObject ? created.toObject() : created);
      }
    }
  } catch (err) {
    // Silently skip LLM extraction failure as per spec
  }

  return { saved, updated, skipped };
}

// Legacy helper kept for compatibility
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
