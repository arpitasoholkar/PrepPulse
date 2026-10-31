// server/memory/styles.js (Owner: C)
// Section 4: How the mentor picks a teaching style.
// Six styles: theory, simple, example, visual, analogy, dry_run.

import { Memory } from './deps.js';

export const EXPLANATION_STYLES = [
  'theory',
  'simple',
  'example',
  'visual',
  'analogy',
  'dry_run',
];

const DEFAULT_BONUS = {
  theory: 0.6,
  simple: 0.5,
  example: 0.4,
  visual: 0.3,
  analogy: 0.2,
  dry_run: 0.1,
};

// Prerequisite map: graphs, trees and dp need recursion
const PREREQUISITES = {
  graphs: ['recursion'],
  trees: ['recursion'],
  dp: ['recursion'],
};

export const STYLE_HUMAN_NAMES = {
  theory: 'theory',
  simple: 'simple',
  example: 'worked example',
  visual: 'visual',
  analogy: 'analogy',
  dry_run: 'dry run',
};

/**
 * Scores and ranks styles for a given user, topic, and session tried list.
 * Can accept optional `memories` array for offline testing without DB.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId
 * @param {string} params.topic
 * @param {Array<string>} [params.tried=[]] - Styles already tried in this session
 * @param {Array<Object>} [params.memories] - Optional pre-loaded memories (for testing)
 * @returns {Promise<{ style: string, reason: string, stylePlan: Array<Object>, exhausted: boolean }>}
 */
export async function rankStyles({ userId, topic, tried = [], memories = null }) {
  const triedSet = new Set(tried || []);

  // 1. Fetch relevant learning_preference memories if not provided
  let userMemories = memories;
  if (!userMemories && userId) {
    userMemories = await Memory.find({
      userId,
      type: 'learning_preference',
      status: { $in: ['active', 'corrected'] },
    }).lean();
  }
  userMemories = userMemories || [];

  // Filter out superseded memories
  userMemories = userMemories.filter((m) => m.status !== 'superseded');

  // Helper to find memories matching style, topic, and polarity
  const findMemory = (style, topicFilter, polarity) => {
    return userMemories.find((m) => {
      const memStyle = m.meta?.style;
      const memPolarity = m.meta?.polarity || (polarity === 'worked' ? 'worked' : null);
      if (memStyle !== style) return false;
      if (topicFilter === '*') return m.topic === '*';
      if (Array.isArray(topicFilter)) return topicFilter.includes(m.topic);
      return m.topic === topicFilter;
    });
  };

  const prereqTopics = PREREQUISITES[topic] || [];

  // 2. Score each of the 6 styles
  const scored = EXPLANATION_STYLES.map((style) => {
    let score = DEFAULT_BONUS[style] || 0;
    const isTried = triedSet.has(style);

    // Worked memory on this topic: +3 * confidence
    const workedTopicMem = userMemories.find(
      (m) => m.meta?.style === style && m.topic === topic && (m.meta?.polarity === 'worked' || !m.meta?.polarity)
    );
    if (workedTopicMem) {
      score += 3 * (workedTopicMem.confidence || 0.6);
    }

    // Worked memory on a prerequisite topic: +2 * confidence
    let workedPrereqMem = null;
    if (prereqTopics.length > 0) {
      workedPrereqMem = userMemories.find(
        (m) => m.meta?.style === style && prereqTopics.includes(m.topic) && (m.meta?.polarity === 'worked' || !m.meta?.polarity)
      );
      if (workedPrereqMem) {
        score += 2 * (workedPrereqMem.confidence || 0.6);
      }
    }

    // Global worked memory (topic: "*"): +1.5 * confidence
    const globalWorkedMem = userMemories.find(
      (m) => m.meta?.style === style && m.topic === '*' && (m.meta?.polarity === 'worked' || !m.meta?.polarity)
    );
    if (globalWorkedMem) {
      score += 1.5 * (globalWorkedMem.confidence || 0.6);
    }

    // Failed memory on this topic
    const failedTopicMem = userMemories.find(
      (m) => m.meta?.style === style && m.topic === topic && m.meta?.polarity === 'failed'
    );
    if (failedTopicMem) {
      const conf = failedTopicMem.confidence || 0.4;
      if (conf >= 0.6) {
        score -= 4; // avoid
      } else {
        score -= 2; // tentative
      }
    }

    // Global failed memory: -2
    const globalFailedMem = userMemories.find(
      (m) => m.meta?.style === style && m.topic === '*' && m.meta?.polarity === 'failed'
    );
    if (globalFailedMem) {
      score -= 2;
    }

    // Status: use, avoid, or untried
    let status = 'untried';
    let planReason = 'No data yet';

    if (workedTopicMem) {
      const support = workedTopicMem.meta?.support || 1;
      status = 'use';
      planReason = `Worked for you on ${topic} (${support} time${support > 1 ? 's' : ''})`;
    } else if (workedPrereqMem) {
      status = 'use';
      planReason = `Worked for you on ${workedPrereqMem.topic}, a prerequisite of ${topic}`;
    } else if (globalWorkedMem) {
      status = 'use';
      planReason = 'Worked well across topics';
    } else if (failedTopicMem) {
      const conf = failedTopicMem.confidence || 0.4;
      if (conf >= 0.6) {
        status = 'avoid';
        planReason = `Did not work for you on ${topic}`;
      } else {
        status = 'avoid';
        planReason = `Tentatively did not work on ${topic}`;
      }
    } else if (globalFailedMem) {
      status = 'avoid';
      planReason = 'Often did not work across topics';
    }

    return {
      style,
      score,
      isTried,
      status,
      planReason,
      workedTopicMem,
      workedPrereqMem,
      failedTopicMem,
    };
  });

  // Build stylePlan array for the response
  const stylePlan = scored.map((s) => ({
    style: s.style,
    status: s.status,
    reason: s.planReason,
  }));

  // Check if ladder is exhausted
  const untried = scored.filter((s) => !s.isTried);
  if (untried.length === 0) {
    return {
      style: null,
      reason: 'Ladder exhausted: all styles have been tried for this topic.',
      stylePlan,
      exhausted: true,
    };
  }

  // Sort untried by score descending
  untried.sort((a, b) => b.score - a.score);

  // Skip avoid styles unless nothing else is left
  const nonAvoidUntried = untried.filter((s) => s.status !== 'avoid');
  const chosen = nonAvoidUntried.length > 0 ? nonAvoidUntried[0] : untried[0];

  // Build reason string for chosen style
  let reason = '';
  const styleName = STYLE_HUMAN_NAMES[chosen.style] || chosen.style;

  if (chosen.workedTopicMem) {
    const support = chosen.workedTopicMem.meta?.support || 1;
    reason = `Started with a ${styleName} because it worked for you on ${topic} (${support} time${support > 1 ? 's' : ''}).`;
  } else if (chosen.workedPrereqMem) {
    reason = `Started with a ${styleName} because it worked for you on ${chosen.workedPrereqMem.topic}, a prerequisite of ${topic}.`;
  } else if (tried.length > 0) {
    const lastTried = tried[tried.length - 1];
    const avoidMem = scored.find((s) => s.style === lastTried && s.status === 'avoid');
    if (avoidMem) {
      reason = `Skipping ${lastTried}: it did not work for you on ${topic}. Switching to ${styleName}.`;
    } else {
      reason = `Switched to ${styleName} because the previous explanation did not land.`;
    }
  } else {
    reason = `No saved preference yet, starting with ${styleName}.`;
  }

  return {
    style: chosen.style,
    reason,
    stylePlan,
    exhausted: false,
  };
}
