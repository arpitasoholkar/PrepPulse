// server/memory/ladder.js (Owner: C)
// The explanation ladder powered by rankStyles:
// Each time the student says "I didn't understand", we advance to the next best teaching style.
// Never repeats a style inside the ladder.
// Connects ladder state to ChatSession.ladder.tried.

import { rankStyles } from './styles.js';

/**
 * First step of a question or session:
 * Calls rankStyles to pick the optimal style and stylePlan.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.topic
 * @param {Array<Object>} [params.existingTried=[]] - Any styles already tried for this topic
 * @returns {Promise<{ ladder: Object, style: string, reason: string, stylePlan: Array<Object>, exhausted: boolean }>}
 */
export async function startLadder({ userId, topic, existingTried = [] }) {
  const triedStyles = (existingTried || []).map((t) => (t && t.toObject ? t.toObject().style : (typeof t === 'string' ? t : t.style)));
  const { style, reason, stylePlan, exhausted } = await rankStyles({
    userId,
    topic,
    tried: triedStyles,
  });

  const tried = (existingTried || []).map((t) => (t && t.toObject ? t.toObject() : t));
  if (style) {
    tried.push({ style, outcome: 'pending' });
  }

  const cleanTried = tried.map((t) => ({
    style: typeof t === 'string' ? t : t.style,
    outcome: typeof t === 'string' ? 'failed' : t.outcome || 'pending',
  }));

  const ladder = {
    topic: topic || null,
    step: cleanTried.length > 0 ? cleanTried.length - 1 : 0,
    stylesTried: cleanTried.map((t) => t.style),
    tried: cleanTried,
    exhausted: Boolean(exhausted),
  };

  return {
    ladder,
    style,
    reason,
    stylePlan,
    exhausted: Boolean(exhausted),
  };
}

/**
 * Advance ladder after "I don't understand":
 * Marks previous style as 'failed', calls rankStyles for next style among untried styles.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.ladder - Current session ladder
 * @returns {Promise<{ ladder: Object, style: string, reason: string, stylePlan: Array<Object>, exhausted: boolean }>}
 */
export async function nextStep({ userId, ladder = {} }) {
  const rawTried = ladder.tried || [];
  const currentTried = rawTried.map((item) => {
    const doc = item && item.toObject ? item.toObject() : item;
    if (typeof doc === 'string') return { style: doc, outcome: 'failed' };
    return {
      style: doc.style,
      outcome: doc.outcome === 'pending' ? 'failed' : (doc.outcome || 'failed'),
    };
  });

  const triedStyleNames = currentTried.map((t) => t.style);

  const { style, reason, stylePlan, exhausted } = await rankStyles({
    userId,
    topic: ladder.topic,
    tried: triedStyleNames,
  });

  if (style) {
    currentTried.push({ style, outcome: 'pending' });
  }

  const nextLadder = {
    topic: ladder.topic || null,
    step: (ladder.step || 0) + 1,
    stylesTried: currentTried.map((t) => t.style),
    tried: currentTried,
    exhausted: Boolean(exhausted),
  };

  return {
    ladder: nextLadder,
    style,
    reason,
    stylePlan,
    exhausted: Boolean(exhausted),
  };
}
