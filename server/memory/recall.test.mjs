// Run with: cd server && npm test
// No database or network needed: Memory is stubbed and the Atlas call is faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stabilityDays, retention, rrfScores, fuseRankings, memoryText, BASE_STABILITY_DAYS,
} from './recall.js';
import { Memory } from './deps.js';
import { retrieveMemories } from './retrieve.js';
import { _setSearchImpl, semanticHits, recallStatus } from './vectorIndex.js';
import { _resetEmbedState, embedStatus } from './embed.js';

const DAY = 24 * 3600 * 1000;
const ago = (d) => new Date(Date.now() - d * DAY);
let n = 0;
const mem = (o) => ({
  _id: `m${++n}`, userId: 'u1', type: 'weakness', topic: 'recursion', content: 'x',
  confidence: 0.7, status: 'active', evidence: [{ text: 'e' }], useCount: 0,
  lastVerified: new Date(), createdAt: new Date(), ...o,
});

// ---------- forgetting curve ----------
test('retention is ~1 for a fresh memory and decays monotonically', () => {
  const m = mem({});
  const r0 = retention(m, Date.now());
  const r10 = retention(m, Date.now() + 10 * DAY);
  const r60 = retention(m, Date.now() + 60 * DAY);
  assert.ok(r0 > 0.999);
  assert.ok(r0 > r10 && r10 > r60 && r60 >= 0);
});

test('retention is 1/e after exactly one stability period', () => {
  const m = mem({ lastVerified: ago(0) });
  const s = stabilityDays(m);
  const r = retention(m, Date.now() + s * DAY);
  assert.ok(Math.abs(r - Math.exp(-1)) < 1e-6);
});

test('more evidence, more use and manual correction all make a memory last longer', () => {
  const base = stabilityDays(mem({ evidence: [{ text: 'a' }] }));
  assert.ok(stabilityDays(mem({ evidence: [1, 2, 3, 4, 5].map((i) => ({ text: String(i) })) })) > base);
  assert.ok(stabilityDays(mem({ useCount: 20 })) > stabilityDays(mem({ useCount: 0 })));
  assert.ok(stabilityDays(mem({ status: 'corrected' })) > 2.9 * base);
});

test('usage boost is capped (no runaway rich-get-richer)', () => {
  const a = stabilityDays(mem({ useCount: 1e6 }));
  const b = stabilityDays(mem({ useCount: 1e9 }));
  assert.equal(a, b);
  assert.ok(a <= 2 * BASE_STABILITY_DAYS.weakness * (1 + 0.5 * Math.log(2)) + 1e-9);
});

test('short-lived types fade faster than stable ones', () => {
  const when = Date.now() + 14 * DAY;
  assert.ok(retention(mem({ type: 'revision_needed' }), when) < retention(mem({ type: 'learning_preference' }), when));
});

test('bad or missing dates never produce NaN', () => {
  assert.equal(retention({ type: 'weakness' }), 0);
  assert.equal(retention({ type: 'weakness', lastVerified: 'not a date' }), 0);
  assert.equal(retention({}), 0);
  assert.ok(Number.isFinite(stabilityDays({})));
});

// ---------- RRF ----------
test('RRF matches the textbook formula', () => {
  const s = rrfScores([['a', 'b', 'c'], ['b', 'a']], { k: 60 });
  assert.ok(Math.abs(s.get('a') - (1 / 61 + 1 / 62)) < 1e-12);
  assert.ok(Math.abs(s.get('b') - (1 / 62 + 1 / 61)) < 1e-12);
  assert.ok(Math.abs(s.get('c') - 1 / 63) < 1e-12);
});

test('fuseRankings with no semantic hits returns the very same array', () => {
  const structured = [mem({}), mem({}), mem({})].map((m, i) => ({ memory: m, score: 5 - i, why: 'w' }));
  assert.equal(fuseRankings({ structured, semantic: [] }), structured);
  assert.equal(fuseRankings({ structured, semantic: [{ id: 'nope', sim: 0.9 }] }), structured);
});

