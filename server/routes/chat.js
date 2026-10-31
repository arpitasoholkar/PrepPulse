// server/routes/chat.js  (Owner: C)
// POST /api/chat           -> memory-aware reply
// POST /api/chat/feedback  -> "I understood" / "I didn't understand"
// B's app.js auto-loads this file and mounts it under /api.

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

import ChatSession from '../models/ChatSession.js';
import { TOPICS } from '../memory/deps.js';
import { generateText, generateJSON } from '../ai/gemini.js';
import { buildMentorSystem, buildMentorPrompt, fallbackReply } from '../ai/prompts/mentor.js';
import { retrieveMemories, detectTopic } from '../memory/retrieve.js';
import { startLadder, nextStep } from '../memory/ladder.js';
import { saveUnderstood } from '../memory/extract.js';

const badRequest = (message) => ({ status: 400, error: { code: 'BAD_REQUEST', message } });

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
      ladder: { topic: null, step: 0, stylesTried: [] },
    });
  }
  return session;
}

// 1) keyword map, 2) ask Gemini, 3) topic from earlier in this session
async function resolveTopic(message, session) {
  const fast = detectTopic(message);
  if (fast) return fast;

  const { data, degraded } = await generateJSON({
    system: 'You classify DSA questions into one topic.',
    prompt: `Student message: "${message}"\nAllowed topics: ${TOPICS.join(', ')}.\nIf none fits, use null.`,
    schema: '{ "topic": "one allowed topic or null" }',
  });
  if (!degraded && data && TOPICS.includes(data.topic)) return data.topic;

  return (session.ladder && session.ladder.topic) || null;
}

async function makeReply({ style, topic, used, question, previousReply }) {
  const { text, degraded } = await generateText({
    system: buildMentorSystem({ style, topic, memories: used }),
    prompt: buildMentorPrompt({ question, previousReply }),
  });
  if (degraded || !text) return { reply: fallbackReply(topic, style), degraded: true };
  return { reply: text, degraded: false };
}

const usedForResponse = (used) =>
  used.map((x) => ({ memory: x.memory, why: x.why, score: x.score }));

// ---------- POST /api/chat ----------
router.post('/chat', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || !message || !String(message).trim()) {
      const e = badRequest('sessionId and message are required');
      return res.status(e.status).json({ error: e.error });
    }

    const session = await getOrCreateSession(req.userId, sessionId);
    const topic = await resolveTopic(message, session);

    // 1. find memories, 2. pick style, 3. generate
    const used = await retrieveMemories({ userId: req.userId, topic, limit: 5 });
    const { ladder, style, reason } = startLadder(topic, used);
    const { reply, degraded } = await makeReply({ style, topic, used, question: message });

    const messageId = newMessageId();
    session.messages.push({ id: 'u_' + messageId, role: 'user', content: message, topic });
    session.messages.push({ id: messageId, role: 'assistant', content: reply, topic, style });
    session.set('ladder', ladder);
    await session.save();

    res.json({
      messageId,
      reply,
      topic,
      explanationStyle: style,
      ladderStep: ladder.step,
      styleReason: reason,
      memoriesUsed: usedForResponse(used),
      memoriesSaved: [],
      degraded,
    });
  } catch (err) {
    next(err);
  }
});

// ---------- POST /api/chat/feedback ----------
router.post('/chat/feedback', async (req, res, next) => {
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
    const userMessage = [...session.messages.slice(0, idx)].reverse().find((m) => m.role === 'user');
    const question = userMessage ? userMessage.content : '';
    const topic = session.ladder.topic || aiMessage.topic || null;

    // ----- understood = true : save memories, no new reply -----
    if (understood) {
      const { saved, updated } = await saveUnderstood({
        userId: req.userId,
        topic,
        style: aiMessage.style,
        question,
        reply: aiMessage.content,
        messageId,
      });

      return res.json({
        messageId,
        reply: '',
        topic,
        explanationStyle: aiMessage.style,
        ladderStep: session.ladder.step,
        styleReason: `Saved: ${aiMessage.style} works for you on ${topic || 'this topic'}`,
        memoriesUsed: [],
        memoriesSaved: saved,
        memoriesUpdated: updated,
        done: true,
        degraded: false,
      });
    }

    // ----- understood = false : next step of the ladder, NEW reply -----
    const used = await retrieveMemories({ userId: req.userId, topic, limit: 5 });
    const { ladder, style, reason } = nextStep(
      { topic: session.ladder.topic, step: session.ladder.step, stylesTried: [...session.ladder.stylesTried] },
      used
    );
    const { reply, degraded } = await makeReply({
      style,
      topic,
      used,
      question,
      previousReply: aiMessage.content,
    });

    const newId = newMessageId();
    session.messages.push({ id: newId, role: 'assistant', content: reply, topic, style });
    session.set('ladder', ladder);
    await session.save();

    res.json({
      messageId: newId,
      reply,
      topic,
      explanationStyle: style,
      ladderStep: ladder.step,
      styleReason: reason,
      memoriesUsed: usedForResponse(used),
      memoriesSaved: [],
      memoriesUpdated: [],
      done: false,
      degraded,
    });
  } catch (err) {
    next(err);
  }
});

export default router;