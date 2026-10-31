// server/memory/gate.js (Owner: C)
// Every memory write goes through shouldSave(candidate).
// Candidate fields:
// { userId, type, topic, style, errorType, evidenceText, refId, degraded, isFeedback, aboutLearning, importance, alreadyRecorded }

import { TOPICS } from './deps.js';

/**
 * Normalises text for deduplication comparison
 */
export function normalise(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Checks for personal data:
 * - Emails
 * - 10-digit phone numbers (or similar sequences)
 * - Password strings
 */
export function hasPersonalData(text) {
  if (!text || typeof text !== 'string') return false;
  
  // Email regex
  const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;
  if (emailRegex.test(text)) return true;

  // Phone number (10 digits, possibly with dashes/spaces/country code)
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10}\b/;
  if (phoneRegex.test(text)) return true;

  // Password keyword or credential strings
  const passwordRegex = /\b(password|passwd|pwd|secret|api[_-]?key)\s*[:=]\s*\S+/i;
  if (passwordRegex.test(text)) return true;

  return false;
}

/**
 * Checks if input is trivial small talk
 */
export function isSmallTalk(text) {
  if (!text || typeof text !== 'string') return false;
  const cleaned = text.trim().toLowerCase().replace(/[^\w\s]/g, '');
  const smallTalkWords = [
    'hi', 'hello', 'hey', 'greetings',
    'thanks', 'thank you', 'thx', 'ty',
    'ok', 'okay', 'k', 'cool', 'nice', 'great', 'awesome',
    'bye', 'goodbye', 'see ya'
  ];
  return smallTalkWords.includes(cleaned);
}

/**
 * Section 3.2 Gate:
 * Evaluates whether a memory write is allowed.
 * Returns { ok: boolean, reason: string }
 */
export function shouldSave(candidate = {}) {
  // 1. The reply was real. If AI message degraded: true, nothing is learned.
  if (candidate.degraded === true) {
    return { ok: false, reason: 'AI reply was a fallback' };
  }

  // 8. Idempotent feedback.
  if (candidate.alreadyRecorded === true) {
    return { ok: false, reason: 'already recorded' };
  }

  // 5. No personal data.
  const allTexts = [candidate.evidenceText, candidate.content, candidate.question, candidate.reply].filter(Boolean).join(' ');
  if (hasPersonalData(allTexts)) {
    return { ok: false, reason: 'personal data detected' };
  }

  // 4. It is about learning. Greetings, thanks, jokes and off-topic chat are skipped.
  if (candidate.isSmallTalk || isSmallTalk(candidate.question) || isSmallTalk(candidate.evidenceText)) {
    return { ok: false, reason: 'small talk' };
  }

  if (candidate.aboutLearning === false) {
    return { ok: false, reason: 'not about learning' };
  }

  if (typeof candidate.importance === 'number' && candidate.importance < 3) {
    return { ok: false, reason: 'low importance' };
  }

  // 2. The topic is valid. Must be one of the 10 topics.
  // For style preference with no detected topic, '*' is allowed.
  const allowedTopics = [...TOPICS, '*'];
  if (!candidate.topic || !allowedTopics.includes(candidate.topic)) {
    if (candidate.type === 'learning_preference') {
      candidate.topic = '*';
    } else {
      return { ok: false, reason: 'no topic' };
    }
  }

  // 3. Concrete evidence in plain text.
  if (!candidate.evidenceText || String(candidate.evidenceText).trim().length === 0) {
    return { ok: false, reason: 'no concrete evidence' };
  }

  return { ok: true, reason: 'passed gate' };
}
