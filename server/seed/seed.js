import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import TopicMastery from '../models/TopicMastery.js';
import CodingAttempt from '../models/CodingAttempt.js';
import ChatSession from '../models/ChatSession.js';
import Activity from '../models/Activity.js';
import { dayKey, addDays } from '../gamification/streak.js';
import { evaluateBadges } from '../gamification/service.js';
import { TOPICS } from '../constants.js';
import { connectDB } from '../db.js';

/**
 * Populates demo baseline data for a given user:
 * - Mastery records for all 10 topics
 * - 9 baseline memories (recursion weakness, visual preference, strong arrays, near-expiry revision_needed, superseded weakness)
 * - 8 past coding attempts
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ ok: boolean, memoriesSeeded: number, masteriesSeeded: number, attemptsSeeded: number }>}
 */
export async function seedUser(userId) {
  // Wipe existing user data across collections to run safely
  await Promise.all([
    Memory.deleteMany({ userId }),
    TopicMastery.deleteMany({ userId }),
    CodingAttempt.deleteMany({ userId }),
    ChatSession.deleteMany({ userId }),
    Activity.deleteMany({ userId })
  ]);
  await User.updateOne({ _id: userId }, { $set: { badges: [], longestStreak: 0 } });

  // 1. Seed Topic Mastery for all 10 canonical topics
  const masteryEntries = TOPICS.map(topic => {
    let score = 55;
    let attempts = 3;
    let history = [40, 50, 55];

    if (topic === 'arrays') {
      score = 78;
      attempts = 6;
      history = [60, 70, 78];
    } else if (topic === 'strings') {
      score = 65;
      attempts = 4;
      history = [45, 55, 65];
    } else if (topic === 'linked-list') {
      score = 70;
      attempts = 4;
      history = [50, 60, 70];
    } else if (topic === 'stacks-queues') {
      score = 72;
      attempts = 4;
      history = [55, 65, 72];
    } else if (topic === 'hashing') {
      score = 60;
      attempts = 3;
      history = [40, 50, 60];
    } else if (topic === 'sorting') {
      score = 58;
      attempts = 3;
      history = [45, 52, 58];
    } else if (topic === 'recursion') {
      score = 42;
      attempts = 5;
      history = [30, 35, 42];
    } else if (topic === 'trees') {
      score = 38;
      attempts = 4;
      history = [25, 30, 38];
    } else if (topic === 'graphs') {
      score = 35;
      attempts = 3;
      history = [20, 28, 35];
    } else if (topic === 'dp') {
      score = 45;
      attempts = 3;
      history = [30, 38, 45];
    }

    return {
      userId,
      topic,
      masteryScore: score,
      attempts,
      lastPracticed: new Date(Date.now() - 3600000 * (attempts * 4)),
      history
    };
  });

  await TopicMastery.insertMany(masteryEntries);

  // 2. Seed 9 Baseline Memories
  const stringStrengthId = new mongoose.Types.ObjectId();

  const seededMemories = [
    // 1. Weak recursion base case mistake memory
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
    // 2. Weakness on recursion termination conditions
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
    // 3. Visual learning preference on recursion
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
    // 4. Strong arrays topic (proficient two-pointer)
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
    // 5. Concept understood on arrays
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
    // 6. Near-expiry revision_needed memory (expires in ~6 hours)
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
      expiresAt: new Date(Date.now() + 3600000 * 6), // 6 hours TTL remaining (near-expiry)
      source: 'practice'
    },
    // 7. Superseded weakness on strings
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
      supersededBy: stringStrengthId,
      source: 'practice'
    },
    // 8. Active strength memory replacing the superseded weakness
    {
      _id: stringStrengthId,
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
    // 9. Trees mistake memory
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

  // 3. Seed 8 Past Coding Attempts
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
      code: 'function binarySearch(nums, target) {\n  let l = 0, r = nums.length - 1;\n  while (l <= r) {\n    let m = Math.floor((l + r) / 2);\n    if (nums[m] === target) return m;\n    if (nums[m] < target) l = m + 1;\n    else r = m - 1;\n  }\n  return -1;\n}',
      result: 'pass',
      errorType: 'none',
      explanation: 'All boundary and midpoint tests passed cleanly',
      testsPassed: 5,
      testsTotal: 5,
      timestamp: new Date(Date.now() - 3600000 * 22)
    },
    {
      userId,
      questionId: 'str_palindrome',
      topic: 'strings',
      code: 'function isPalindrome(s) {\n  let clean = s.toLowerCase();\n  return clean === clean.split("").reverse().join("");\n}',
      result: 'fail',
      errorType: 'edge_case_missed',
      explanation: 'Failed when punctuation or non-alphanumeric chars present',
      testsPassed: 3,
      testsTotal: 5,
      timestamp: new Date(Date.now() - 3600000 * 20)
    },
    {
      userId,
      questionId: 'str_palindrome',
      topic: 'strings',
      code: 'function isPalindrome(s) {\n  let clean = s.toLowerCase().replace(/[^a-z0-9]/g, "");\n  return clean === clean.split("").reverse().join("");\n}',
      result: 'pass',
      errorType: 'none',
      explanation: 'Correct alphanumeric filtering and boundary handling',
      testsPassed: 5,
      testsTotal: 5,
      timestamp: new Date(Date.now() - 3600000 * 18)
    },
    {
      userId,
      questionId: 'tree_max_depth',
      topic: 'trees',
      code: 'function maxDepth(root) {\n  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));\n}',
      result: 'fail',
      errorType: 'wrong_base_case',
      explanation: 'TypeError: Cannot read properties of null (reading left)',
      testsPassed: 1,
      testsTotal: 4,
      timestamp: new Date(Date.now() - 3600000 * 14)
    },
    {
      userId,
      questionId: 'll_reverse',
      topic: 'linked-list',
      code: 'function reverseList(head) {\n  let prev = null, curr = head;\n  while (curr) {\n    let next = curr.next;\n    curr.next = prev;\n    prev = curr;\n    curr = next;\n  }\n  return prev;\n}',
      result: 'pass',
      errorType: 'none',
      explanation: 'In-place linked list reversal with null boundary check passed',
      testsPassed: 4,
      testsTotal: 4,
      timestamp: new Date(Date.now() - 3600000 * 10)
    },
    {
      userId,
      questionId: 'stack_valid_parens',
      topic: 'stacks-queues',
      code: 'function isValid(s) {\n  const stack = [];\n  const map = { ")": "(", "}": "{", "]": "[" };\n  for (const c of s) {\n    if (map[c]) {\n      if (stack.pop() !== map[c]) return false;\n    } else {\n      stack.push(c);\n    }\n  }\n  return stack.length === 0;\n}',
      result: 'pass',
      errorType: 'none',
      explanation: 'Proper stack bracket matching with balanced check',
      testsPassed: 6,
      testsTotal: 6,
      timestamp: new Date(Date.now() - 3600000 * 6)
    },
    {
      userId,
      questionId: 'dp_climbing_stairs',
      topic: 'dp',
      code: 'function climbStairs(n) {\n  let dp = [1, 2];\n  for (let i = 2; i <= n; i++) dp[i] = dp[i-1] + dp[i-2];\n  return dp[n];\n}',
      result: 'fail',
      errorType: 'off_by_one',
      explanation: 'Off-by-one indexing on boundary case n = 1',
      testsPassed: 2,
      testsTotal: 4,
      timestamp: new Date(Date.now() - 3600000 * 2)
    }
  ];

  await CodingAttempt.insertMany(seededAttempts);

  // 4. Seed a week of activity so the calendar, hours chart and streak look alive.
  // Days are UTC based; the app re-evaluates against the real local day on the next request.
  const todayKey = dayKey(0);
  const pattern = [
    { ago: 8, min: 0,  attempts: 0, passes: 0, chats: 0 }, // a gap, so the streak starts after it
    { ago: 6, min: 35, attempts: 1, passes: 1, chats: 2 },
    { ago: 5, min: 50, attempts: 2, passes: 1, chats: 1 },
    { ago: 4, min: 20, attempts: 1, passes: 0, chats: 3 },
    { ago: 3, min: 75, attempts: 2, passes: 2, chats: 1 },
    { ago: 2, min: 40, attempts: 1, passes: 1, chats: 2 },
    { ago: 1, min: 55, attempts: 2, passes: 1, chats: 1 },
    { ago: 0, min: 12, attempts: 1, passes: 0, chats: 1 }
  ].filter(p => p.min > 0);
  await Activity.insertMany(pattern.map(p => ({
    userId,
    day: addDays(todayKey, -p.ago),
    seconds: p.min * 60,
    attempts: p.attempts,
    passes: p.passes,
    chats: p.chats
  })));
  await evaluateBadges(userId, todayKey);

  return {
    ok: true,
    memoriesSeeded: seededMemories.length,
    masteriesSeeded: masteryEntries.length,
    attemptsSeeded: seededAttempts.length
  };
}

// Alias for backwards compatibility
export const runSeedForUser = seedUser;

// Standalone CLI runner (e.g. `npm run seed`)
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  dotenv.config();
  (async () => {
    try {
      console.log('Connecting to database for seeding...');
      await connectDB();

      // Ensure demo user exists
      let demoUser = await User.findOne({ email: 'demo@intelliprep.dev' });
      if (!demoUser) {
        demoUser = await User.create({
          name: 'Demo Student',
          email: 'demo@intelliprep.dev',
          targetRole: 'SDE'
        });
        console.log(`Created demo user: ${demoUser._id}`);
      } else {
        console.log(`Found existing demo user: ${demoUser._id}`);
      }

      const result = await seedUser(demoUser._id);
      console.log('Seed completed successfully:', result);
      await mongoose.disconnect();
      process.exit(0);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  })();
}

export default seedUser;