test('semantic agreement lifts a memory; semantic hits outside the pool are ignored', () => {
  const [a, b, c] = [mem({}), mem({}), mem({})];
  const structured = [
    { memory: a, score: 6, why: 'A' }, { memory: b, score: 5.9, why: 'B' }, { memory: c, score: 5.8, why: 'C' },
  ];
  const out = fuseRankings({
    structured,
    semantic: [{ id: c._id, sim: 0.91 }, { id: 'outsider', sim: 0.99 }, { id: b._id, sim: 0.7 }],
  });
  assert.equal(out[0].memory._id, c._id);                 // c: struct rank 3 + semantic rank 1
  assert.match(out[0].why, /semantic match 0\.91 \(#1\)/);
  assert.equal(out.length, 3);                            // outsider not added
  assert.ok(!out.some((x) => x.memory._id === 'outsider'));
});

test('memoryText is short and descriptive', () => {
  const t = memoryText(mem({ type: 'learning_preference', topic: 'trees', content: 'Likes visual', evidence: [{ text: 'said understood' }] }));
  assert.match(t, /learning preference about trees: Likes visual/);
  assert.ok(t.length <= 600);
});

// ---------- retrieveMemories end to end (Memory stubbed) ----------
function stubMemory(docs) {
  const calls = { updateMany: 0 };
  Memory.find = () => ({ lean: async () => docs.map((d) => ({ ...d })) });
  Memory.updateMany = async () => { calls.updateMany++; return {}; };
  return calls;
}

const pool = () => [
  mem({ _id: 'w1', type: 'weakness', topic: 'recursion', content: 'Forgets the base case', confidence: 0.7 }),
  mem({ _id: 'p1', type: 'learning_preference', topic: 'recursion', content: 'Understands with analogy', confidence: 0.6, meta: { style: 'analogy', polarity: 'worked' } }),
  mem({ _id: 's1', type: 'strength', topic: 'recursion', content: 'Solves factorial', confidence: 0.6 }),
  mem({ _id: 'g1', type: 'learning_preference', topic: '*', content: 'Likes visual', confidence: 0.85 }),
  mem({ _id: 'x1', type: 'weakness', topic: 'graphs', content: 'unrelated topic', confidence: 0.9 }),
];

test('legacy path: no query -> structured order, topic scoping intact', async () => {
  stubMemory(pool());
  const out = await retrieveMemories({ userId: 'u1', topic: 'recursion', limit: 5 });
  assert.ok(out.length >= 3);
  assert.ok(!out.some((x) => x.memory._id === 'x1'), 'graphs memory must be filtered out');
  assert.ok(out.every((x) => typeof x.score === 'number' && typeof x.why === 'string'));
});

test('query given but vector search unavailable -> identical result to no query', async () => {
  delete process.env.GEMINI_API_KEY; // embeddings disabled => semanticHits() returns []
  stubMemory(pool());
  const a = await retrieveMemories({ userId: 'u1', topic: 'recursion', limit: 5 });
  stubMemory(pool());
  const b = await retrieveMemories({ userId: 'u1', topic: 'recursion', limit: 5, query: 'why does my function never stop' });
  assert.deepEqual(b.map((x) => x.memory._id), a.map((x) => x.memory._id));
});

test('semanticHits swallows every failure and returns []', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network down'); };
  const r = await semanticHits({ userId: 'u1', query: 'anything' });
  globalThis.fetch = realFetch;
  assert.deepEqual(r, []);
  assert.equal(embedStatus().breakerOpen, true, 'a failing API must trip the circuit breaker');
  // while the breaker is open no further request is attempted
  let called = 0;
  globalThis.fetch = async () => { called++; return { ok: true, json: async () => ({}) }; };
  assert.deepEqual(await semanticHits({ userId: 'u1', query: 'again' }), []);
  globalThis.fetch = realFetch;
  assert.equal(called, 0);
  _resetEmbedState();
});

test('with a (faked) working vector search, semantics re-rank inside the topic pool', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  const realFetch = globalThis.fetch;
  const dims = Number(process.env.EMBED_DIMS) || 768;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ embedding: { values: Array.from({ length: dims }, (_, i) => (i % 7) + 1) } }),
  });
  _setSearchImpl(async () => [
    { id: 's1', sim: 0.93 }, { id: 'x1', sim: 0.9 }, // x1 is out of topic pool -> must be ignored
    { id: 'w1', sim: 0.81 },
  ]);
  stubMemory(pool());
  const out = await retrieveMemories({ userId: 'u1', topic: 'recursion', limit: 5, query: 'solve factorial recursively' });
  globalThis.fetch = realFetch;
  _setSearchImpl(null);
  assert.ok(!out.some((x) => x.memory._id === 'x1'));
  const s1 = out.find((x) => x.memory._id === 's1');
  assert.ok(s1 && /semantic match 0\.93/.test(s1.why));
  assert.equal(recallStatus().semanticHits >= 1, true);
});

