// server/memory/vectorIndex.js
// Everything MongoDB Atlas Vector Search related lives here:
//   ensureVectorIndex()      create the vectorSearch index on startup (idempotent, never throws)
//   backfillEmbeddings()     embed memories that have no vector yet (seed data, new memories)
//   semanticHits()           query embedding -> $vectorSearch -> [{ id, sim }]  (never throws)
// If anything is missing (not Atlas, no API key, index still building) the functions return empty
// results and the caller keeps using the structured ranking. Nothing here can break a chat request.

import mongoose from 'mongoose';
import { Memory } from './deps.js';
import { embedText, embeddingsEnabled, embedStatus, EMBED_DIMS } from './embed.js';
import { memoryText } from './recall.js';

export const INDEX_NAME = process.env.VECTOR_INDEX_NAME || 'memory_vector_index';
const MIN_SIM = Number(process.env.RECALL_MIN_SIM) || 0.6; // Atlas cosine score = (1 + cos) / 2
const SEARCH_TIMEOUT_MS = 4000;
const BREAKER_MS = 60000;

const state = { index: 'unknown', lastError: null, searches: 0, hits: 0 };
let searchBreakerUntil = 0;
let searchImpl = null; // test hook

const col = () => mongoose.connection.db.collection(Memory.collection.name);

export function indexDefinition() {
  return {
    name: INDEX_NAME,
    type: 'vectorSearch',
    definition: {
      fields: [
        { type: 'vector', path: 'embedding', numDimensions: EMBED_DIMS, similarity: 'cosine' },
        { type: 'filter', path: 'userId' },
      ],
    },
  };
}

export function recallStatus() {
  return {
    mode: embeddingsEnabled() ? 'hybrid (structured + semantic + forgetting curve)' : 'structured + forgetting curve',
    vectorIndex: INDEX_NAME,
    index: state.index,
    lastError: state.lastError,
    semanticSearches: state.searches,
    semanticHits: state.hits,
    embeddings: embedStatus(),
  };
}

/** Create the Atlas vector index if it does not exist. Safe to call on every boot. */
export async function ensureVectorIndex() {
  if (!embeddingsEnabled()) {
    state.index = 'disabled';
    return state.index;
  }
  try {
    const existing = await col().listSearchIndexes(INDEX_NAME).toArray();
    if (existing.length > 0) {
      const ix = existing[0];
      state.index = ix.queryable === true || ix.status === 'READY' ? 'ready' : 'building';
      const dims = ix.latestDefinition?.fields?.find?.((f) => f.type === 'vector')?.numDimensions;
      if (dims && dims !== EMBED_DIMS) {
        state.lastError = `index has ${dims} dims but EMBED_DIMS=${EMBED_DIMS}`;
        console.error(`[recall] ${state.lastError}`);
      }
      return state.index;
    }
    await col().createSearchIndex(indexDefinition());
    state.index = 'building';
    console.log(`[recall] vector index "${INDEX_NAME}" created (Atlas builds it in ~1 minute)`);
  } catch (err) {
    // Not Atlas, no permission, or driver too old: semantic recall simply stays off.
    state.index = 'unavailable';
    state.lastError = String(err.message).slice(0, 160);
    console.error(`[recall] vector index not available (${state.lastError}); using structured recall only`);
  }
  return state.index;
}

// ---------- embedding backfill ----------
const inflight = new Map(); // userId -> Promise
const lastCheck = new Map(); // userId -> timestamp (throttle)

async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Embed up to `max` memories of this user that have no embedding yet. Never throws. */
export function backfillEmbeddings({ userId, max = 40, force = false } = {}) {
  if (!embeddingsEnabled() || !userId) return Promise.resolve(0);
  const key = String(userId);
  if (inflight.has(key)) return inflight.get(key);
  if (!force && Date.now() - (lastCheck.get(key) || 0) < 30000) return Promise.resolve(0);
  lastCheck.set(key, Date.now());

  const job = (async () => {
    let done = 0;
    try {
      const oid = new mongoose.Types.ObjectId(key);
      const docs = await col()
        .find({ userId: oid, embedding: { $exists: false }, status: { $in: ['active', 'corrected'] } })
        .limit(max)
        .toArray();
      await mapLimit(docs, 4, async (doc) => {
        const vec = await embedText(memoryText(doc), 'RETRIEVAL_DOCUMENT');
        if (!vec) return;
        // native driver on purpose: does not touch updatedAt, bypasses Mongoose casting
        await col().updateOne({ _id: doc._id }, { $set: { embedding: vec, embeddedAt: new Date() } });
        done++;
      });
    } catch (err) {
      state.lastError = String(err.message).slice(0, 160);
    } finally {
      inflight.delete(key);
    }
    return done;
  })();
  inflight.set(key, job);
  return job;
}

// ---------- semantic search ----------
async function atlasSearch({ userId, queryVector, limit }) {
  const pipeline = [
    {
      $vectorSearch: {
        index: INDEX_NAME,
        path: 'embedding',
        queryVector,
        numCandidates: 100,
        limit,
        filter: { userId: new mongoose.Types.ObjectId(String(userId)) },
      },
    },
    { $project: { _id: 1, sim: { $meta: 'vectorSearchScore' } } },
  ];
  const rows = await col().aggregate(pipeline, { maxTimeMS: SEARCH_TIMEOUT_MS }).toArray();
  return rows.map((r) => ({ id: String(r._id), sim: r.sim }));
}

/** query text -> [{ id, sim }] best first. Returns [] whenever semantic recall is unavailable. */
export async function semanticHits({ userId, query, limit = 15 }) {
  try {
    if (!query || !embeddingsEnabled() || Date.now() < searchBreakerUntil) return [];
    const queryVector = await embedText(query, 'RETRIEVAL_QUERY');
    if (!queryVector) return [];
    state.searches++;
    const rows = await (searchImpl || atlasSearch)({ userId, queryVector, limit });
    const hits = rows.filter((r) => Number.isFinite(r.sim) && r.sim >= MIN_SIM).sort((a, b) => b.sim - a.sim);
    if (hits.length > 0) {
      state.hits++;
      state.index = 'ready';
    }
    return hits;
  } catch (err) {
    state.lastError = String(err.message).slice(0, 160);
    searchBreakerUntil = Date.now() + BREAKER_MS;
    console.error(`[recall] semantic search failed, using structured recall: ${state.lastError}`);
    return [];
  }
}

/** test hook: replace the Atlas call with a fake */
export function _setSearchImpl(fn) {
  searchImpl = fn;
  searchBreakerUntil = 0;
}
