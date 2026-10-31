// server/memory/retrieve.js  (Owner: C)
// Finds the 5 most useful memories for the current question.
// Structured score = topic match + type bonus + confidence + retention (forgetting curve) + corrected bonus.
// Optional semantic signal: MongoDB Vector Search ranks the same candidates by meaning, and the two
// rankings are merged with Reciprocal Rank Fusion. If semantic recall is unavailable for any reason,
// the structured ranking is used unchanged.

import { Memory } from './deps.js';
import { retention, fuseRankings } from './recall.js';
import { semanticHits, backfillEmbeddings } from './vectorIndex.js';

// Hardcoded prerequisite map: learning X needs Y first
const PREREQS = {
  graphs: ['recursion'],
  trees: ['recursion'],
  dp: ['recursion'],
};

function getPrereqs(topic) {
  return PREREQS[topic] || [];
}

// Order matters: specific topics first, general ones last
const TOPIC_PATTERNS = [
  ['graphs', /\b(dfs|bfs|graphs?|depth[- ]first|breadth[- ]first|dijkstra|adjacency|connected components?)\b/i],
  ['trees', /\b(trees?|bst|binary tree|binary search tree|traversal|inorder|preorder|postorder|heap)\b/i],
  ['dp', /\b(dp|dynamic programming|memoi[sz]ation|knapsack|tabulation)\b/i],
  ['recursion', /\b(recursion|recursive|base case|backtracking|call stack)\b/i],
  ['linked-list', /\b(linked lists?|singly|doubly|reverse a list)\b/i],
  ['stacks-queues', /\b(stacks?|queues?|monotonic|deque)\b/i],
  ['hashing', /\b(hash(ing|map|set|table)?|dictionary|frequency map)\b/i],
  ['sorting', /\b(sort(ing)?|merge sort|quick sort|bubble sort)\b/i],
  ['strings', /\b(strings?|palindrome|anagram|substring)\b/i],
  ['arrays', /\b(arrays?|binary search|two pointers?|sliding window|prefix sum)\b/i],
];

// Returns a topic string or null if nothing matched
function detectTopic(message) {
  const text = message || '';
  for (const [topic, regex] of TOPIC_PATTERNS) {
    if (regex.test(text)) return topic;
  }
  return null;
}

function scoreMemory(mem, topic, prereqs) {
  let score = 0;
  const reasons = [];

  if (topic && mem.topic === topic) {
    score += 3;
    reasons.push(`topic match: ${topic}`);
  } else if (mem.topic === '*') {
    score += 1;
    reasons.push('applies to all topics');
  } else if (prereqs.includes(mem.topic)) {
    score += 2;
    reasons.push(`prerequisite topic: ${mem.topic}`);
  }

  if (mem.type === 'learning_preference') {
    score += 1;
    reasons.push('learning preference');
  } else if (mem.type === 'mistake') {
    score += 1;
    reasons.push('past mistake');
  }

  score += (mem.confidence || 0) * 2;

  // Forgetting curve: +1 when just verified, decays exponentially; slower for well-evidenced,
  // often-used or student-corrected memories (see recall.js).
  const r = retention(mem);
  score += r;
  if (r < 0.75) reasons.push(`fading: retention ${Math.round(r * 100)}%`);

  if (mem.status === 'corrected') {
    score += 1;
    reasons.push('corrected by you');
  }

  return { score: Math.round(score * 100) / 100, reasons };
}

/**
 * retrieveMemories({ userId, topic, limit, query })
 * returns [{ memory, why, score }]  and updates useCount + lastUsedAt
 */
async function retrieveMemories({ userId, topic, limit = 5, query = null }) {
  const prereqs = getPrereqs(topic);

  const all = await Memory.find({
    userId,
    status: { $in: ['active', 'corrected'] },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();

  const scored = all
    .map((mem) => {
      const { score, reasons } = scoreMemory(mem, topic, prereqs);
      return { memory: mem, score, why: reasons.join('; ') || 'general memory' };
    })
    // keep only memories that relate to this topic, its prerequisites, or all topics
    .filter(
      (x) =>
        !topic ||
        x.memory.topic === topic ||
        x.memory.topic === '*' ||
        prereqs.includes(x.memory.topic)
    )
    .sort((a, b) => b.score - a.score);

  // Semantic recall (MongoDB Vector Search) + Reciprocal Rank Fusion. Fully optional:
  // semanticHits() returns [] when unavailable and fuseRankings() then keeps the order as is.
  let ranked = scored;
  if (query && scored.length > 1) {
    try {
      const hits = await semanticHits({ userId, query });
      ranked = fuseRankings({ structured: scored, semantic: hits });
    } catch (err) {
      ranked = scored;
    }
  }
  // Embed any memory that has no vector yet (seed data, new memories). Background, never awaited.
  backfillEmbeddings({ userId }).catch(() => {});

  // Section 4 requirement: Always include the best worked and the best failed
  // style memory for the topic if they exist, even when top limit would drop them.
  let selected = ranked.slice(0, limit);

  if (topic) {
    const isBestWorked = (item) =>
      item.memory.type === 'learning_preference' &&
      item.memory.topic === topic &&
      item.memory.meta?.polarity === 'worked';

    const isBestFailed = (item) =>
      item.memory.type === 'learning_preference' &&
      item.memory.topic === topic &&
      item.memory.meta?.polarity === 'failed';

    const bestWorked = ranked.find(isBestWorked);
    if (bestWorked && !selected.some((s) => String(s.memory._id) === String(bestWorked.memory._id))) {
      selected.push(bestWorked);
    }

    const bestFailed = ranked.find(isBestFailed);
    if (bestFailed && !selected.some((s) => String(s.memory._id) === String(bestFailed.memory._id))) {
      selected.push(bestFailed);
    }
  }

  if (selected.length > 0) {
    await Memory.updateMany(
      { _id: { $in: selected.map((x) => x.memory._id) } },
      { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } }
    );
  }

  return selected;
}

export { retrieveMemories, detectTopic, getPrereqs, PREREQS };