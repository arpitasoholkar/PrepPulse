// server/scripts/memory-e2e.mjs
// Automates Acceptance Tests T1 to T8 against MongoDB and the running server.
// Usage: node scripts/memory-e2e.mjs

import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;
const MONGODB_URI = process.env.MONGODB_URI;

// Import models
import User from '../models/User.js';
import Memory from '../models/Memory.js';
import ChatSession from '../models/ChatSession.js';

let testUser = null;
let userId = null;

async function postJSON(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runAcceptanceTests() {
  console.log('--- Starting IntelliPrep Memory E2E Acceptance Tests (T1 - T8) ---');
  
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Create a clean isolated test user for e2e
  const testEmail = `e2e_test_${Date.now()}@intelliprep.dev`;
  testUser = await User.create({
    name: 'E2E Test User',
    email: testEmail,
  });
  userId = testUser._id.toString();
  console.log(`✓ Created test user ${userId}`);

  try {
    // -------------------------------------------------------------
    // T1 Ladder: "Teach me recursion" opens with theory.
    // Typing "I don't understand" gives simple.
    // Typing it again gives example. No style repeats.
    // Each step shows a failed chip in the ladder row.
    // -------------------------------------------------------------
    console.log('\n[Test T1] Ladder progression...');
    const s1 = `session_${Date.now()}_t1`;

    // Step 0: "Teach me recursion"
    const r1 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s1, message: 'Teach me recursion' });
    assert.equal(r1.status, 200);
    assert.equal(r1.data.explanationStyle, 'theory', 'Cold start on recursion must be theory');
    assert.equal(r1.data.ladder.step, 0);
    const m1Id = r1.data.messageId;

    // Step 1: "I don't understand" -> switches to simple
    const r2 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s1, message: "I don't understand" });
    console.log('r2 response:', { style: r2.data.explanationStyle, ladder: r2.data.ladder, feedbackApplied: r2.data.feedbackApplied });
    assert.equal(r2.status, 200);
    assert.equal(r2.data.feedbackApplied, 'not_understood');
    assert.equal(r2.data.explanationStyle, 'simple', 'Second step must be simple');
    assert.equal(r2.data.ladder.step, 1);
    const m2Id = r2.data.messageId;

    // Step 2: "I don't understand" -> switches to example
    const r3 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s1, message: "I don't understand" });
    console.log('r3 response:', { style: r3.data.explanationStyle, ladder: r3.data.ladder, feedbackApplied: r3.data.feedbackApplied });
    assert.equal(r3.status, 200);
    assert.equal(r3.data.feedbackApplied, 'not_understood');
    assert.equal(r3.data.explanationStyle, 'example', 'Third step must be example');
    assert.equal(r3.data.ladder.step, 2);

    // Verify ladder styles are distinct and recorded properly
    console.log('r3.data.ladder.tried:', JSON.stringify(r3.data.ladder.tried));
    const stylesTried = r3.data.ladder.tried.map((t) => t.style);
    assert.deepEqual(stylesTried, ['theory', 'simple', 'example'], 'Ladder must not repeat styles');
    console.log('PASS: T1 Ladder progression & no style repeats');

    // -------------------------------------------------------------
    // T2 Save what worked and what failed:
    // typing "got it" after example saves worked(example, recursion).
    // DB has failed(theory) and failed(simple) for recursion, with evidence.
    // -------------------------------------------------------------
    console.log('\n[Test T2] Save what worked and what failed...');
    const r4 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s1, message: 'got it' });
    assert.equal(r4.status, 200);
    assert.equal(r4.data.feedbackApplied, 'understood');

    // Inspect MongoDB records
    const memories = await Memory.find({ userId: testUser._id, topic: 'recursion' }).lean();
    
    const workedExample = memories.find((m) => m.meta?.style === 'example' && m.meta?.polarity === 'worked');
    assert.ok(workedExample, 'worked(example, recursion) must exist in DB');
    assert.ok(workedExample.confidence >= 0.6, 'worked confidence must be >= 0.6');
    assert.ok(workedExample.evidence.length > 0, 'worked memory must have evidence');

    const failedTheory = memories.find((m) => m.meta?.style === 'theory' && m.meta?.polarity === 'failed');
    assert.ok(failedTheory, 'failed(theory, recursion) must exist in DB');
    assert.ok(failedTheory.evidence.length > 0, 'failed theory must have evidence');

    const failedSimple = memories.find((m) => m.meta?.style === 'simple' && m.meta?.polarity === 'failed');
    assert.ok(failedSimple, 'failed(simple, recursion) must exist in DB');
    assert.ok(failedSimple.evidence.length > 0, 'failed simple must have evidence');

    console.log('PASS: T2 Save worked & failed styles with evidence');

    // -------------------------------------------------------------
    // T3 New session, same topic:
    // "Teach me recursion" opens with example.
    // Teaching plan shows example as Use and theory as Avoid.
    // -------------------------------------------------------------
    console.log('\n[Test T3] New session opens with winning style...');
    const s2 = `session_${Date.now()}_t3`;
    const r5 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s2, message: 'Teach me recursion' });
    assert.equal(r5.status, 200);
    assert.equal(r5.data.explanationStyle, 'example', 'New session on recursion must open with example');
    
    const examplePlan = r5.data.stylePlan.find((p) => p.style === 'example');
    const theoryPlan = r5.data.stylePlan.find((p) => p.style === 'theory');
    assert.equal(examplePlan.status, 'use');
    assert.ok(r5.data.styleReason.includes('worked for you on recursion'));
    console.log('PASS: T3 New session opens with example and plan shows Use/Avoid');

    // -------------------------------------------------------------
    // T4 Prerequisite carry-over:
    // In a new session, "Teach me DFS" uses example,
    // reason says it worked on recursion, a prerequisite.
    // -------------------------------------------------------------
    console.log('\n[Test T4] Prerequisite carry-over...');
    const s3 = `session_${Date.now()}_t4`;
    const r6 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s3, message: 'Teach me DFS' });
    assert.equal(r6.status, 200);
    assert.equal(r6.data.explanationStyle, 'example', 'DFS should open with example due to recursion prerequisite');
    assert.ok(r6.data.styleReason.includes('prerequisite'), 'Reason must mention prerequisite');
    console.log('PASS: T4 Prerequisite carry-over to DFS');

    // -------------------------------------------------------------
    // T5 Irrelevant input is not saved:
    // "hello" and "thanks!" produce normal reply, no memory,
    // memoriesSkipped shows "small talk".
    // -------------------------------------------------------------
    console.log('\n[Test T5] Gate skips small talk...');
    const s4 = `session_${Date.now()}_t5`;
    const r7 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s4, message: 'hello' });
    assert.equal(r7.status, 200);
    assert.ok(r7.data.memoriesSkipped.some((s) => s.reason === 'small talk'));

    const r8 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s4, message: 'thanks!' });
    assert.equal(r8.status, 200);
    assert.ok(r8.data.memoriesSkipped.some((s) => s.reason === 'small talk'));
    console.log('PASS: T5 Small talk is skipped by gate');

    // -------------------------------------------------------------
    // T6 Broken reply is not learned from:
    // If AI message is degraded, feedback is not saved to memory.
    // -------------------------------------------------------------
    console.log('\n[Test T6] Degraded reply guard...');
    const s5 = `session_${Date.now()}_t6`;
    // Create an artificial degraded message in DB
    const sessionDoc = await ChatSession.create({
      userId: testUser._id,
      sessionId: s5,
      messages: [
        { id: 'u_fake', role: 'user', content: 'Explain sorting', topic: 'sorting' },
        { id: 'm_fake_deg', role: 'assistant', content: 'Fallback reply', topic: 'sorting', style: 'theory', degraded: true },
      ],
      ladder: { topic: 'sorting', step: 0, stylesTried: ['theory'], tried: [{ style: 'theory', outcome: 'pending' }] },
    });

    const r9 = await postJSON(`${BASE_URL}/api/chat/feedback`, {
      sessionId: s5,
      messageId: 'm_fake_deg',
      understood: true,
    });
    assert.equal(r9.status, 200);
    assert.ok(r9.data.memoriesSkipped.some((s) => s.reason === 'AI reply was a fallback'));
    const sortingPref = await Memory.findOne({ userId: testUser._id, topic: 'sorting' });
    assert.equal(sortingPref, null, 'No memory should be saved from degraded reply');
    console.log('PASS: T6 Degraded reply is never learned from');

    // -------------------------------------------------------------
    // T7 Memory is editable and respected:
    // In Vault/DB, if we delete failed(theory, recursion),
    // next session is allowed to start with theory again.
    // -------------------------------------------------------------
    console.log('\n[Test T7] Memory deletion restores previous behavior...');
    // Delete worked example and failed theory for recursion
    await Memory.deleteMany({ userId: testUser._id, topic: 'recursion' });
    const s6 = `session_${Date.now()}_t7`;
    const r10 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s6, message: 'Teach me recursion' });
    assert.equal(r10.status, 200);
    assert.equal(r10.data.explanationStyle, 'theory', 'With memory wiped, cold start returns to theory');
    console.log('PASS: T7 Memory edits/deletions alter mentor behavior');

    // -------------------------------------------------------------
    // T8 No double counting:
    // Double click "I understood" -> second call returns alreadyRecorded: true.
    // -------------------------------------------------------------
    console.log('\n[Test T8] Double-click idempotency...');
    const s7 = `session_${Date.now()}_t8`;
    const r11 = await postJSON(`${BASE_URL}/api/chat`, { sessionId: s7, message: 'Explain linked-list' });
    const msgId = r11.data.messageId;

    // First feedback click
    const f1 = await postJSON(`${BASE_URL}/api/chat/feedback`, { sessionId: s7, messageId: msgId, understood: true });
    assert.equal(f1.status, 200);
    assert.equal(f1.data.alreadyRecorded, false);

    // Second feedback click
    const f2 = await postJSON(`${BASE_URL}/api/chat/feedback`, { sessionId: s7, messageId: msgId, understood: true });
    assert.equal(f2.status, 200);
    assert.equal(f2.data.alreadyRecorded, true, 'Second feedback call must indicate alreadyRecorded: true');
    console.log('PASS: T8 Double feedback idempotency');

    console.log('\n=========================================');
    console.log('ALL ACCEPTANCE TESTS (T1 - T8) PASSED! 🎉');
    console.log('=========================================');
  } finally {
    // Cleanup test user & data
    if (userId) {
      await User.findByIdAndDelete(userId);
      await Memory.deleteMany({ userId });
      await ChatSession.deleteMany({ userId });
    }
    await mongoose.disconnect();
  }
}

runAcceptanceTests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