test('best worked / best failed style memories are still force-included', async () => {
  delete process.env.GEMINI_API_KEY;
  const docs = [
    ...Array.from({ length: 6 }, (_, i) => mem({ _id: `a${i}`, type: 'weakness', topic: 'trees', confidence: 0.9 })),
    mem({ _id: 'worked', type: 'learning_preference', topic: 'trees', confidence: 0.2, meta: { style: 'visual', polarity: 'worked' } }),
    mem({ _id: 'failed', type: 'learning_preference', topic: 'trees', confidence: 0.2, meta: { style: 'theory', polarity: 'failed' } }),
  ];
  stubMemory(docs);
  const out = await retrieveMemories({ userId: 'u1', topic: 'trees', limit: 5, query: 'binary tree traversal' });
  const ids = out.map((x) => x.memory._id);
  assert.ok(ids.includes('worked') && ids.includes('failed'));
});

// ---------- embedding request shapes ----------
import { embedText } from './embed.js';

test('embedText: falls back to the second request shape on HTTP 400, then remembers it', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  _resetEmbedState();
  const dims = Number(process.env.EMBED_DIMS) || 768;
  const realFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    if (!body.embedContentConfig) return { ok: false, status: 400, text: async () => 'Unknown name taskType' };
    return { ok: true, json: async () => ({ embedding: { values: Array.from({ length: dims }, () => 0.5) } }) };
  };
  const v = await embedText('hello', 'RETRIEVAL_QUERY');
  const v2 = await embedText('again', 'RETRIEVAL_QUERY');
  globalThis.fetch = realFetch;
  assert.equal(v.length, dims);
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9, 'vector is L2-normalised');
  assert.equal(bodies.length, 3);                 // flat(400) -> config(ok) -> config(ok, remembered)
  assert.ok(v2 && bodies[2].embedContentConfig.taskType === 'RETRIEVAL_QUERY');
  _resetEmbedState();
});

test('embedText: wrong dimension count is rejected (cannot poison the index)', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  _resetEmbedState();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ embedding: { values: [0.1, 0.2, 0.3] } }) });
  const v = await embedText('x');
  globalThis.fetch = realFetch;
  assert.equal(v, null);
  _resetEmbedState();
});

// ---------- Atlas glue, with a fake native driver ----------
import mongoose from 'mongoose';
import { ensureVectorIndex, backfillEmbeddings, indexDefinition, INDEX_NAME } from './vectorIndex.js';

function fakeDb(overrides = {}) {
  const log = { created: [], updates: [], aggregates: [], finds: [] };
  const docs = overrides.docs || [];
  const collection = {
    listSearchIndexes: () => ({ toArray: async () => overrides.existing || [] }),
    createSearchIndex: async (def) => {
      if (overrides.createThrows) throw new Error(overrides.createThrows);
      log.created.push(def);
    },
    find: (q) => { log.finds.push(q); return { limit: () => ({ toArray: async () => docs }) }; },
    updateOne: async (f, u) => { log.updates.push([f, u]); },
    aggregate: (p, o) => { log.aggregates.push([p, o]); return { toArray: async () => overrides.rows || [] }; },
  };
  mongoose.connection.db = { collection: () => collection };
  return log;
}

