// server/memory/understanding.js
// Pure functions, no database. Tracks HOW WELL the student understands a topic
// from their answers to check questions, and turns that into teaching guidance.
//
// State (one per topic, kept inside ChatSession.understanding):
//   { level, streakRight, streakWrong, answered, correct, lastVerdict,
//     weakConcepts[], strongConcepts[], questionsAsked[] }

export const LEVELS = ['basic', 'intermediate', 'advanced'];
export const VERDICTS = ['correct', 'partial', 'wrong'];

const MAX_LIST = 6;
const MAX_QUESTIONS = 8;

export function defaultUnderstanding(level = 'basic') {
  return {
    level: LEVELS.includes(level) ? level : 'basic',
    streakRight: 0,
    streakWrong: 0,
    answered: 0,
    correct: 0,
    lastVerdict: null,
    weakConcepts: [],
    strongConcepts: [],
    questionsAsked: [],
  };
}

/** Clone + fill missing fields so old / partial sessions never crash. */
export function normaliseUnderstanding(raw, fallbackLevel = 'basic') {
  const base = defaultUnderstanding(fallbackLevel);
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    level: LEVELS.includes(raw.level) ? raw.level : base.level,
    weakConcepts: Array.isArray(raw.weakConcepts) ? [...raw.weakConcepts] : [],
    strongConcepts: Array.isArray(raw.strongConcepts) ? [...raw.strongConcepts] : [],
    questionsAsked: Array.isArray(raw.questionsAsked) ? [...raw.questionsAsked] : [],
  };
}

/** A new student starts at 'basic'. If memory says they already understood the topic, start higher. */
export function initialLevel(memories = []) {
  const list = (memories || []).map((m) => m.memory || m);
  const understood = list.some((m) => m.type === 'concept_understood' && (m.confidence || 0) >= 0.6);
  const weak = list.some((m) => m.type === 'weakness' && m.status === 'active');
  if (weak) return 'basic';
  return understood ? 'intermediate' : 'basic';
}

const shift = (level, delta) => {
  const i = LEVELS.indexOf(level) + delta;
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
};

const pushUnique = (list, item, max = MAX_LIST) => {
  const clean = String(item || '').trim().toLowerCase();
  if (!clean) return list;
  const next = list.filter((x) => x !== clean);
  next.push(clean);
  return next.slice(-max);
};

const without = (list, item) => {
  const clean = String(item || '').trim().toLowerCase();
  return list.filter((x) => x !== clean);
};

/**
 * Update state after one judged answer.
 *   correct: streak grows; 2 right in a row -> level up (reset streak)
 *   partial: level stays; streaks reset a little
 *   wrong  : level drops one step right away (simpler next reply)
 * Returns { state, levelChange: -1 | 0 | 1 }.
 */
export function applyVerdict(rawState, verdict, { concept = null } = {}) {
  const s = normaliseUnderstanding(rawState);
  if (!VERDICTS.includes(verdict)) return { state: s, levelChange: 0 };

  const before = s.level;
  s.answered += 1;
  s.lastVerdict = verdict;

  if (verdict === 'correct') {
    s.correct += 1;
    s.streakRight += 1;
    s.streakWrong = 0;
    if (concept) {
      s.strongConcepts = pushUnique(s.strongConcepts, concept);
      s.weakConcepts = without(s.weakConcepts, concept);
    }
    if (s.streakRight >= 2) {
      s.level = shift(s.level, +1);
      s.streakRight = 0;
    }
  } else if (verdict === 'partial') {
    s.streakRight = 0;
    s.streakWrong = 0;
    if (concept) s.weakConcepts = pushUnique(s.weakConcepts, concept);
  } else {
    s.streakWrong += 1;
    s.streakRight = 0;
    s.level = shift(s.level, -1);
    if (concept) {
      s.weakConcepts = pushUnique(s.weakConcepts, concept);
      s.strongConcepts = without(s.strongConcepts, concept);
    }
  }

  const delta = LEVELS.indexOf(s.level) - LEVELS.indexOf(before);
  return { state: s, levelChange: Math.sign(delta) };
}

/** "I don't understand" (button or typed): drop a level so the next reply is simpler. */
export function applyNotUnderstood(rawState) {
  const s = normaliseUnderstanding(rawState);
  const before = s.level;
  s.level = shift(s.level, -1);
  s.streakRight = 0;
  s.streakWrong += 1;
  s.lastVerdict = 'wrong';
  return { state: s, levelChange: Math.sign(LEVELS.indexOf(s.level) - LEVELS.indexOf(before)) };
}

/** Remember what the student asked (last few), so follow-ups keep their context. */
export function rememberQuestion(rawState, question) {
  const s = normaliseUnderstanding(rawState);
  const q = String(question || '').trim().slice(0, 160);
  if (q) s.questionsAsked = [...s.questionsAsked, q].slice(-MAX_QUESTIONS);
  return s;
}

