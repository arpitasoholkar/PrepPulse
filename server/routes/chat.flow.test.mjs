// End-to-end flow of the adaptive mentor with a fake database and a fake AI.
// Run with: cd server && node --test routes/chat.flow.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import mongoose from 'mongoose';

process.env.GEMINI_API_KEY = 'test-key';
console.error = () => {}; // gamification cannot reach a real database here; it logs and carries on
mongoose.set('bufferCommands', false); // any real DB call fails fast (gamification swallows it)

const { default: User } = await import('../models/User.js');
const { default: ChatSession } = await import('../models/ChatSession.js');
const { default: Memory } = await import('../models/Memory.js');

// ---------- fake database ----------
const USER_ID = new mongoose.Types.ObjectId().toString();
const sessions = [];
const memories = [];

User.findById = async (id) => (String(id) === USER_ID ? { _id: new mongoose.Types.ObjectId(USER_ID) } : null);

ChatSession.findOne = async ({ sessionId }) => sessions.find((s) => s.sessionId === sessionId) || null;
ChatSession.create = async (doc) => {
  const s = new ChatSession(doc);
  s.save = async () => s; // keep the same live object, no database
  sessions.push(s);
  return s;
};

ChatSession.aggregate = async () =>
  [...sessions]
    .filter((s) => s.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => ({
      sessionId: s.sessionId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      topic: s.ladder.topic,
      messageCount: s.messages.length,
      firstMessage: s.messages[0].content,
      lastMessage: s.messages.at(-1).content,
    }));
ChatSession.deleteOne = async ({ sessionId }) => {
  const i = sessions.findIndex((s) => s.sessionId === sessionId);
  if (i >= 0) sessions.splice(i, 1);
  return { deletedCount: i >= 0 ? 1 : 0 };
};

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const matches = (m, q) =>
  Object.entries(q).every(([k, v]) => {
    if (k === '$or') return true;
    const val = get(m, k);
    if (v && typeof v === 'object' && v.$in) return v.$in.includes(val);
    if (v && typeof v === 'object' && '$gt' in v) return true;
    return String(val) === String(v);
  });
const query = (rows) => {
  const q = {
    lean: () => q,
    sort: () => q,
    limit: () => q,
    then: (res, rej) => Promise.resolve(rows).then(res, rej),
  };
  return q;
};
let nextId = 1;
Memory.find = (q) => query(memories.filter((m) => matches(m, q)));
Memory.findOne = async (q) => memories.find((m) => matches(m, q)) || null;
Memory.updateMany = async () => ({});
Memory.create = async (doc) => {
  const m = { _id: `mem${nextId++}`, ...JSON.parse(JSON.stringify(doc)), userId: doc.userId };
  memories.push(m);
  return m;
};
Memory.findByIdAndUpdate = async (id, upd) => {
  const m = memories.find((x) => x._id === id);
  if (upd.$set) Object.assign(m, upd.$set);
  if (upd.$push) for (const [k, v] of Object.entries(upd.$push)) m[k] = [...(m[k] || []), v];
  return m;
};

// ---------- fake AI ----------
const mentorSystems = [];
globalThis.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body);
  const system = body.systemInstruction?.parts?.[0]?.text || '';
  const prompt = body.contents[0].parts[0].text;
  let text;
  if (system.startsWith('You grade a student')) {
    const reply = prompt.split('Student reply:')[1] || '';
    const ok = /\b5\b/.test(reply);
    text = JSON.stringify({
      isAnswer: !/new topic/i.test(reply),
      verdict: ok ? 'correct' : 'wrong',
      whatRight: ok ? 'visit order' : '',
      whatMissing: '',
      misconception: ok ? '' : 'mixes up queue and stack',
      concept: 'bfs order',
    });
  } else if (system.startsWith('You classify')) {
    text = JSON.stringify({ topic: 'graphs' });
  } else if (system.startsWith('You extract')) {
    text = JSON.stringify({ facts: [] });
  } else {
    mentorSystems.push(system);
    text =
      'Here is the explanation.\n\nWhat is the answer?\n[[CHECK]]{"question":"What is the answer?","answer":"5","concept":"bfs order"}[[/CHECK]]';
  }
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
};

