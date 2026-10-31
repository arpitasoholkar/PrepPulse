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
  fallbackReply,
} from '../ai/prompts/mentor.js';
import { retrieveMemories, detectTopic } from '../memory/retrieve.js';
import { startLadder, nextStep } from '../memory/ladder.js';
import { rankStyles, STYLE_HUMAN_NAMES } from '../memory/styles.js';
import { recordStyleOutcome, saveConceptUnderstood } from '../memory/lifecycle.js';
import { shouldSave, isSmallTalk } from '../memory/gate.js';
import { extractFactsFromChat } from '../memory/extract.js';
import { recordEvent } from '../gamification/service.js';
import { getCurriculum, markTopicLearned, markTopicTeaching, topicLabel } from '../memory/curriculum.js';

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

async function makeReply({ style, topic, used, question, previousReply, avoidStyles = [], history = [] }) {
  const { text, degraded } = await generateText({
    system: buildMentorSystem({
      style,
      topic,
      memories: used,
      avoidStyles,
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
      degraded: true,
    };
  }

  return {
    reply: text,
    degraded: false,
  };
}

const usedForResponse = (used) =>
  (used || []).map((x) => ({
    memory: x.memory,
    why: x.why,
    score: x.score,
  }));

/**
 * Teaches the next unlearned topic as a new assistant message in this session.
 * Returns null only if every topic is already learned (a closing message is saved then).
 */
async function teachNextTopic({ session, userId, justLearned = null }) {
  const { next } = await getCurriculum(userId);

  if (!next) {
    const id = newMessageId();
    const content = `\u{1F389} You've covered all ${TOPICS.length} topics. Pick any topic to revise, or try practice questions to lock it in.`;
    session.messages.push({ id, role: 'assistant', content, topic: justLearned, style: null, degraded: false });
    await session.save();
    return { messageId: id, reply: content, topic: justLearned, explanationStyle: null, completed: true, memoriesUsed: [], stylePlan: [], ladder: session.ladder, degraded: false };
  }

  const { ladder, style, reason, stylePlan } = await startLadder({ userId, topic: next, existingTried: [] });
  const used = await retrieveMemories({ userId, topic: next, limit: 5 });
  const avoidStyles = stylePlan.filter((s) => s.status === 'avoid').map((s) => s.style);

  const { reply, degraded } = await makeReply({
    style: style || 'theory',
    topic: next,
    used,
    question: `Teach me ${topicLabel(next)} from the beginning.`,
    avoidStyles,
    history: [],
  });

  const intro = justLearned
    ? `\u2705 **${topicLabel(justLearned)}** is marked as learned. Next topic: **${topicLabel(next)}**.\n\n`
    : `Let's continue with **${topicLabel(next)}**.\n\n`;

  const id = newMessageId();
  session.messages.push({
    id,
    role: 'assistant',
    content: intro + reply,
    topic: next,
    style: style || 'theory',
    styleReason: reason,
    stylePlan,
    memoriesUsed: usedForResponse(used),
    degraded,
  });
  session.set('ladder', ladder);
  await session.save();

  if (!degraded) await markTopicTeaching({ userId, topic: next });

  return {
    messageId: id,
    reply: intro + reply,
    topic: next,
    explanationStyle: style || 'theory',
    styleReason: reason,
    ladderStep: ladder.step,
    ladder,
    stylePlan,
    memoriesUsed: usedForResponse(used),
    degraded,
  };
}

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

    // Topic done: remember it, then move on to the next topic.
    const finishedLadder = session.ladder;
    let topicCompleted = null;
    let next = null;
    if (targetTopic && targetTopic !== '*') {
      await markTopicLearned({ userId, topic: targetTopic });
      topicCompleted = targetTopic;
      next = await teachNextTopic({ session, userId, justLearned: targetTopic });
    }

    return {
      topicCompleted,
      next,
      messageId,
      reply: '',
      topic: targetTopic,
      explanationStyle: targetStyle,
      ladderStep: finishedLadder?.step || 0,
      styleReason: `Saved: ${targetStyle} works for you on ${targetTopic}`,
      ladder: finishedLadder,
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

      session.messages.push({
        id: newId,
        role: 'assistant',
        content: exhaustedReply,
        topic: targetTopic,
        style: null,
        degraded: false,
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

    const { reply, degraded } = await makeReply({
      style: nextStyle,
      topic: targetTopic,
      used,
      question,
      previousReply: aiMessage.content,
      avoidStyles,
      history: session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
    });

    const newId = newMessageId();

    session.messages.push({
      id: newId,
      role: 'assistant',
      content: reply,
      topic: targetTopic,
      style: nextStyle,
      styleReason: reason,
      stylePlan,
      memoriesUsed: usedForResponse(used),
      degraded,
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

    // 1. Check for typed feedback intent on the previous AI reply
    const lastAssistantMessage = [...session.messages].reverse().find((m) => m.role === 'assistant');
    const hasPreviousAnswer = Boolean(lastAssistantMessage);
    const feedbackIntent = detectFeedbackIntent ? detectFeedbackIntent(message, hasPreviousAnswer) : null;

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

    // 3. Normal question flow
    const topic = await resolveTopic(message, session);

    // Check if continuing previous topic ladder or starting fresh
    let existingTried = [];
    if (session.ladder && session.ladder.topic === topic && session.ladder.tried && session.ladder.tried.length > 0) {
      existingTried = session.ladder.tried;
    }

    const { ladder, style, reason, stylePlan, exhausted } = await startLadder({
      userId: req.userId,
      topic,
      existingTried,
    });

    const used = await retrieveMemories({
      userId: req.userId,
      topic,
      limit: 5,
    });

    const avoidStyles = stylePlan.filter((s) => s.status === 'avoid').map((s) => s.style);

    // Last few messages, so the mentor can answer in context
    const history = session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));

    const { reply, degraded } = await makeReply({
      style: style || 'theory',
      topic,
      used,
      question: message,
      avoidStyles,
      history,
    });

    const messageId = newMessageId();

    if (!session.title) session.title = String(message).trim().slice(0, 60);

    session.messages.push({
      id: 'u_' + messageId,
      role: 'user',
      content: message,
      topic,
    });

    session.messages.push({
      id: messageId,
      role: 'assistant',
      content: reply,
      topic,
      style: style || 'theory',
      styleReason: reason,
      stylePlan,
      memoriesUsed: usedForResponse(used),
      degraded,
    });

    session.set('ladder', ladder);
    await session.save();

    // P1: Extract durable facts from free text if not small talk and not degraded
    let extractedSaved = [];
    let extractedUpdated = [];
    if (!isSmallTalkMessage && !degraded) {
      try {
        const extraction = await extractFactsFromChat({
          userId: req.userId,
          message,
          messageId,
        });
        extractedSaved = extraction.saved || [];
        extractedUpdated = extraction.updated || [];
        if (extraction.skipped && extraction.skipped.length > 0) {
          memoriesSkipped.push(...extraction.skipped);
        }
      } catch (err) {
        // Silently skip LLM extraction failure
      }
    }

    if (!degraded && topic) await markTopicTeaching({ userId: req.userId, topic });

    const gamification = await recordEvent(req.userId, req.tzOffset, { chats: 1 });

    return res.json({
      messageId,
      reply,
      topic,
      explanationStyle: style || 'theory',
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
      { $match: { userId: new mongoose.Types.ObjectId(req.userId) } },
      { $sort: { updatedAt: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          sessionId: 1,
          title: 1,
          updatedAt: 1,
          topic: '$ladder.topic',
          messageCount: { $size: '$messages' },
          firstMessage: { $arrayElemAt: ['$messages.content', 0] },
        },
      },
    ]);
    const sessions = rows
      .filter((r) => r.messageCount > 0)
      .map((r) => ({
        sessionId: r.sessionId,
        title: r.title || String(r.firstMessage || 'Chat').slice(0, 60),
        topic: r.topic || null,
        messageCount: r.messageCount,
        updatedAt: r.updatedAt,
      }));
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/chat/sessions/:sessionId : reopen one chat ----------
router.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const session = await ChatSession.findOne({ userId: req.userId, sessionId: req.params.sessionId }).lean();
    if (!session) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Chat session not found' } });
    }
    res.json({
      sessionId: session.sessionId,
      title: session.title || '',
      messages: session.messages || [],
      ladder: session.ladder || null,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- DELETE /api/chat/sessions/:sessionId ----------
router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    await ChatSession.deleteOne({ userId: req.userId, sessionId: req.params.sessionId });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// ---------- GET /api/chat/curriculum : learning path + next topic ----------
router.get('/curriculum', async (req, res, next) => {
  try {
    res.json(await getCurriculum(req.userId));
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/chat/next : teach the next unlearned topic in this chat ----------
router.post('/next', async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      const e = badRequest('sessionId is required');
      return res.status(e.status).json({ error: e.error });
    }
    const session = await getOrCreateSession(req.userId, sessionId);
    if (!session.title) session.title = 'Learning path';
    const result = await teachNextTopic({ session, userId: req.userId });
    res.json({ next: result, curriculum: await getCurriculum(req.userId) });
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