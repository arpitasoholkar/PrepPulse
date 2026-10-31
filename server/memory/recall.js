// server/memory/recall.js
// Pure functions only (no database, no network) so they are easy to unit-test.
//
// 1. Forgetting curve  : how "fresh" a memory still is (Ebbinghaus-style exponential decay,
//                        reinforced by evidence + usage, slowed down when the student corrected it).
// 2. Rank fusion (RRF) : merges the structured ranking (topic / type / confidence / retention)
//                        with the semantic ranking from MongoDB Vector Search.

const DAY_MS = 24 * 60 * 60 * 1000;

// Base stability S0 (in days): after S days without being re-verified, retention falls to 1/e (~37%).
// Stable traits (how someone learns) fade slowly; short-lived notes fade fast.
export const BASE_STABILITY_DAYS = {
  learning_preference: 30,
  strength: 21,
  weakness: 21,
  concept_understood: 14,
  mistake: 10,
  revision_needed: 5,
};
const DEFAULT_STABILITY_DAYS = 14;

/**
 * Stability S (days) of one memory.
 *   S = S0(type) * evidenceBoost * usageBoost * trust
 *   evidenceBoost = 1 + 0.5 * ln(1 + #evidence)        (more proof -> lasts longer)
 *   usageBoost    = min(2, 1 + 0.25 * ln(1 + useCount)) (recalled & useful -> lasts longer, capped)
 *   trust         = 3 if the student corrected it by hand, else 1
 */
export function stabilityDays(mem = {}) {
  const base = BASE_STABILITY_DAYS[mem.type] ?? DEFAULT_STABILITY_DAYS;
  const evidenceCount = Array.isArray(mem.evidence) ? mem.evidence.length : 0;
  const evidenceBoost = 1 + 0.5 * Math.log(1 + evidenceCount);
  const usageBoost = Math.min(2, 1 + 0.25 * Math.log(1 + Math.max(0, Number(mem.useCount) || 0)));
  const trust = mem.status === 'corrected' ? 3 : 1;
  return base * evidenceBoost * usageBoost * trust;
}

/**
 * Retention R in [0, 1]:  R = exp(-daysSinceLastVerified / S)
 * A memory with no usable date gets 0 (same as the old "no recency bonus").
 */
export function retention(mem = {}, now = Date.now()) {
  const last = mem.lastVerified || mem.updatedAt || mem.createdAt;
  if (!last) return 0;
  const t = new Date(last).getTime();
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (now - t) / DAY_MS);
  const r = Math.exp(-days / stabilityDays(mem));
  return Number.isFinite(r) ? Math.max(0, Math.min(1, r)) : 0;
}

/**
 * Reciprocal Rank Fusion (Cormack et al. 2009), the same formula MongoDB uses in $rankFusion:
 *   fused(d) = sum over lists of  weight / (k + rank(d))      rank starts at 1, k = 60
 * lists: arrays of ids ordered best -> worst.  Returns Map(id -> fused score).
 */
export function rrfScores(lists, { k = 60, weights = [] } = {}) {
  const out = new Map();
  lists.forEach((ids, li) => {
    const w = weights[li] ?? 1;
    ids.forEach((id, i) => {
      const key = String(id);
      out.set(key, (out.get(key) || 0) + w / (k + i + 1));
    });
  });
  return out;
}

/**
 * Fuse the structured ranking with the semantic ranking.
 *   structured: [{ memory, score, why }]  best first (the complete candidate pool)
 *   semantic  : [{ id, sim }]             Vector Search hits (any order, any ids)
 * Semantic hits that are NOT in the pool are ignored, so semantic recall can only re-rank
 * what the structured rules already allow (topic scoping stays strict and explainable).
 * With no usable semantic hit the input order is returned untouched.
 */
export function fuseRankings({ structured, semantic, k = 60, wStruct = 1, wSem = 1 }) {
  if (!Array.isArray(structured) || structured.length === 0) return structured || [];
  if (!Array.isArray(semantic) || semantic.length === 0) return structured;

  const poolIds = new Set(structured.map((x) => String(x.memory._id)));
  const semList = semantic
    .filter((h) => h && h.id != null && Number.isFinite(h.sim) && poolIds.has(String(h.id)))
    .sort((a, b) => b.sim - a.sim);
  if (semList.length === 0) return structured;

  const structIds = structured.map((x) => String(x.memory._id));
  const fused = rrfScores([structIds, semList.map((h) => h.id)], { k, weights: [wStruct, wSem] });
  const semInfo = new Map(semList.map((h, i) => [String(h.id), { sim: h.sim, rank: i + 1 }]));

  return structured
    .map((item, idx) => {
      const id = String(item.memory._id);
      const s = semInfo.get(id);
      const why = s
        ? `${item.why}; semantic match ${s.sim.toFixed(2)} (#${s.rank})`
        : item.why;
      return { ...item, why, fused: fused.get(id) || 0, _idx: idx };
    })
    .sort((a, b) => b.fused - a.fused || b.score - a.score || a._idx - b._idx)
    .map(({ _idx, ...rest }) => rest);
}

/** Text that represents a memory in embedding space. Short on purpose. */
export function memoryText(mem = {}) {
  const type = String(mem.type || '').replace(/_/g, ' ');
  const ev = (Array.isArray(mem.evidence) ? mem.evidence : [])
    .slice(-2)
    .map((e) => e && e.text)
    .filter(Boolean)
    .join(' | ');
  return `${type} about ${mem.topic || 'general'}: ${mem.content || ''}${ev ? `. Evidence: ${ev}` : ''}`.slice(0, 600);
}
