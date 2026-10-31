// server/memory/lifecycle.js  (Owner: C)
// ALL memory rules from section 6.4 live here. Routes only call these functions.
// Golden rule: a memory with status "corrected" is NEVER overwritten, we only add evidence.

import { Memory, CodingAttempt } from './deps.js';
import { shouldSave } from './gate.js';
import { STYLE_HUMAN_NAMES } from './styles.js';

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

/**
 * Section 3.1 & Section 8:
 * recordStyleOutcome({ userId, topic, style, outcome, evidenceText, refId, degraded, alreadyRecorded })
 *
 * Implements the full write rules for style memories:
 * - outcome: "failed":
 *     upsert failed(style, topic)
 *     1st signal: confidence 0.4, tentative: true, expiresAt = now + 3 days
 *     2nd signal: confidence 0.6, tentative: false, expiresAt = null
 *     3rd+ signal: confidence 0.75
 *     If an active worked(style, topic) exists: subtract 0.25, increment contradict count.
 *     If confidence drops below 0.3, supersede it with failed(style, topic).
 *
 * - outcome: "worked":
 *     upsert worked(style, topic)
 *     1st signal: confidence 0.6
 *     2nd signal: confidence 0.75
 *     3rd+ signal: confidence 0.9 (cap)
 *     Supersedes any active failed(style, topic) (supersededBy = new memory).
 *
 * - Global generalization:
 *     Same style worked on 2 different topics -> create/raise global worked(style, "*") (0.85)
 *     Same style failed on 2 different topics -> create/raise global failed(style, "*") (0.7)
 *
 * - Integrity:
 *     Corrected memories are never overwritten (evidence appended only).
 *     Every write passes through shouldSave.
 *
 * Returns { saved: [], updated: [], skipped: [] }
 */
