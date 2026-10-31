// server/memory/lifecycle.js  (Owner: C)
// ALL memory rules from section 6.4 live here. Routes only call these functions.
// Golden rule: a memory with status "corrected" is NEVER overwritten, we only add evidence.

import { Memory, CodingAttempt } from './deps.js';

const WEAKNESS_TEXT = {
  wrong_base_case: 'Forgets the base case',
  off_by_one: 'Makes off-by-one errors',
  wrong_loop_condition: 'Gets loop conditions wrong',
  logic_error: 'Makes logic errors',
  inefficient: 'Writes inefficient solutions',
  edge_case_missed: 'Misses edge cases',
  syntax_error: 'Makes syntax errors',
};

const plain = (doc) => (doc && doc.toObject ? doc.toObject() : doc);

function evidenceEntry({ text, source, refId }) {
  return { text, source, refId: refId ? String(refId) : null, at: new Date() };
}

// Add evidence. Only raise confidence if the memory is NOT corrected.
async function addEvidence(mem, evidence, newConfidence) {
  const set = { lastVerified: new Date() };
  if (newConfidence && mem.status !== 'corrected') {
    set.confidence = Math.max(mem.confidence || 0, newConfidence);
  }
  return Memory.findByIdAndUpdate(
    mem._id,
    { $push: { evidence }, $set: set },
    { new: true }
  );
}

/**
 * Rule: first wrong attempt -> mistake (0.4), NO weakness.
 *       same errorType again -> add evidence, confidence 0.7, create/upgrade weakness.
 * returns { saved: [], updated: [] }
 */
async function recordMistake({ userId, topic, errorType, text, attemptId }) {
  const evidence = evidenceEntry({ text, source: 'practice', refId: attemptId });

  const existing = await Memory.findOne({
    userId,
    type: 'mistake',
    topic,
    'meta.errorType': errorType,
    status: { $in: ['active', 'corrected'] },
  });

  if (!existing) {
    const created = await Memory.create({
      userId,
      type: 'mistake',
      topic,
      content: `${WEAKNESS_TEXT[errorType] || 'Makes mistakes'} in ${topic} problems`,
      evidence: [evidence],
      confidence: 0.4,
      status: 'active',
      meta: { style: null, errorType },
      source: 'practice',
      lastVerified: new Date(),
    });
    return { saved: [plain(created)], updated: [] };
  }

  // Second time: add evidence, raise confidence, then create/upgrade the weakness
  const updatedMistake = await addEvidence(existing, evidence, 0.7);
  const weakness = await upsertWeakness({ userId, topic, errorType, evidence });

  return {
    saved: weakness.saved,
    updated: [plain(updatedMistake), ...weakness.updated],
  };
}

// Create a weakness memory, or add evidence to the existing one
async function upsertWeakness({ userId, topic, errorType, evidence }) {
  const existing = await Memory.findOne({
    userId,
    type: 'weakness',
    topic,
    status: { $in: ['active', 'corrected'] },
  });

  if (existing) {
    const updated = await addEvidence(existing, evidence, 0.7);
    return { saved: [], updated: [plain(updated)] };
  }

  const created = await Memory.create({
    userId,
    type: 'weakness',
    topic,
    content: `Weak in ${topic}: ${WEAKNESS_TEXT[errorType] || 'repeated mistakes'}`,
    evidence: [evidence],
    confidence: 0.7,
    status: 'active',
    meta: { style: null, errorType },
    source: 'practice',
    lastVerified: new Date(),
  });
  return { saved: [plain(created)], updated: [] };
}

/**
 * Rule: student passes 2 questions in a row on a topic that has an active weakness
 *       -> weakness becomes "superseded", supersededBy = new strength memory.
 * Call this right AFTER saving a passing attempt.
 */
async function supersedeWeaknessIfEarned({ userId, topic, attemptId }) {
  const weakness = await Memory.findOne({ userId, type: 'weakness', topic, status: 'active' });
  if (!weakness) return { saved: [], updated: [] };

  const lastTwo = await CodingAttempt.find({ userId, topic }).sort({ timestamp: -1 }).limit(2).lean();
  const twoPasses = lastTwo.length === 2 && lastTwo.every((a) => a.result === 'pass');
  if (!twoPasses) return { saved: [], updated: [] };

  return supersedeWeakness({ userId, topic, weakness, attemptId });
}