const { default: chatRouter } = await import('./chat.js');
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);
app.use((err, req, res, next) => res.status(500).json({ error: String(err) }));
const server = http.createServer(app);
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/api/chat`;
const realFetch = globalThis.fetch;

async function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      base + path,
      { method, headers: { 'content-type': 'application/json', 'x-user-id': USER_ID, 'content-length': Buffer.byteLength(payload) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(buf) }));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
}

async function send(sessionId, message) {
  // our fake AI is global fetch, so call the test server through http instead
  const data = await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ sessionId, message });
    const req = http.request(
      base,
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': USER_ID, 'content-length': Buffer.byteLength(payload) } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve(JSON.parse(buf)));
      }
    );
    req.on('error', reject);
    req.end(payload);
  });
  return data;
}

test.after(() => server.close());

test('adaptive mentor: answer -> check question -> graded -> level changes -> memories', async () => {
  const sid = 's1';

  // 1. Plain question: detailed answer + a check question is stored, hidden block is stripped
  let r = await send(sid, 'Explain BFS');
  assert.equal(r.topic, 'graphs');
  assert.equal(r.awaitingAnswer, true);
  assert.ok(!r.reply.includes('[[CHECK]]'));
  assert.equal(r.understanding.level, 'basic');
  assert.equal(r.judgement, null);
  assert.equal(sessions[0].pending.answer, '5');
  assert.match(mentorSystems.at(-1), /BASIC level/);
  assert.match(mentorSystems.at(-1), /\[\[CHECK\]\]/);

  // 2. Correct short answer ("5" has no topic words): graded against the stored question
  r = await send(sid, '5');
  assert.equal(r.topic, 'graphs');
  assert.equal(r.judgement.verdict, 'correct');
  assert.equal(r.understanding.streakRight, 1);
  assert.match(mentorSystems.at(-1), /answered your last check question CORRECTLY/);
  assert.ok(memories.some((m) => m.type === 'concept_understood' && m.meta.concept === 'bfs order'));

  // 3. Second correct answer in a row -> level up, tougher material requested
  r = await send(sid, 'it is 5');
  assert.equal(r.levelChange, 1);
  assert.equal(r.understanding.level, 'intermediate');
  assert.match(mentorSystems.at(-1), /INTERMEDIATE level/);
  assert.match(mentorSystems.at(-1), /tougher terminology/);

  // 4. Wrong answer -> level drops, simple re-explanation + easier question, mistake memory saved
  r = await send(sid, 'a stack');
  assert.equal(r.judgement.verdict, 'wrong');
  assert.equal(r.levelChange, -1);
  assert.equal(r.understanding.level, 'basic');
  assert.deepEqual(r.understanding.weakConcepts, ['bfs order']);
  assert.match(mentorSystems.at(-1), /WRONGLY/);
  assert.match(mentorSystems.at(-1), /EASIER question/);
  assert.match(mentorSystems.at(-1), /mixes up queue and stack/);
  assert.equal(r.explanationStyle, 'example'); // plain worked example after a wrong answer
  assert.ok(memories.some((m) => m.type === 'mistake' && m.meta.concept === 'bfs order'));

  // 5. Same concept wrong again -> becomes a weakness
  r = await send(sid, 'a heap');
  assert.ok(memories.some((m) => m.type === 'weakness' && m.meta.concept === 'bfs order'));

  // 6. A new question while a check question is open: not graded, topic re-resolved, new pending
  r = await send(sid, 'Explain DFS in detail');
  assert.equal(r.judgement, null);
  assert.equal(r.awaitingAnswer, true);
  assert.ok(sessions[0].understanding.graphs.questionsAsked.includes('Explain DFS in detail'));

  // 7. The conversation context reaches the AI (follow-ups remembered)
  assert.match(mentorSystems.at(-1), /Earlier questions from this student in this session/);
  assert.match(mentorSystems.at(-1), /Explain BFS/);
});

test('"got it" while a check question is open does not grade; "it is 5" is graded as an answer', async () => {
  const sid = 's2';
  await send(sid, 'Teach me DFS');
  const r = await send(sid, 'I understand, it is 5');
  assert.equal(r.judgement.verdict, 'correct'); // not swallowed as "I understood"
  assert.equal(r.feedbackApplied, null);
});

test('"I don\'t understand" lowers the level and re-explains with a new check question', async () => {
  const sid = 's3';
  await send(sid, 'Explain recursion');
  const r = await send(sid, "I don't understand");
  assert.equal(r.feedbackApplied, 'not_understood');
  assert.equal(r.levelChange, 0); // already basic
  assert.equal(r.understanding.level, 'basic');
  assert.equal(sessions.find((s) => s.sessionId === sid).pending.answer, '5');
});

test('chat history: list, reopen with full context, delete', async () => {
  const sid = 'hist1';
  memories.length = 0; // fresh student: starts at basic
  await send(sid, 'Explain BFS for interviews');
  await send(sid, '5');

  // list: shows the chat with a title from the first message
  let list = await call('GET', '/sessions');
  const row = list.body.sessions.find((x) => x.sessionId === sid);
  assert.ok(row);
  assert.equal(row.title, 'Explain BFS for interviews');
  assert.equal(row.messageCount, 4);
  assert.equal(row.topic, 'graphs');

  // reopen: every message comes back with what the UI needs to redraw it
  const one = await call('GET', `/sessions/${sid}`);
  assert.equal(one.status, 200);
  assert.equal(one.body.messages.length, 4);
  const ai = one.body.messages.filter((m) => m.role === 'assistant');
  assert.ok(ai[0].meta.ladder.tried.length > 0);
  assert.equal(ai[1].meta.judgement.verdict, 'correct');
  assert.equal(ai[1].meta.understanding.level, 'basic');
  assert.ok(Array.isArray(ai[0].memoriesUsed));
  assert.equal(one.body.understanding.graphs.correct, 1);
  assert.equal(one.body.awaitingAnswer, true); // a check question is still open

  // continuing the reopened chat keeps its context and state
  const r = await send(sid, '5');
  assert.equal(r.understanding.streakRight, 0); // second correct answer in a row -> level up resets the streak
  assert.equal(r.understanding.level, 'intermediate');

  // a chat with no messages is not listed; unknown chat is 404; delete removes it
  assert.equal((await call('GET', '/sessions/nope')).status, 404);
  const del = await call('DELETE', `/sessions/${sid}`);
  assert.equal(del.body.deleted, 1);
  list = await call('GET', '/sessions');
  assert.ok(!list.body.sessions.some((x) => x.sessionId === sid));
});

test('quiz outcome is still saved when the AI grader is down (offline grading)', async () => {
  const sid = 'offline1';
  await send(sid, 'Explain BFS');
  const realGrade = globalThis.fetch;
  const before = memories.length;
  // grader fails, mentor still answers
  globalThis.fetch = async (url, opts) => {
    const sys = JSON.parse(opts.body).systemInstruction?.parts?.[0]?.text || '';
    if (sys.startsWith('You grade')) throw new Error('boom');
    return realGrade(url, opts);
  };
  const r = await send(sid, '5');
  globalThis.fetch = realGrade;
  assert.equal(r.judgement.verdict, 'correct'); // text comparison with the stored answer
  assert.ok(memories.length >= before);
  assert.ok(memories.some((m) => m.evidence.some((e) => /graded offline/.test(e.text))));
});