const LEVEL_RULES = {
  basic:
    'BASIC level: use very simple words and short sentences. Start from a tiny everyday or real-value example before any formal term. Introduce at most ONE new term and define it immediately. No edge cases or optimisation yet.',
  intermediate:
    'INTERMEDIATE level: normal technical vocabulary with short definitions. Show code or a dry run, mention time/space complexity and one common pitfall. The check question should need real thinking (trace or predict).',
  advanced:
    'ADVANCED level: the student is doing well, so skip the basics. Use precise terminology, trade-offs, edge cases, variations and interview-style angles. The check question should be tough (tricky trace, complexity reasoning, or a modified problem).',
};

/**
 * Text that goes into the mentor system prompt.
 * `judged` is the result of judging the student's last answer (or null).
 */
export function buildAdaptation({ state, judged = null, levelChange = 0 }) {
  const s = normaliseUnderstanding(state);
  const lines = [LEVEL_RULES[s.level]];

  if (judged && VERDICTS.includes(judged.verdict)) {
    if (judged.verdict === 'correct') {
      lines.push(
        'The student answered your last check question CORRECTLY. Confirm it in one short sentence' +
          (judged.whatRight ? ` (they got right: ${judged.whatRight})` : '') +
          '. Then go one step deeper: ' +
          (levelChange > 0
            ? 'they just moved up a level, so say so briefly and introduce tougher terminology / a more advanced idea.'
            : 'a slightly harder angle of the same topic, or the next related concept.')
      );
    } else if (judged.verdict === 'partial') {
      lines.push(
        'The student answered PARTLY right. Say exactly which part was right' +
          (judged.whatRight ? ` (${judged.whatRight})` : '') +
          ' and which part was missing or wrong' +
          (judged.whatMissing ? ` (${judged.whatMissing})` : '') +
          '. Fix the gap in simple words, then ask a similar question at the same level.'
      );
    } else {
      lines.push(
        'The student answered your last check question WRONGLY. Say clearly that it is not correct, in a kind tone. ' +
          (judged.misconception ? `Their likely misunderstanding: ${judged.misconception}. ` : '') +
          'Explain WHY it is wrong in very easy language, give the correct answer, re-teach the idea with a BASIC example with small numbers, ' +
          'then ask an EASIER question on the same idea. Do not move on to new material.'
      );
    }
  } else if (levelChange < 0) {
    lines.push('The student found the last explanation hard. Be simpler than before and start from a basic example.');
  }

  if (s.weakConcepts.length) {
    lines.push(`Concepts this student is still weak on: ${s.weakConcepts.join(', ')}. Weave a quick reminder in when relevant.`);
  }
  if (s.strongConcepts.length) {
    lines.push(`Concepts this student already handles well: ${s.strongConcepts.join(', ')}. Do not re-teach them.`);
  }
  if (s.questionsAsked.length) {
    lines.push(`Earlier questions from this student in this session: ${s.questionsAsked.map((q) => `"${q}"`).join('; ')}.`);
  }
  return lines.join('\n');
}

/**
 * Pulls the hidden check block out of a mentor reply.
 *   ...visible reply...
 *   [[CHECK]]{"question":"...","answer":"...","concept":"..."}[[/CHECK]]
 * Returns { reply (block removed), check | null }.
 */
export function splitCheck(text) {
  const raw = String(text || '');
  const m = raw.match(/\[\[CHECK\]\]([\s\S]*?)\[\[\/CHECK\]\]/i);
  const reply = raw.replace(/\[\[CHECK\]\][\s\S]*?\[\[\/CHECK\]\]/gi, '').trim();
  if (!m) return { reply: reply.replace(/\[\[CHECK\]\][\s\S]*$/i, '').trim(), check: null };
  try {
    const json = JSON.parse(m[1].trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
    const question = String(json.question || '').trim();
    const answer = String(json.answer || '').trim();
    if (!question || !answer) return { reply, check: null };
    return {
      reply,
      check: { question, answer, concept: String(json.concept || '').trim().toLowerCase() || null },
    };
  } catch {
    return { reply, check: null };
  }
}

/**
 * Cheap offline grading, used only when the AI is down.
 * Returns 'correct' | 'partial' | 'wrong' | null (cannot tell).
 */
export function heuristicVerdict(studentAnswer, expectedAnswer) {
  const norm = (t) =>
    String(t || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = norm(studentAnswer);
  const e = norm(expectedAnswer);
  if (!a || !e) return null;
  if (a === e || a.includes(e) || (a.length >= 3 && e.includes(a) && e.split(' ').length <= 3)) return 'correct';
  const eTokens = [...new Set(e.split(' ').filter((w) => w.length > 1 || /\d/.test(w)))];
  if (eTokens.length === 0) return null;
  const aTokens = new Set(a.split(' '));
  const hit = eTokens.filter((w) => aTokens.has(w)).length / eTokens.length;
  if (hit >= 0.8) return 'correct';
  if (hit >= 0.4) return 'partial';
  return 'wrong';
}
