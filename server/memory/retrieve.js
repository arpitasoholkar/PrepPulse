import Memory from '../models/Memory.js';

const KEYWORD_MAP = {
  'recursion': 'recursion',
  'recursive': 'recursion',
  'dfs': 'graphs',
  'bfs': 'graphs',
  'graph': 'graphs',
  'tree': 'trees',
  'binary tree': 'trees',
  'array': 'arrays',
  'binary search': 'arrays',
  'string': 'strings',
  'palindrome': 'strings',
  'dp': 'dp',
  'dynamic programming': 'dp',
  'stack': 'stacks-queues',
  'queue': 'stacks-queues',
  'linked list': 'linked-list'
};

const PREREQUISITES = {
  'graphs': ['recursion'],
  'trees': ['recursion'],
  'dp': ['recursion']
};

export function detectTopic(message) {
  const lower = message.toLowerCase();
  for (const [kw, topic] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(kw)) {
      return topic;
    }
  }
  return 'recursion'; // default fallback
}

export async function retrieveMemories({ userId, topic, limit = 5 }) {
  const prereqs = PREREQUISITES[topic] || [];
  const candidateTopics = [topic, '*', ...prereqs];

  const activeMemories = await Memory.find({
    userId,
    status: 'active',
    topic: { $in: candidateTopics }
  });

  const now = Date.now();
  const scored = [];

  for (const mem of activeMemories) {
    let score = 0;
    const whyParts = [];

    // Topic match
    if (mem.topic === topic) {
      score += 3;
      whyParts.push(`topic match: ${topic}`);
    } else if (mem.topic === '*') {
      score += 1;
      whyParts.push('global preference');
    } else if (prereqs.includes(mem.topic)) {
      score += 2;
      whyParts.push(`prerequisite match: ${mem.topic}`);
    }

    // Type weight
    if (mem.type === 'learning_preference' || mem.type === 'mistake') {
      score += 1;
      whyParts.push(`${mem.type.replace('_', ' ')}`);
    }

    // Confidence
    score += (mem.confidence || 0.5) * 2;

    // Recency (last 14 days)
    const ageDays = (now - new Date(mem.updatedAt || mem.createdAt).getTime()) / (1000 * 3600 * 24);
    if (ageDays <= 14) {
      const recencyBonus = Math.max(0, 1 - (ageDays / 14));
      score += recencyBonus;
    }

    // Corrected memories get bonus
    if (mem.status === 'corrected') {
      score += 1;
      whyParts.push('user corrected');
    }

    scored.push({
      memory: mem,
      why: whyParts.join('; '),
      score: Number(score.toFixed(2))
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit);

  // Update useCount and lastUsedAt
  const selectedIds = selected.map(s => s.memory._id);
  if (selectedIds.length > 0) {
    await Memory.updateMany(
      { _id: { $in: selectedIds } },
      { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } }
    );
  }

  return selected;
}
