// server/memory/quiz.js
// Turns the result of one check question into long-term memories.
//   wrong / partial -> mistake (0.4). Same concept wrong again -> weakness (0.7).
//   correct         -> concept_understood for that concept; a weakness on it is
//                      superseded after the second correct answer.
// Everything goes through the same gate as every other memory write.

import { Memory } from './deps.js';
import { shouldSave } from './gate.js';

const plain = (doc) => (doc && doc.toObject ? doc.toObject() : doc);

const evidenceEntry = (text, refId) => ({
  text: String(text).slice(0, 240),
  source: 'chat',
  refId: refId ? String(refId) : null,
  at: new Date(),
});

async function addEvidence(mem, evidence, newConfidence) {
  const set = { lastVerified: new Date() };
  // A memory the student corrected by hand is never overwritten, only given evidence.
  if (newConfidence && mem.status !== 'corrected') {
    set.confidence = Math.max(mem.confidence || 0, newConfidence);
  }
  return Memory.findByIdAndUpdate(mem._id, { $push: { evidence }, $set: set }, { new: true });
}

const find = (userId, type, topic, concept, statuses = ['active', 'corrected']) =>
  Memory.findOne({ userId, type, topic, 'meta.concept': concept, status: { $in: statuses } });

/**
 * @returns {Promise<{ saved: object[], updated: object[], skipped: object[] }>}
 */
export async function recordQuizOutcome({ userId, topic, verdict, concept, question, refId }) {
  const saved = [];
  const updated = [];
  const skipped = [];

  const label = (concept || topic || '').trim().toLowerCase();
  const evidenceText = `Check question "${String(question || '').slice(0, 90)}" -> answered ${verdict}`;

  const type = verdict === 'correct' ? 'concept_understood' : 'mistake';
  const gate = shouldSave({ userId, type, topic, evidenceText, aboutLearning: true, importance: 3 });
  if (!gate.ok) {
    skipped.push({ text: evidenceText, reason: gate.reason });
    return { saved, updated, skipped };
  }

  const evidence = evidenceEntry(evidenceText, refId);

  if (verdict === 'correct') {
    // 1. concept_understood, per concept
    const understood = await find(userId, 'concept_understood', topic, label);
    let understoodDoc = understood;
    if (understood) {
      understoodDoc = await addEvidence(understood, evidence, Math.min(0.9, (understood.confidence || 0.6) + 0.1));
      updated.push(plain(understoodDoc));
    } else {
      understoodDoc = await Memory.create({
        userId,
        type: 'concept_understood',
        topic,
        content: `Understood ${label} in ${topic}`,
        evidence: [evidence],
        confidence: 0.6,
        status: 'active',
        meta: { concept: label, kind: 'quiz' },
        source: 'chat',
        lastVerified: new Date(),
      });
      saved.push(plain(understoodDoc));
    }

    // 2. an earlier mistake / weakness on this concept gets evidence of progress
    const mistake = await find(userId, 'mistake', topic, label, ['active']);
    if (mistake) updated.push(plain(await addEvidence(mistake, evidence)));

    const weakness = await find(userId, 'weakness', topic, label, ['active']);
    if (weakness) {
      const correctCount = (understoodDoc?.evidence || []).length;
      if (correctCount >= 2) {
        const strength = await Memory.create({
          userId,
          type: 'strength',
          topic,
          content: `Now answers ${label} questions correctly in ${topic}`,
          evidence: [evidence],
          confidence: 0.6,
          status: 'active',
          meta: { concept: label, kind: 'quiz' },
          source: 'chat',
          lastVerified: new Date(),
        });
        const done = await Memory.findByIdAndUpdate(
          weakness._id,
          {
            $set: { status: 'superseded', supersededBy: strength._id, lastVerified: new Date() },
            $push: { evidence },
          },
          { new: true }
        );
        saved.push(plain(strength));
        updated.push(plain(done));
      } else {
        updated.push(plain(await addEvidence(weakness, evidence)));
      }
    }
    return { saved, updated, skipped };
  }

  // wrong or partial
  const existing = await find(userId, 'mistake', topic, label);
  if (!existing) {
    const created = await Memory.create({
      userId,
      type: 'mistake',
      topic,
      content: `Got "${label}" ${verdict === 'partial' ? 'partly wrong' : 'wrong'} in ${topic} check questions`,
      evidence: [evidence],
      confidence: 0.4,
      status: 'active',
      meta: { concept: label, kind: 'quiz', errorType: null },
      source: 'chat',
      lastVerified: new Date(),
    });
    saved.push(plain(created));
    return { saved, updated, skipped };
  }

  updated.push(plain(await addEvidence(existing, evidence, 0.7)));

  // Same concept missed again -> a real weakness
  const weak = await find(userId, 'weakness', topic, label);
  if (weak) {
    updated.push(plain(await addEvidence(weak, evidence, 0.7)));
  } else {
    const created = await Memory.create({
      userId,
      type: 'weakness',
      topic,
      content: `Struggles with ${label} in ${topic}`,
      evidence: [evidence],
      confidence: 0.7,
      status: 'active',
      meta: { concept: label, kind: 'quiz', errorType: null },
      source: 'chat',
      lastVerified: new Date(),
    });
    saved.push(plain(created));
  }
  return { saved, updated, skipped };
}
