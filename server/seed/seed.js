import mongoose from 'mongoose';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import TopicMastery from '../models/TopicMastery.js';
import CodingAttempt from '../models/CodingAttempt.js';
import { TOPICS } from '../constants.js';

export async function runSeedForUser(userId) {
  // Wipe existing user data
  await Memory.deleteMany({ userId });
  await TopicMastery.deleteMany({ userId });
  await CodingAttempt.deleteMany({ userId });

  // 1. Seed Topic Mastery for all 10 topics
  const masteryEntries = TOPICS.map(topic => {
    let score = 55;
    let attempts = 3;
    let history = [40, 50, 55];
    if (topic === 'recursion') {
      score = 42;
      attempts = 5;
      history = [30, 35, 42];
    } else if (topic === 'arrays') {
      score = 78;
      attempts = 6;
      history = [60, 70, 78];
    }
    return {
      userId,
      topic,
      masteryScore: score,
      attempts,
      lastPracticed: new Date(),
      history
    };
  });
  await TopicMastery.insertMany(masteryEntries);

  // 2. Seed Memories (9 seeded memories as defined in playbook)
  const seededMemories = [
    {
      userId,
      type: 'mistake',
      topic: 'recursion',
      content: 'Forgets the base case in recursive functions',
      evidence: [
        { text: 'sumDigits(n) had no stop for n === 0', source: 'practice', at: new Date(Date.now() - 3600000 * 24) }
      ],
      confidence: 0.7,
      status: 'active',
      meta: { errorType: 'wrong_base_case' },
      source: 'practice',
      useCount: 3,
      lastUsedAt: new Date(Date.now() - 3600000 * 2)
    },
    {
      userId,
      type: 'weakness',
      topic: 'recursion',
      content: 'Struggles with recursion termination conditions',
      evidence: [
        { text: 'Two consecutive attempts failed on recursion base condition', source: 'practice', at: new Date(Date.now() - 3600000 * 20) }
      ],
      confidence: 0.75,
      status: 'active',
      meta: { errorType: 'wrong_base_case' },
      source: 'practice'
    },
    {
      userId,
      type: 'learning_preference',
      topic: 'recursion',
      content: 'Understands better with visual diagrams and call stacks',
      evidence: [
        { text: 'Acknowledged visual explanation as understood', source: 'chat', at: new Date(Date.now() - 3600000 * 18) }
      ],
      confidence: 0.85,
      status: 'active',
      meta: { style: 'visual' },
      source: 'chat'
    },
    {
      userId,
      type: 'strength',
      topic: 'arrays',
      content: 'Proficient with two-pointer techniques on arrays',
      evidence: [
        { text: 'Solved binary search and two-sum on first try', source: 'practice', at: new Date(Date.now() - 3600000 * 48) }
      ],
      confidence: 0.9,
      status: 'active',
      source: 'practice'
    },
    {
      userId,
      type: 'concept_understood',
      topic: 'arrays',
      content: 'Understands array indexing and edge boundaries',
      evidence: [
        { text: 'Passed all boundary test cases on array search', source: 'practice', at: new Date(Date.now() - 3600000 * 40) }
      ],
      confidence: 0.8,
      status: 'active',
      source: 'practice'
    },
    {
      userId,
      type: 'revision_needed',
      topic: 'graphs',
      content: 'Review DFS reachability and cycle detection visited set',
      evidence: [
        { text: 'Attempt timed out on cyclic graph test case', source: 'practice', at: new Date(Date.now() - 3600000 * 12) }
      ],
      confidence: 0.65,
      status: 'active',
      expiresAt: new Date(Date.now() + 3600000 * 24 * 7), // 7 days TTL
      source: 'practice'
    },
    {
      userId,
      type: 'weakness',
      topic: 'strings',
      content: 'Misses non-alphanumeric character filtering in palindrome checks',
      evidence: [
        { text: 'Failed test case with punctuation marks', source: 'practice', at: new Date(Date.now() - 3600000 * 72) }
      ],
      confidence: 0.8,
      status: 'superseded',
      source: 'practice'
    },
    {
      userId,
      type: 'strength',
      topic: 'strings',
      content: 'Consistently cleans and normalizes strings before comparisons',
      evidence: [
        { text: 'Passed all string normalization tests across multiple problems', source: 'practice', at: new Date(Date.now() - 3600000 * 30) }
      ],
      confidence: 0.9,
      status: 'active',
      source: 'practice'
    },
    {
      userId,
      type: 'mistake',
      topic: 'trees',
      content: 'Forgets null check before accessing tree node left/right children',
      evidence: [
        { text: 'TypeError: Cannot read properties of null', source: 'practice', at: new Date(Date.now() - 3600000 * 10) }
      ],
      confidence: 0.5,
      status: 'active',
      meta: { errorType: 'wrong_base_case' },
      source: 'practice'
    }
  ];

  await Memory.insertMany(seededMemories);

  // 3. Seed Coding Attempts (past 8 attempts)
  const seededAttempts = [
    {
      userId,
      questionId: 'rec_sum_digits',
      topic: 'recursion',
      code: 'function sumDigits(n) { return (n % 10) + sumDigits(Math.floor(n / 10)); }',
      result: 'fail',
      errorType: 'wrong_base_case',
      explanation: 'Maximum call stack exceeded: missing stop condition for 0',
      testsPassed: 2,
      testsTotal: 5,
      timestamp: new Date(Date.now() - 3600000 * 24)
    },
    {
      userId,
      questionId: 'arr_binary_search',
      topic: 'arrays',
      code: 'function binarySearch(nums, target) { ... }',
      result: 'pass',
      errorType: 'none',
      explanation: 'All tests passed cleanly',
      testsPassed: 5,
      testsTotal: 5,
      timestamp: new Date(Date.now() - 3600000 * 48)
    }
  ];

  await CodingAttempt.insertMany(seededAttempts);

  return { ok: true, memoriesSeeded: seededMemories.length };
}
