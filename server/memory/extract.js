import Memory from '../models/Memory.js';

export async function extractAndSavePreference({ userId, topic, style, evidenceText }) {
  // Check if topic already has this preference
  let existing = await Memory.findOne({
    userId,
    topic,
    type: 'learning_preference',
    'meta.style': style,
    status: 'active'
  });

  const evidenceItem = {
    text: evidenceText || `Understood explanation delivered in ${style} style`,
    source: 'chat',
    at: new Date()
  };

  if (existing) {
    existing.confidence = Math.min(1.0, existing.confidence + 0.1);
    existing.evidence.push(evidenceItem);
    await existing.save();
    return existing;
  }

  // Check how many other topics have this style preference
  const otherTopicPreferences = await Memory.find({
    userId,
    type: 'learning_preference',
    'meta.style': style,
    status: 'active',
    topic: { $ne: topic, $ne: '*' }
  });

  const newMemory = await Memory.create({
    userId,
    type: 'learning_preference',
    topic,
    content: `Prefers ${style} explanations for ${topic}`,
    evidence: [evidenceItem],
    confidence: 0.6,
    status: 'active',
    meta: { style },
    source: 'chat'
  });

  // Second topic rule: promote to global preference (*)
  if (otherTopicPreferences.length >= 1) {
    const globalExists = await Memory.findOne({
      userId,
      topic: '*',
      type: 'learning_preference',
      'meta.style': style,
      status: 'active'
    });

    if (!globalExists) {
      await Memory.create({
        userId,
        type: 'learning_preference',
        topic: '*',
        content: `Consistently prefers ${style} explanations across multiple topics`,
        evidence: [evidenceItem],
        confidence: 0.85,
        status: 'active',
        meta: { style },
        source: 'chat'
      });
    }
  }

  return newMemory;
}