async function supersedeWeakness({ userId, topic, weakness, attemptId }) {
  const evidence = evidenceEntry({
    text: `Passed 2 ${topic} questions in a row`,
    source: 'practice',
    refId: attemptId,
  });

  const strength = await Memory.create({
    userId,
    type: 'strength',
    topic,
    content: `Now solves ${topic} problems correctly`,
    evidence: [evidence],
    confidence: 0.6,
    status: 'active',
    meta: { style: null, errorType: 'none' },
    source: 'practice',
    lastVerified: new Date(),
  });

  const updated = await Memory.findByIdAndUpdate(
    weakness._id,
    {
      $set: { status: 'superseded', supersededBy: strength._id, lastVerified: new Date() },
      $push: { evidence },
    },
    { new: true }
  );

  return { saved: [plain(strength)], updated: [plain(updated)] };
}

/**
 * Rule: student says "understood" after style X -> learning_preference, topic, confidence 0.6.
 *       Same style worked on a second topic -> confidence 0.85 + global preference (topic "*").
 */
async function savePreference({ userId, topic, style, evidenceText, refId }) {
  const evidence = evidenceEntry({ text: evidenceText, source: 'chat', refId });
  const saved = [];
  const updated = [];

  let pref = await Memory.findOne({
    userId,
    type: 'learning_preference',
    topic,
    'meta.style': style,
    status: { $in: ['active', 'corrected'] },
  });

  if (pref) {
    pref = await addEvidence(pref, evidence, 0.6);
    updated.push(plain(pref));
  } else {
    pref = await Memory.create({
      userId,
      type: 'learning_preference',
      topic,
      content: `Understands ${topic} best with a ${style.replace('_', ' ')} explanation`,
      evidence: [evidence],
      confidence: 0.6,
      status: 'active',
      meta: { style, errorType: null },
      source: 'chat',
      lastVerified: new Date(),
    });
    saved.push(plain(pref));
  }

  // Second-topic rule: same style worked on a different (non-global) topic?
  const otherTopicPref = await Memory.findOne({
    userId,
    type: 'learning_preference',
    'meta.style': style,
    topic: { $nin: [topic, '*'] },
    status: { $in: ['active', 'corrected'] },
  });

  if (otherTopicPref) {
    const raised1 = await addEvidence(pref, evidence, 0.85);
    const raised2 = await addEvidence(otherTopicPref, evidence, 0.85);

    let global = await Memory.findOne({
      userId,
      type: 'learning_preference',
      topic: '*',
      'meta.style': style,
      status: { $in: ['active', 'corrected'] },
    });

    if (global) {
      global = await addEvidence(global, evidence, 0.85);
      updated.push(plain(global));
    } else {
      global = await Memory.create({
        userId,
        type: 'learning_preference',
        topic: '*',
        content: `Understands most topics best with a ${style.replace('_', ' ')} explanation`,
        evidence: [
          evidence,
          evidenceEntry({
            text: `Worked on ${topic} and ${otherTopicPref.topic}`,
            source: 'chat',
            refId,
          }),
        ],
        confidence: 0.85,
        status: 'active',
        meta: { style, errorType: null },
        source: 'chat',
        lastVerified: new Date(),
      });
      saved.push(plain(global));
    }
    updated.push(plain(raised1), plain(raised2));
  }

  return { saved, updated };
}

// Saved when the student says "I understood"
async function saveConceptUnderstood({ userId, topic, style, evidenceText, refId }) {
  const evidence = evidenceEntry({ text: evidenceText, source: 'chat', refId });

  const existing = await Memory.findOne({
    userId,
    type: 'concept_understood',
    topic,
    status: { $in: ['active', 'corrected'] },
  });

  if (existing) {
    const updated = await addEvidence(existing, evidence, 0.6);
    return { saved: [], updated: [plain(updated)] };
  }

  const created = await Memory.create({
    userId,
    type: 'concept_understood',
    topic,
    content: `Understood the basics of ${topic}`,
    evidence: [evidence],
    confidence: 0.6,
    status: 'active',
    meta: { style, errorType: null },
    source: 'chat',
    lastVerified: new Date(),
  });
  return { saved: [plain(created)], updated: [] };
}

// A "revise this soon" note. Auto-deleted after 7 days by the TTL index on expiresAt.
async function createRevisionNeeded({ userId, topic, reason }) {
  const existing = await Memory.findOne({ userId, type: 'revision_needed', topic, status: 'active' });
  if (existing) return { saved: [], updated: [] };

  const created = await Memory.create({
    userId,
    type: 'revision_needed',
    topic,
    content: `Revise ${topic} soon`,
    evidence: [evidenceEntry({ text: reason, source: 'practice' })],
    confidence: 0.5,
    status: 'active',
    meta: { style: null, errorType: null },
    source: 'practice',
    lastVerified: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return { saved: [plain(created)], updated: [] };
}

export {
  recordMistake,
  upsertWeakness,
  supersedeWeaknessIfEarned,
  supersedeWeakness,
  savePreference,
  saveConceptUnderstood,
  createRevisionNeeded,
};