test('ensureVectorIndex creates a correctly-shaped Atlas vectorSearch index when missing', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  const log = fakeDb();
  await ensureVectorIndex();
  assert.equal(log.created.length, 1);
  const def = log.created[0];
  assert.equal(def.name, INDEX_NAME);
  assert.equal(def.type, 'vectorSearch');
  assert.deepEqual(def.definition.fields[0], { type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' });
  assert.deepEqual(def.definition.fields[1], { type: 'filter', path: 'userId' });
  assert.deepEqual(def, indexDefinition());
  assert.equal(recallStatus().index, 'building');
});

test('ensureVectorIndex is idempotent and never throws (existing index / not Atlas)', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  let log = fakeDb({ existing: [{ name: INDEX_NAME, queryable: true }] });
  await ensureVectorIndex();
  assert.equal(log.created.length, 0);
  assert.equal(recallStatus().index, 'ready');
  log = fakeDb({ createThrows: 'Command createSearchIndexes is not supported' });
  await assert.doesNotReject(ensureVectorIndex());
  assert.equal(recallStatus().index, 'unavailable');
});

test('semantic query sends the exact $vectorSearch pipeline Atlas expects', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  _resetEmbedState(); _setSearchImpl(null);
  const uid = new mongoose.Types.ObjectId().toString();
  const log = fakeDb({ rows: [{ _id: new mongoose.Types.ObjectId(), sim: 0.88 }, { _id: new mongoose.Types.ObjectId(), sim: 0.4 }] });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ embedding: { values: Array.from({ length: 768 }, (_, i) => i + 1) } }) });
  const hits = await semanticHits({ userId: uid, query: 'why does recursion never stop' });
  globalThis.fetch = realFetch;
  const [pipeline, opts] = log.aggregates[0];
  const vs = pipeline[0].$vectorSearch;
  assert.equal(vs.index, INDEX_NAME);
  assert.equal(vs.path, 'embedding');
  assert.equal(vs.queryVector.length, 768);
  assert.ok(vs.numCandidates >= vs.limit);
  assert.ok(vs.filter.userId instanceof mongoose.Types.ObjectId, 'userId filter must be an ObjectId, not a string');
  assert.equal(String(vs.filter.userId), uid);
  assert.deepEqual(pipeline[1], { $project: { _id: 1, sim: { $meta: 'vectorSearchScore' } } });
  assert.ok(opts.maxTimeMS > 0);
  assert.equal(hits.length, 1, 'hits below RECALL_MIN_SIM are dropped');
  assert.equal(hits[0].sim, 0.88);
});

test('backfillEmbeddings embeds only memories lacking a vector, via native updateOne (no updatedAt bump)', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  _resetEmbedState();
  const uid = new mongoose.Types.ObjectId().toString();
  const docs = [mem({ _id: new mongoose.Types.ObjectId(), content: 'Forgets base case' }), mem({ _id: new mongoose.Types.ObjectId(), content: 'Likes visuals' })];
  const log = fakeDb({ docs });
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ embedding: { values: Array.from({ length: 768 }, (_, i) => (i % 5) + 1) } }) });
  const n = await backfillEmbeddings({ userId: uid, force: true });
  globalThis.fetch = realFetch;
  assert.equal(n, 2);
  assert.deepEqual(log.finds[0].embedding, { $exists: false });
  assert.ok(log.finds[0].userId instanceof mongoose.Types.ObjectId);
  assert.equal(log.updates.length, 2);
  assert.equal(log.updates[0][1].$set.embedding.length, 768);
  assert.ok(!('updatedAt' in log.updates[0][1].$set));
});

test('backfillEmbeddings never throws when the database or API fails', async () => {
  process.env.GEMINI_API_KEY = 'fake';
  _resetEmbedState();
  mongoose.connection.db = { collection: () => { throw new Error('db gone'); } };
  const uid = new mongoose.Types.ObjectId().toString();
  assert.equal(await backfillEmbeddings({ userId: uid, force: true }), 0);
});
