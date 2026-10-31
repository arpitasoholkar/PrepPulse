// server/memory/mastery.js  (Owner: C)
// Pass adds 10 (easy), 12 (medium), 15 (hard). Fail subtracts 8. Clamp 0 to 100.
// Keeps the last 10 scores in history.

import { TopicMastery } from './deps.js';

const START_SCORE = 50; // score for a topic the student has never practised
const GAIN = { easy: 10, medium: 12, hard: 15 };
const LOSS = 8;

const clamp = (n) => Math.max(0, Math.min(100, n));

// result: "pass" | "fail" | "error"   (error counts as a fail)
async function updateMastery({ userId, topic, result, difficulty }) {
  const row = await TopicMastery.findOne({ userId, topic });
  const before = row ? row.masteryScore : START_SCORE;

  const change = result === 'pass' ? GAIN[difficulty] || GAIN.easy : -LOSS;
  const after = clamp(before + change);

  await TopicMastery.findOneAndUpdate(
    { userId, topic },
    {
      $set: { masteryScore: after, lastPracticed: new Date() },
      $inc: { attempts: 1 },
      $push: { history: { $each: [after], $slice: -10 } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { topic, before, after };
}

export { updateMastery, START_SCORE };