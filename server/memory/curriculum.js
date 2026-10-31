// server/memory/curriculum.js
// Decides what to teach next. A topic counts as learned when the student said
// "I understood" on a lesson, or practice mastery is high enough.
// Next topic = first unlearned topic (in TOPICS order) whose prerequisites are learned.

import TopicProgress from '../models/TopicProgress.js';
import TopicMastery from '../models/TopicMastery.js';
import { TOPICS } from '../constants.js';
import { getPrereqs } from './retrieve.js';

const MASTERED_SCORE = 80;

export const topicLabel = (t) => String(t || '').replace(/-/g, ' ');

export async function getCurriculum(userId) {
  const [progress, mastery] = await Promise.all([
    TopicProgress.find({ userId }).lean(),
    TopicMastery.find({ userId }).lean(),
  ]);
  const pMap = new Map(progress.map((p) => [p.topic, p]));
  const mMap = new Map(mastery.map((m) => [m.topic, m]));

  const topics = TOPICS.map((topic) => {
    const p = pMap.get(topic);
    const m = mMap.get(topic);
    const masteredByPractice = Boolean(m && m.attempts > 0 && m.masteryScore >= MASTERED_SCORE);
    let status = 'not_started';
    if (p?.status === 'learned' || masteredByPractice) status = 'learned';
    else if (p || (m && m.attempts > 0)) status = 'learning';
    return { topic, status, masteryScore: m ? m.masteryScore : null };
  });

  const learned = new Set(topics.filter((t) => t.status === 'learned').map((t) => t.topic));
  const next =
    topics.find((t) => t.status !== 'learned' && getPrereqs(t.topic).every((p) => learned.has(p))) ||
    topics.find((t) => t.status !== 'learned') ||
    null;

  return { topics, next: next ? next.topic : null, learnedCount: learned.size, total: TOPICS.length };
}

export async function markTopicLearned({ userId, topic }) {
  if (!TOPICS.includes(topic)) return null;
  return TopicProgress.findOneAndUpdate(
    { userId, topic },
    { $set: { status: 'learned', learnedAt: new Date(), lastTaughtAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Called when a lesson starts. Never downgrades a learned topic.
export async function markTopicTeaching({ userId, topic }) {
  if (!TOPICS.includes(topic)) return;
  const row = await TopicProgress.findOne({ userId, topic });
  if (!row) {
    await TopicProgress.create({ userId, topic, status: 'learning', lastTaughtAt: new Date() });
  } else {
    row.lastTaughtAt = new Date();
    await row.save();
  }
}
