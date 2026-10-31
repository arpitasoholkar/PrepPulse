// server/routes/chat.js (Owner: C)
// POST /api/chat           -> memory-aware reply (handles typed questions and typed feedback)
// POST /api/chat/feedback  -> button feedback ("I understood" / "I didn't understand")

import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import ChatSession from '../models/ChatSession.js';
import { TOPICS } from '../memory/deps.js';
import { generateText, generateJSON } from '../ai/gemini.js';
import {
  buildMentorSystem,
  buildMentorPrompt,
  buildJudgeSystem,
  buildJudgePrompt,
  JUDGE_SCHEMA,
  fallbackReply,
} from '../ai/prompts/mentor.js';
import { retrieveMemories, detectTopic } from '../memory/retrieve.js';
import { startLadder, nextStep } from '../memory/ladder.js';
import { rankStyles, STYLE_HUMAN_NAMES } from '../memory/styles.js';
import { recordStyleOutcome, saveConceptUnderstood } from '../memory/lifecycle.js';
import { shouldSave, isSmallTalk } from '../memory/gate.js';
import { extractFactsFromChat } from '../memory/extract.js';
import { recordEvent } from '../gamification/service.js';
import {
  normaliseUnderstanding,
  initialLevel,
  applyVerdict,
  applyNotUnderstood,
  rememberQuestion,
  buildAdaptation,
  splitCheck,
  heuristicVerdict,
  VERDICTS,
} from '../memory/understanding.js';
import { recordQuizOutcome } from '../memory/quiz.js';

const HISTORY_SIZE = 12;

// What the UI needs to redraw an assistant reply when an old chat is reopened.
const messageMeta = (r) => ({
  styleReason: r.styleReason || null,
  ladderStep: r.ladderStep ?? 0,
  ladder: r.ladder || null,
  stylePlan: r.stylePlan || [],
  understanding: r.understanding || null,
  judgement: r.judgement || null,
  levelChange: r.levelChange || 0,
  awaitingAnswer: Boolean(r.awaitingAnswer),
});