export async function recordStyleOutcome({
  userId,
  topic,
  style,
  outcome, // 'worked' or 'failed'
  evidenceText,
  refId,
  degraded = false,
  alreadyRecorded = false,
}) {
  const saved = [];
  const updated = [];
  const skipped = [];

  // Default topic if none provided
  const targetTopic = topic || '*';

  // Check gate
  const gateCheck = shouldSave({
    userId,
    type: 'learning_preference',
    topic: targetTopic,
    style,
    evidenceText,
    refId,
    degraded,
    alreadyRecorded,
  });

  if (!gateCheck.ok) {
    skipped.push({ text: evidenceText || `${outcome} on ${style}`, reason: gateCheck.reason });
    return { saved, updated, skipped };
  }

  const evidence = evidenceEntry({ text: evidenceText, source: 'chat', refId });
  const styleDisplay = STYLE_HUMAN_NAMES[style] || (style ? style.replace('_', ' ') : 'teaching');

  if (outcome === 'failed') {
    // 1. Check if an active worked memory exists for this style & topic
    const activeWorked = await Memory.findOne({
      userId,
      type: 'learning_preference',
      topic: targetTopic,
      'meta.style': style,
      'meta.polarity': 'worked',
      status: { $in: ['active', 'corrected'] },
    });

    if (activeWorked) {
      if (activeWorked.status === 'corrected') {
        const up = await addEvidence(activeWorked, evidence);
        updated.push(plain(up));
      } else {
        const newConf = Math.max(0, (activeWorked.confidence || 0.6) - 0.25);
        const contradictCount = (activeWorked.meta?.contradict || 0) + 1;

        if (newConf < 0.3) {
          // Supersede with failed memory
          const failedMem = await Memory.create({
            userId,
            type: 'learning_preference',
            topic: targetTopic,
            content: `${styleDisplay.charAt(0).toUpperCase() + styleDisplay.slice(1)} explanations did not work for ${targetTopic}`,
            evidence: [evidence],
            confidence: 0.4,
            status: 'active',
            meta: {
              style,
              polarity: 'failed',
              tentative: true,
              support: 1,
              contradict: 0,
            },
            source: 'chat',
            lastVerified: new Date(),
            expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          });
          saved.push(plain(failedMem));

          const superseded = await Memory.findByIdAndUpdate(
            activeWorked._id,
            {
              $set: {
                status: 'superseded',
                supersededBy: failedMem._id,
                confidence: newConf,
                'meta.contradict': contradictCount,
                lastVerified: new Date(),
              },
              $push: { evidence },
            },
            { new: true }
          );
          updated.push(plain(superseded));
        } else {
          // Lower confidence and add contradict count
          const lowered = await Memory.findByIdAndUpdate(
            activeWorked._id,
            {
              $set: {
                confidence: newConf,
                'meta.contradict': contradictCount,
                lastVerified: new Date(),
              },
              $push: { evidence },
            },
            { new: true }
          );
          updated.push(plain(lowered));
        }
      }
    } else {
      // Upsert failed(style, topic)
      let failedMem = await Memory.findOne({
        userId,
        type: 'learning_preference',
        topic: targetTopic,
        'meta.style': style,
        'meta.polarity': 'failed',
        status: { $in: ['active', 'corrected'] },
      });

      if (failedMem) {
        if (failedMem.status === 'corrected') {
          failedMem = await addEvidence(failedMem, evidence);
          updated.push(plain(failedMem));
        } else {
          const currentSupport = (failedMem.meta?.support || 1) + 1;
          const nextConf = currentSupport === 2 ? 0.6 : 0.75;
          const setFields = {
            confidence: nextConf,
            'meta.support': currentSupport,
            'meta.tentative': false,
            expiresAt: null, // Cleared on 2nd signal
            lastVerified: new Date(),
          };
          failedMem = await Memory.findByIdAndUpdate(
            failedMem._id,
            { $set: setFields, $push: { evidence } },
            { new: true }
          );
          updated.push(plain(failedMem));
        }
      } else {
        failedMem = await Memory.create({
          userId,
          type: 'learning_preference',
          topic: targetTopic,
          content: `${styleDisplay.charAt(0).toUpperCase() + styleDisplay.slice(1)} explanations did not work for ${targetTopic}`,
          evidence: [evidence],
          confidence: 0.4,
          status: 'active',
          meta: {
            style,
            polarity: 'failed',
            tentative: true,
            support: 1,
            contradict: 0,
          },
          source: 'chat',
          lastVerified: new Date(),
          expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days TTL
        });
        saved.push(plain(failedMem));
      }
    }

    // Global failed rule: same style failed on 2 different topics -> create global failed(style, "*")
    if (targetTopic !== '*') {
      const otherFailed = await Memory.find({
        userId,
        type: 'learning_preference',
        'meta.style': style,
        'meta.polarity': 'failed',
        topic: { $nin: [targetTopic, '*'] },
        status: { $in: ['active', 'corrected'] },
      });

      if (otherFailed.length > 0) {
        let globalFailed = await Memory.findOne({
          userId,
          type: 'learning_preference',
          topic: '*',
          'meta.style': style,
          'meta.polarity': 'failed',
          status: { $in: ['active', 'corrected'] },
        });

        if (globalFailed) {
          if (globalFailed.status !== 'corrected') {
            globalFailed = await Memory.findByIdAndUpdate(
              globalFailed._id,
              {
                $set: { confidence: 0.7, lastVerified: new Date() },
                $push: { evidence },
              },
              { new: true }
            );
          }
          updated.push(plain(globalFailed));
        } else {
          globalFailed = await Memory.create({
            userId,
            type: 'learning_preference',
            topic: '*',
            content: `${styleDisplay.charAt(0).toUpperCase() + styleDisplay.slice(1)} explanations generally did not work across topics`,
            evidence: [
              evidence,
              evidenceEntry({
                text: `Failed on ${targetTopic} and ${otherFailed[0].topic}`,
                source: 'chat',
                refId,
              }),
            ],
            confidence: 0.7,
            status: 'active',
            meta: {
              style,
              polarity: 'failed',
              tentative: false,
              support: 2,
              contradict: 0,
            },
            source: 'chat',
            lastVerified: new Date(),
          });
          saved.push(plain(globalFailed));
        }
      }
    }
  } else if (outcome === 'worked') {
    // 1. Upsert worked(style, topic)
    let workedMem = await Memory.findOne({
      userId,
      type: 'learning_preference',
      topic: targetTopic,
      'meta.style': style,
      'meta.polarity': 'worked',
      status: { $in: ['active', 'corrected'] },
    });

    let newWorkedCreated = null;

    if (workedMem) {
      if (workedMem.status === 'corrected') {
        workedMem = await addEvidence(workedMem, evidence);
        updated.push(plain(workedMem));
      } else {
        const currentSupport = (workedMem.meta?.support || 1) + 1;
        const nextConf = currentSupport === 2 ? 0.75 : 0.9; // Cap at 0.9
        workedMem = await Memory.findByIdAndUpdate(
          workedMem._id,
          {
            $set: {
              confidence: nextConf,
              'meta.support': currentSupport,
              'meta.tentative': false,
              expiresAt: null,
              lastVerified: new Date(),
            },
            $push: { evidence },
          },
          { new: true }
        );
        updated.push(plain(workedMem));
      }
    } else {
      workedMem = await Memory.create({
        userId,
        type: 'learning_preference',
        topic: targetTopic,
        content: `Understands ${targetTopic} best with a ${styleDisplay} explanation`,
        evidence: [evidence],
        confidence: 0.6,
        status: 'active',
        meta: {
          style,
          polarity: 'worked',
          tentative: false,
          support: 1,
          contradict: 0,
        },
        source: 'chat',
        lastVerified: new Date(),
        expiresAt: null,
      });
      newWorkedCreated = workedMem;
      saved.push(plain(workedMem));
    }

    // 2. If an active failed(style, topic) exists, supersede it
    const activeFailed = await Memory.findOne({
      userId,
      type: 'learning_preference',
      topic: targetTopic,
      'meta.style': style,
      'meta.polarity': 'failed',
      status: 'active',
    });

    if (activeFailed) {
      const replacingId = (newWorkedCreated || workedMem)._id;
      const supersededFailed = await Memory.findByIdAndUpdate(
        activeFailed._id,
        {
          $set: {
            status: 'superseded',
            supersededBy: replacingId,
            lastVerified: new Date(),
          },
          $push: { evidence },
        },
        { new: true }
      );
      updated.push(plain(supersededFailed));
    }

    // 3. Global worked rule: same style worked on 2 different topics -> create/raise global worked(style, "*")
    if (targetTopic !== '*') {
      const otherWorked = await Memory.find({
        userId,
        type: 'learning_preference',
        'meta.style': style,
        'meta.polarity': 'worked',
        topic: { $nin: [targetTopic, '*'] },
        status: { $in: ['active', 'corrected'] },
      });

      if (otherWorked.length > 0) {
        let globalWorked = await Memory.findOne({
          userId,
          type: 'learning_preference',
          topic: '*',
          'meta.style': style,
          'meta.polarity': 'worked',
          status: { $in: ['active', 'corrected'] },
        });

        if (globalWorked) {
          if (globalWorked.status !== 'corrected') {
            globalWorked = await Memory.findByIdAndUpdate(
              globalWorked._id,
              {
                $set: { confidence: 0.85, lastVerified: new Date() },
                $push: { evidence },
              },
              { new: true }
            );
          }
          updated.push(plain(globalWorked));
        } else {
          globalWorked = await Memory.create({
            userId,
            type: 'learning_preference',
            topic: '*',
            content: `Understands most topics best with a ${styleDisplay} explanation`,
            evidence: [
              evidence,
              evidenceEntry({
                text: `Worked on ${targetTopic} and ${otherWorked[0].topic}`,
                source: 'chat',
                refId,
              }),
            ],
            confidence: 0.85,
            status: 'active',
            meta: {
              style,
              polarity: 'worked',
              tentative: false,
              support: 2,
              contradict: 0,
            },
            source: 'chat',
            lastVerified: new Date(),
          });
          saved.push(plain(globalWorked));
        }
      }
    }
  }

  return { saved, updated, skipped };
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
