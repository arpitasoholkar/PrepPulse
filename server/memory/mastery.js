import TopicMastery from '../models/TopicMastery.js';

export async function updateMastery({ userId, topic, result, difficulty = 'easy' }) {
  let delta = 0;
  if (result === 'pass') {
    if (difficulty === 'easy') delta = 10;
    else if (difficulty === 'medium') delta = 12;
    else if (difficulty === 'hard') delta = 15;
  } else {
    delta = -8;
  }

  let record = await TopicMastery.findOne({ userId, topic });
  const before = record ? record.masteryScore : 50;
  const after = Math.max(0, Math.min(100, before + delta));

  if (!record) {
    record = await TopicMastery.create({
      userId,
      topic,
      masteryScore: after,
      attempts: 1,
      lastPracticed: new Date(),
      history: [after]
    });
  } else {
    record.masteryScore = after;
    record.attempts += 1;
    record.lastPracticed = new Date();
    if (!record.history) record.history = [];
    record.history.push(after);
    if (record.history.length > 10) {
      record.history = record.history.slice(-10);
    }
    await record.save();
  }

  return { topic, before, after };
}