const makeTitle = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57)}...` : t;
};

// Try loading Person A's intent detector if present, otherwise fallback
let detectFeedbackIntent = null;
try {
  const intentMod = await import('../memory/intent.js');
  detectFeedbackIntent = intentMod.detectFeedbackIntent || intentMod.default;
} catch (e) {
  // Regex fallback until Person A merges intent.js
  detectFeedbackIntent = (message, hasPreviousAnswer) => {
    if (!hasPreviousAnswer) return null;
    const text = (message || '').trim().toLowerCase();
    const words = text.split(/\s+/);
    if (words.length > 12) return null;
    if (/\b(explain|teach me|what is|how does)\b/i.test(text)) return null;

    if (/\b(dont understand|don't understand|dont get it|don't get it|still confused|not clear|confusing|im lost|i'm lost|explain differently|try another way|didnt follow|didn't follow)\b/i.test(text)) {
      return 'not_understood';
    }
    if (/\b(got it|understood|makes sense|clear now|get it now|ok that helps|okay that helps|thats clear|that's clear)\b/i.test(text)) {
      return 'understood';
    }
    return null;
  };
}

const router = express.Router();
router.use(authenticate);

const badRequest = (message) => ({
  status: 400,
  error: { code: 'BAD_REQUEST', message },
});

function newMessageId() {
  return 'm_' + crypto.randomBytes(6).toString('hex');
}

async function getOrCreateSession(userId, sessionId) {
  let session = await ChatSession.findOne({ userId, sessionId });

  if (!session) {
    session = await ChatSession.create({
      userId,
      sessionId,
      messages: [],
      ladder: {
        topic: null,
        step: 0,
        stylesTried: [],
        tried: [],
        exhausted: false,
      },
    });
  }

  return session;
}

// Resolve topic using keywords, Gemini, or previous session topic.
async function resolveTopic(message, session) {
  const fast = detectTopic(message);
  if (fast) return fast;

  const { data, degraded } = await generateJSON({
    system: 'You classify DSA questions into one topic.',
    prompt: `Student message: "${message}"\nAllowed topics: ${TOPICS.join(', ')}.\nIf none fits, use null.`,
    schema: '{ "topic": "one allowed topic or null" }',
  });

  if (!degraded && data && TOPICS.includes(data.topic)) {
    return data.topic;
  }

  return (session.ladder && session.ladder.topic) || null;
}

async function makeReply({ style, topic, used, question, previousReply, avoidStyles = [], history = [], adaptation = '' }) {
  const { text, degraded } = await generateText({
    system: buildMentorSystem({
      style,
      topic,
      memories: used,
      avoidStyles,
      adaptation,
    }),
    prompt: buildMentorPrompt({
      question,
      previousReply,
      history,
    }),
  });

  if (degraded || !text) {
    return {
      reply: fallbackReply(topic, style),
      check: null,
      degraded: true,
    };
  }

  // The model ends with a hidden [[CHECK]] block: strip it, keep the question + expected answer.
  const { reply, check } = splitCheck(text);

  return {
    reply: reply || text,
    check,
    degraded: false,
  };
}

// Per-topic understanding profile for this session (starts from what memory already knows).
const topicKey = (topic) => topic || 'general';

function getUnderstanding(session, topic, used = []) {
  const raw = session.understanding && session.understanding[topicKey(topic)];
  return normaliseUnderstanding(raw, initialLevel(used));
}

function saveUnderstanding(session, topic, state) {
  session.set('understanding', { ...(session.understanding || {}), [topicKey(topic)]: state });
}

const understandingForResponse = (u) =>
  u && {
    level: u.level,
    streakRight: u.streakRight,
    streakWrong: u.streakWrong,
    answered: u.answered,
    correct: u.correct,
    lastVerdict: u.lastVerdict,
    weakConcepts: u.weakConcepts,
    strongConcepts: u.strongConcepts,
  };

const setPending = (session, check, topic, messageId) =>
  session.set(
    'pending',
    check ? { question: check.question, answer: check.answer, concept: check.concept, topic, messageId, askedAt: new Date() } : null
  );

// A short reply while a check question is open is usually the answer ("B", "5", "1 2 4 3").
const looksLikeAnswer = (message) => /\d|[\[\]{}()=<>]/.test(message);

// "Explain BFS", "what is a heap?" are obviously new questions: no need to grade them as answers.
const isClearlyNewQuestion = (message) =>
  message.trim().split(/\s+/).length >= 3 &&
  !looksLikeAnswer(message) &&
  /^(explain|teach|what is|what are|whats|what's|how (does|do|to)|tell me|show me|compare|difference|can you|could you)\b/i.test(message.trim());

/**
 * Grades the student's message against the open check question.
 * Returns { isAnswer, verdict, whatRight, whatMissing, misconception, concept, degraded }.
 */
async function judgeAnswer(pending, message) {
  const { data, degraded } = await generateJSON({
    system: buildJudgeSystem(),
    prompt: buildJudgePrompt({ question: pending.question, expected: pending.answer, studentReply: message }),
    schema: JUDGE_SCHEMA,
  });

  if (!degraded && data && VERDICTS.includes(data.verdict)) {
    return {
      isAnswer: data.isAnswer !== false,
      verdict: data.verdict,
      whatRight: String(data.whatRight || ''),
      whatMissing: String(data.whatMissing || ''),
      misconception: String(data.misconception || ''),
      concept: String(data.concept || pending.concept || '').trim().toLowerCase() || null,
      degraded: false,
    };
  }

  // AI down: fall back to a simple text comparison so the lesson can still continue.
  const verdict = heuristicVerdict(message, pending.answer);
  return {
    isAnswer: Boolean(verdict),
    verdict,
    whatRight: '',
    whatMissing: '',
    misconception: '',
    concept: pending.concept || null,
    degraded: true,
  };
}

const usedForResponse = (used) =>
  (used || []).map((x) => ({
    memory: x.memory,
    why: x.why,
    score: x.score,
  }));

/**
 * Shared helper for applying feedback (both button click & typed text)
 */
async function applyFeedback({ session, aiMessage, understood, userId, reqTzOffset, typedMessage = null }) {
  const targetTopic = session.ladder?.topic || aiMessage.topic || '*';
  const targetStyle = aiMessage.style || aiMessage.explanationStyle || 'theory';
  const messageId = aiMessage.id;

  // 1. Idempotency Check
  if (aiMessage.feedback) {
    // Already recorded earlier! Return earlier result, write nothing.
    const ranking = await rankStyles({
      userId,
      topic: targetTopic,
      tried: (session.ladder?.tried || []).map((t) => t.style),
    });

    return {
      messageId,
      reply: '',
      topic: targetTopic,
      explanationStyle: targetStyle,
      ladder: session.ladder,
      stylePlan: ranking.stylePlan,
      memoriesUsed: [],
      memoriesSaved: [],
      memoriesUpdated: [],
      memoriesSkipped: [{ text: messageId, reason: 'already recorded' }],
      alreadyRecorded: true,
      feedbackApplied: understood ? 'understood' : 'not_understood',
      done: true,
      degraded: false,
    };
  }

  // 2. Degraded Guard: if AI reply was a fallback, skip writing!
  if (aiMessage.degraded) {
    aiMessage.feedback = understood ? 'understood' : 'not_understood';
    await session.save();

    const ranking = await rankStyles({
      userId,
      topic: targetTopic,
      tried: (session.ladder?.tried || []).map((t) => t.style),
    });

    return {
      messageId,
      reply: '',
      topic: targetTopic,
      explanationStyle: targetStyle,
      ladder: session.ladder,
      stylePlan: ranking.stylePlan,
      memoriesUsed: [],
      memoriesSaved: [],
      memoriesUpdated: [],
      memoriesSkipped: [{ reason: 'AI reply was a fallback' }],
      alreadyRecorded: false,
      feedbackApplied: understood ? 'understood' : 'not_understood',
      done: true,
      degraded: true,
    };
  }

  // Mark feedback on assistant message
  aiMessage.feedback = understood ? 'understood' : 'not_understood';

  // Find user question for evidence
  const idx = session.messages.findIndex((m) => m.id === messageId);
  const userMessage = [...session.messages.slice(0, idx)]
    .reverse()
    .find((m) => m.role === 'user');
  const question = userMessage ? userMessage.content : '';

  if (understood) {
    // Understood: record worked style outcome
    const evidenceText = `Said understood after ${targetStyle} explanation of: "${(question || '').slice(0, 80)}"`;
    const styleOutcome = await recordStyleOutcome({
      userId,
      topic: targetTopic,
      style: targetStyle,
      outcome: 'worked',
      evidenceText,
      refId: messageId,
      degraded: aiMessage.degraded,
      alreadyRecorded: false,
    });

    // Also record concept_understood if valid topic
    let conceptSaved = [];
    let conceptUpdated = [];
    if (targetTopic && targetTopic !== '*') {
      const c = await saveConceptUnderstood({
        userId,
        topic: targetTopic,
        style: targetStyle,
        evidenceText,
        refId: messageId,
      });
      conceptSaved = c.saved;
      conceptUpdated = c.updated;
    }

    // Update ladder tried outcome
    const ladderTried = session.ladder?.tried || [];
    const lastItem = ladderTried.find((t) => t.style === targetStyle) || ladderTried[ladderTried.length - 1];
    if (lastItem) {
      lastItem.outcome = 'worked';
    }

    await session.save();

    const ranking = await rankStyles({
      userId,
      topic: targetTopic,
      tried: (session.ladder?.tried || []).map((t) => t.style),
    });

    return {
      messageId,
      reply: '',
      topic: targetTopic,
      explanationStyle: targetStyle,
      ladderStep: session.ladder?.step || 0,
      styleReason: `Saved: ${targetStyle} works for you on ${targetTopic}`,
      ladder: session.ladder,
      stylePlan: ranking.stylePlan,
      memoriesUsed: [],
      memoriesSaved: [...styleOutcome.saved, ...conceptSaved],
      memoriesUpdated: [...styleOutcome.updated, ...conceptUpdated],
      memoriesSkipped: styleOutcome.skipped,
      alreadyRecorded: false,
      feedbackApplied: 'understood',
      done: true,
      degraded: false,
    };
  } else {
    // Not understood: record failed style outcome
    const evidenceText = `Said did not understand after ${targetStyle} explanation of: "${(question || '').slice(0, 80)}"`;
    const styleOutcome = await recordStyleOutcome({
      userId,
      topic: targetTopic,
      style: targetStyle,
      outcome: 'failed',
      evidenceText,
      refId: messageId,
      degraded: aiMessage.degraded,
      alreadyRecorded: false,
    });

    // The student is struggling: drop the level so the next explanation is simpler.
    const stepDown = applyNotUnderstood(getUnderstanding(session, targetTopic));
    saveUnderstanding(session, targetTopic, stepDown.state);

    // Advance ladder to next best style
    const { ladder, style: nextStyle, reason, stylePlan, exhausted } = await nextStep({
      userId,
      ladder: session.ladder,
    });

    session.set('ladder', ladder);

    if (exhausted || !nextStyle) {
      ladder.exhausted = true;
      const exhaustedReply = `We've tried several explanation styles for **${targetTopic}**. Which exact part or line is confusing? You can also try a practice problem to test your understanding hands-on!`;
      const newId = newMessageId();
      session.set('pending', null);

      session.messages.push({
        id: newId,
        role: 'assistant',
        content: exhaustedReply,
        topic: targetTopic,
        style: null,
        degraded: false,
        meta: messageMeta({ styleReason: 'Ladder exhausted', ladder, stylePlan, understanding: understandingForResponse(stepDown.state) }),
      });

      await session.save();

      return {
        messageId: newId,
        reply: exhaustedReply,
        topic: targetTopic,
        explanationStyle: null,
        ladderStep: ladder.step,
        styleReason: 'Ladder exhausted',
        ladder,
        stylePlan,
        memoriesUsed: [],
        memoriesSaved: styleOutcome.saved,
        memoriesUpdated: styleOutcome.updated,
        memoriesSkipped: styleOutcome.skipped,
        alreadyRecorded: false,
        feedbackApplied: 'not_understood',
        done: false,
        degraded: false,
      };
    }

    // Retrieve memories for next explanation
    const used = await retrieveMemories({
      userId,
      topic: targetTopic,
      limit: 5,
    });

    const avoidStyles = stylePlan.filter((s) => s.status === 'avoid').map((s) => s.style);

    const { reply, check, degraded } = await makeReply({
      style: nextStyle,
      topic: targetTopic,
      used,
      question,
      previousReply: aiMessage.content,
      avoidStyles,
      history: session.messages.slice(-HISTORY_SIZE).map((m) => ({ role: m.role, content: m.content })),
      adaptation: buildAdaptation({ state: stepDown.state, levelChange: stepDown.levelChange }),
    });

    const newId = newMessageId();
    setPending(session, check, targetTopic, newId);

    session.messages.push({
      id: newId,
      role: 'assistant',
      content: reply,
      topic: targetTopic,
      style: nextStyle,
      degraded,
      memoriesUsed: usedForResponse(used),
      meta: messageMeta({
        styleReason: reason,
        ladderStep: ladder.step,
        ladder,
        stylePlan,
        understanding: understandingForResponse(stepDown.state),
        levelChange: stepDown.levelChange,
        awaitingAnswer: Boolean(check),
      }),
    });

    await session.save();

    return {
      messageId: newId,
      reply,
      topic: targetTopic,
      explanationStyle: nextStyle,
      ladderStep: ladder.step,
      styleReason: reason,
      ladder,
      stylePlan,
      memoriesUsed: usedForResponse(used),
      memoriesSaved: styleOutcome.saved,
      memoriesUpdated: styleOutcome.updated,
      memoriesSkipped: styleOutcome.skipped,
      alreadyRecorded: false,
      feedbackApplied: 'not_understood',
      understanding: understandingForResponse(stepDown.state),
      levelChange: stepDown.levelChange,
      done: false,
      degraded,
    };
  }
}

