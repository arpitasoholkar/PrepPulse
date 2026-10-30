import Memory from '../models/Memory.js';

export async function recordMistake({ userId, topic, errorType, explanation, refId }) {
  const evidenceItem = {
    text: explanation || `Failed test with error type ${errorType}`,
    source: 'practice',
    refId,
    at: new Date()
  };

  // Find existing active mistake for this topic & errorType
  let existing = await Memory.findOne({
    userId,
    topic,
    type: 'mistake',
    'meta.errorType': errorType,
    status: { $in: ['active', 'corrected'] }
  });

  if (existing) {
    if (existing.status !== 'corrected') {
      existing.confidence = 0.7;
    }
    existing.evidence.push(evidenceItem);
    await existing.save();

    // Upgrade or create weakness on second mistake
    await upsertWeakness({ userId, topic, errorType, evidenceItem });
    return existing;
  }

  // First wrong attempt: mistake memory confidence 0.4, no weakness yet
  return await Memory.create({
    userId,
    type: 'mistake',
    topic,
    content: `Recurring mistake in ${topic}: ${errorType.replace(/_/g, ' ')}`,
    evidence: [evidenceItem],
    confidence: 0.4,
    status: 'active',
    meta: { errorType },
    source: 'practice'
  });
}

export async function upsertWeakness({ userId, topic, errorType, evidenceItem }) {
  let weakness = await Memory.findOne({
    userId,
    topic,
    type: 'weakness',
    status: 'active'
  });

  if (weakness) {
    weakness.confidence = Math.min(1.0, weakness.confidence + 0.1);
    weakness.evidence.push(evidenceItem);
    return await weakness.save();
  }

  return await Memory.create({
    userId,
    type: 'weakness',
    topic,
    content: `Struggles with ${errorType.replace(/_/g, ' ')} in ${topic}`,
    evidence: [evidenceItem],
    confidence: 0.7,
    status: 'active',
    meta: { errorType },
    source: 'practice'
  });
}

export async function supersedeWeakness({ userId, topic, newMemoryId }) {
  const activeWeaknesses = await Memory.find({
    userId,
    topic,
    type: 'weakness',
    status: 'active'
  });

  for (const w of activeWeaknesses) {
    w.status = 'superseded';
    w.supersededBy = newMemoryId;
    await w.save();
  }
}
