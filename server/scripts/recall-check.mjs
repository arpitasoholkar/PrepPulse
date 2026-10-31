// server/scripts/recall-check.mjs
// One-command proof that semantic recall works against YOUR Atlas cluster + Gemini key.
//   cd server && npm run recall:check
// Non-destructive: it only creates the vector index (if missing) and embeds memories that have no vector.
// Prerequisite: the demo user exists (click "Explore with demo account" in the app once).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const { default: User } = await import('../models/User.js');
const { embedText, embedStatus } = await import('../memory/embed.js');
const { ensureVectorIndex, backfillEmbeddings, semanticHits, recallStatus, INDEX_NAME } = await import('../memory/vectorIndex.js');
const { retrieveMemories } = await import('../memory/retrieve.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};

if (!process.env.MONGODB_URI || !process.env.GEMINI_API_KEY) {
  console.error('Set MONGODB_URI and GEMINI_API_KEY in server/.env first.');
  process.exit(2);
}
await mongoose.connect(process.env.MONGODB_URI);

// 1. Gemini embeddings
const v = await embedText('forgets the base case in recursion', 'RETRIEVAL_DOCUMENT');
check(Array.isArray(v) && v.length > 0, 'Gemini embedding call works', v ? `(${v.length} dims)` : JSON.stringify(embedStatus()));
if (!v) process.exit(1);

// 2. Atlas vector index
const state = await ensureVectorIndex();
check(state === 'ready' || state === 'building', `vector index "${INDEX_NAME}" exists`, `(state: ${state})`);
if (state === 'unavailable') {
  console.log('\nThe cluster refused createSearchIndex. Create the index by hand in Atlas (README -> "Create the vector index manually").');
  process.exit(1);
}

// 3. Wait until it is queryable (first build takes about a minute)
const col = mongoose.connection.db.collection('student_memories');
let ready = false;
for (let i = 0; i < 40 && !ready; i++) {
  const ix = await col.listSearchIndexes(INDEX_NAME).toArray();
  ready = ix[0]?.queryable === true || ix[0]?.status === 'READY';
  if (!ready) {
    process.stdout.write(i === 0 ? 'waiting for Atlas to build the index ' : '.');
    await sleep(6000);
  }
}
if (!ready) console.log('');
check(ready, 'vector index is READY');
if (!ready) process.exit(1);

// 4. Embed the demo user's memories
const demo = await User.findOne({ email: 'demo@intelliprep.dev' });
check(Boolean(demo), 'demo user exists (click "Explore with demo account" once if this fails)');
if (!demo) process.exit(1);
const embedded = await backfillEmbeddings({ userId: demo._id, force: true, max: 100 });
const total = await col.countDocuments({ userId: demo._id, embedding: { $exists: true } });
check(total > 0, 'memories have embeddings', `(newly embedded ${embedded}, total ${total})`);
await sleep(8000); // Atlas indexes new vectors within a few seconds

// 5. Meaning-based recall, with NO topic keyword in the question
const cases = [
  ['my function keeps running forever and then the stack blows up', 'recursion'],
  ['I always forget to mark nodes as already seen', 'graphs'],
  ['my code crashes when a child pointer is None', 'trees'],
  ['strip punctuation and ignore case before comparing', 'strings'],
];
for (const [q, topic] of cases) {
  let hits = [];
  for (let attempt = 0; attempt < 3 && hits.length === 0; attempt++) {
    hits = await semanticHits({ userId: demo._id, query: q, limit: 5 });
    if (hits.length === 0) await sleep(5000);
  }
  const docs = await col.find({ _id: { $in: hits.map((h) => new mongoose.Types.ObjectId(h.id)) } }, { projection: { topic: 1, content: 1 } }).toArray();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  const top = hits.slice(0, 3).map((h) => ({ ...byId.get(h.id), sim: h.sim }));
  console.log(`\n  "${q}"`);
  top.forEach((t, i) => console.log(`    #${i + 1} ${t.sim?.toFixed(3)}  [${t.topic}] ${t.content}`));
  check(top.some((t) => t.topic === topic), `semantic top-3 contains a "${topic}" memory`);
}

// 6. The full retriever (what the chat route calls)
const used = await retrieveMemories({ userId: demo._id, topic: null, limit: 5, query: 'my function keeps running forever and then the stack blows up' });
console.log('\n  retrieveMemories() with NO detected topic:');
used.forEach((u, i) => console.log(`    #${i + 1} [${u.memory.topic}] ${u.memory.content}\n         why: ${u.why}`));
check(used.some((u) => /semantic match/.test(u.why)), 'retriever returns memories explained by "semantic match"');

console.log('\n' + JSON.stringify(recallStatus(), null, 2));
console.log(failed === 0 ? '\nALL CHECKS PASSED: semantic recall is live.' : `\n${failed} CHECK(S) FAILED: the app still works (structured recall); see README troubleshooting.`);
await mongoose.disconnect();
process.exit(failed === 0 ? 0 : 1);