// ---------- POST /api/chat ----------
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body || {};

    if (!sessionId || !message || !String(message).trim()) {
      const e = badRequest('sessionId and message are required');
      return res.status(e.status).json({ error: e.error });
    }

    const session = await getOrCreateSession(req.userId, sessionId);

    // 1. Check for typed feedback intent on the previous AI reply.
    // While a check question is open, an answer like "it is 5" must not be mistaken for "I understand".
    const lastAssistantMessage = [...session.messages].reverse().find((m) => m.role === 'assistant');
    const hasPreviousAnswer = Boolean(lastAssistantMessage);
    let feedbackIntent = detectFeedbackIntent ? detectFeedbackIntent(message, hasPreviousAnswer) : null;
    if (feedbackIntent === 'understood' && session.pending && looksLikeAnswer(message)) {
      feedbackIntent = null;
    }

    if (feedbackIntent && lastAssistantMessage) {
      // Record the user's typed feedback message in session
      session.messages.push({
        id: 'u_' + newMessageId(),
        role: 'user',
        content: message,
        topic: lastAssistantMessage.topic,
      });

      const result = await applyFeedback({
        session,
        aiMessage: lastAssistantMessage,
        understood: feedbackIntent === 'understood',
        userId: req.userId,
        reqTzOffset: req.tzOffset,
        typedMessage: message,
      });

      // Also record gamification if chats event
      const gamification = await recordEvent(req.userId, req.tzOffset, { chats: 1 });
      result.newBadges = gamification.newBadges;
      result.streak = gamification.streak;

      return res.json(result);
    }

    // 2. Check for small talk gate check
    const isSmallTalkMessage = isSmallTalk(message);
    const memoriesSkipped = [];
    if (isSmallTalkMessage) {
      memoriesSkipped.push({ text: message, reason: 'small talk' });
    }

    // 3. Is this the student's answer to the check question the mentor asked last?
    let judged = null;
    const pending = session.pending && session.pending.question ? session.pending : null;
    if (pending && !isSmallTalkMessage && !isClearlyNewQuestion(message)) {
      judged = await judgeAnswer(pending, message);
      if (!judged.isAnswer || !judged.verdict) judged = null; // a new question, not an answer
    }
    const isAnswer = Boolean(judged);

    // An answer ("B", "5") carries no topic of its own, so it stays on the question's topic.
    const topic = isAnswer && pending.topic ? pending.topic : await resolveTopic(message, session);

    const used = await retrieveMemories({
      userId: req.userId,
      topic,
      limit: 5,
    });

    // 4. Update what we know about how well the student understands this topic.
    let state = getUnderstanding(session, topic, used);
    let levelChange = 0;
    let quizMemories = { saved: [], updated: [], skipped: [] };

    if (isAnswer) {
      const out = applyVerdict(state, judged.verdict, { concept: judged.concept });
      state = out.state;
      levelChange = out.levelChange;

      // Saved even when the AI grader was down (the offline text comparison still gave a verdict).
      try {
        quizMemories = await recordQuizOutcome({
          userId: req.userId,
          topic,
          verdict: judged.verdict,
          concept: judged.concept,
          question: pending.question,
          refId: pending.messageId,
          offline: judged.degraded,
        });
      } catch (err) {
        // never block the lesson, but do not hide the failure either
        console.error('[memory] could not save quiz outcome:', err.message);
        quizMemories.skipped.push({ text: pending.question, reason: `could not save: ${err.message}` });
      }
    } else {
      state = rememberQuestion(state, message);
    }
    saveUnderstanding(session, topic, state);

    // 5. Pick the explanation style.
    let ladder;
    let style;
    let reason;
    let stylePlan;

    if (isAnswer) {
      // Keep teaching with the same style; after a wrong answer switch to a plain worked example.
      const current = JSON.parse(JSON.stringify(session.ladder || { tried: [] }));
      const triedStyles = (current.tried || []).map((t) => t.style);
      const lastStyle = triedStyles[triedStyles.length - 1] || 'theory';
      style = judged.verdict === 'wrong' ? (lastStyle === 'example' ? 'simple' : 'example') : lastStyle;
      const ranking = await rankStyles({ userId: req.userId, topic, tried: triedStyles });
      ladder = { ...current, topic };
      stylePlan = ranking.stylePlan;
      reason = `Your answer was ${judged.verdict}, so I'm ${
        judged.verdict === 'wrong' ? 'going simpler' : judged.verdict === 'correct' ? 'going a step deeper' : 'filling the gap'
      } (${state.level} level)`;
    } else {
      // Check if continuing previous topic ladder or starting fresh
      let existingTried = [];
      if (session.ladder && session.ladder.topic === topic && session.ladder.tried && session.ladder.tried.length > 0) {
        existingTried = session.ladder.tried;
      }
      const started = await startLadder({ userId: req.userId, topic, existingTried });
      ladder = started.ladder;
      style = started.style || 'theory';
      reason = started.reason;
      stylePlan = started.stylePlan;
    }

    const avoidStyles = stylePlan.filter((s) => s.status === 'avoid').map((s) => s.style);

    // Recent conversation, so the mentor answers in context
    const history = session.messages.slice(-HISTORY_SIZE).map((m) => ({ role: m.role, content: m.content }));

    const { reply, check, degraded } = await makeReply({
      style,
      topic,
      used,
      question: message,
      avoidStyles,
      history,
      adaptation: buildAdaptation({ state, judged, levelChange }),
    });

    const messageId = newMessageId();

    session.messages.push({
      id: 'u_' + messageId,
      role: 'user',
      content: message,
      topic,
    });

    const assistantMsg = {
      id: messageId,
      role: 'assistant',
      content: reply,
      topic,
      style,
      degraded,
      memoriesUsed: usedForResponse(used),
      meta: messageMeta({
        styleReason: reason,
        ladderStep: ladder.step,
        ladder,
        stylePlan,
        understanding: understandingForResponse(state),
        judgement: judged
          ? { verdict: judged.verdict, whatRight: judged.whatRight, whatMissing: judged.whatMissing }
          : null,
        levelChange,
        awaitingAnswer: Boolean(check),
      }),
    };
    session.messages.push(assistantMsg);
    if (!session.title) session.title = makeTitle(message);

    // Remember the new check question so the next message is graded against it.
    setPending(session, check, topic, messageId);
    session.set('ladder', ladder);
    await session.save();

    // P1: Extract durable facts from free text if not small talk, not an answer and not degraded
    let extractedSaved = [...quizMemories.saved];
    let extractedUpdated = [...quizMemories.updated];
    memoriesSkipped.push(...quizMemories.skipped);
    if (!isSmallTalkMessage && !isAnswer && !degraded) {
      try {
        const extraction = await extractFactsFromChat({
          userId: req.userId,
          message,
          messageId,
        });
        extractedSaved = [...extractedSaved, ...(extraction.saved || [])];
        extractedUpdated = [...extractedUpdated, ...(extraction.updated || [])];
        if (extraction.skipped && extraction.skipped.length > 0) {
          memoriesSkipped.push(...extraction.skipped);
        }
      } catch (err) {
        // Silently skip LLM extraction failure
      }
    }

    const gamification = await recordEvent(req.userId, req.tzOffset, { chats: 1 });

    return res.json({
      messageId,
      reply,
      topic,
      explanationStyle: style,
      ladderStep: ladder.step,
      styleReason: reason,
      ladder,
      stylePlan,
      feedbackApplied: null,
      alreadyRecorded: false,
      memoriesUsed: usedForResponse(used),
      memoriesSaved: extractedSaved,
      memoriesUpdated: extractedUpdated,
      memoriesSkipped,
      understanding: understandingForResponse(state),
      judgement: judged
        ? { verdict: judged.verdict, whatRight: judged.whatRight, whatMissing: judged.whatMissing }
        : null,
      levelChange,
      awaitingAnswer: Boolean(check),
      degraded,
      newBadges: gamification.newBadges,
      streak: gamification.streak,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/chat/sessions : chat history list ----------
router.get('/sessions', async (req, res, next) => {
  try {
    const rows = await ChatSession.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.userId), 'messages.0': { $exists: true } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          sessionId: 1,
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          topic: '$ladder.topic',
          messageCount: { $size: '$messages' },
          firstMessage: { $arrayElemAt: ['$messages.content', 0] },
          lastMessage: { $arrayElemAt: ['$messages.content', -1] },
        },
      },
    ]);

    res.json({
      sessions: rows.map((r) => ({
        sessionId: r.sessionId,
        title: r.title || makeTitle(r.firstMessage) || 'Untitled chat',
        topic: r.topic || null,
        messageCount: r.messageCount,
        preview: makeTitle(r.lastMessage).slice(0, 90),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/chat/sessions/:sessionId : one full chat, to reopen it ----------
router.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ userId: req.userId, sessionId: req.params.sessionId });
    if (!session) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chat not found' } });
    }
    const plainSession = session.toObject ? session.toObject() : session;

    res.json({
      sessionId: plainSession.sessionId,
      title: plainSession.title || makeTitle(plainSession.messages?.[0]?.content) || 'Untitled chat',
      topic: plainSession.ladder?.topic || null,
      ladder: plainSession.ladder || null,
      understanding: plainSession.understanding || {},
      awaitingAnswer: Boolean(plainSession.pending && plainSession.pending.question),
      updatedAt: plainSession.updatedAt,
      messages: (plainSession.messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        topic: m.topic || null,
        style: m.style || null,
        degraded: Boolean(m.degraded),
        feedback: m.feedback || null,
        memoriesUsed: m.memoriesUsed || [],
        meta: m.meta || null,
        timestamp: m.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- DELETE /api/chat/sessions/:sessionId ----------
router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const out = await ChatSession.deleteOne({ userId: req.userId, sessionId: req.params.sessionId });
    res.json({ deleted: out.deletedCount || 0 });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/chat/feedback ----------
router.post('/feedback', async (req, res, next) => {
  try {
    const { sessionId, messageId, understood } = req.body || {};

    if (!sessionId || !messageId || typeof understood !== 'boolean') {
      const e = badRequest('sessionId, messageId and understood (true/false) are required');
      return res.status(e.status).json({ error: e.error });
    }

    const session = await ChatSession.findOne({ userId: req.userId, sessionId });
    if (!session) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chat session not found' } });
    }

    const idx = session.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    }

    const aiMessage = session.messages[idx];

    const result = await applyFeedback({
      session,
      aiMessage,
      understood,
      userId: req.userId,
      reqTzOffset: req.tzOffset,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;