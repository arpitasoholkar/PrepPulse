// Run with: node --test server/memory/intent.test.mjs   (or: cd server && node --test memory/)
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFeedbackIntent } from './intent.js';

const NU = 'not_understood';
const U = 'understood';

const cases = [
  // not_understood
  ["I don't understand", NU],
  ["i dont understand", NU],
  ["I didn’t understand that", NU],
  ["dont get it", NU],
  ["I can't follow", NU],
  ["didn't follow", NU],
  ["still confused", NU],
  ["this is confusing", NU],
  ["not clear", NU],
  ["That's not clear", NU],
  ["I'm lost", NU],
  ["im totally lost", NU],
  ["you lost me", NU],
  ["explain differently", NU],
  ["Explain it again please", NU],
  ["try another way", NU],
  ["can you say it simpler", NU],
  ["that doesn't make sense", NU],
  ["makes no sense", NU],
  ["that didn't help", NU],
  ["I never understood this", NU],
  ["I do not really get it", NU],
  ["not sure I get it", NU],
  ["I still don't get it, sorry", NU],
  ["too complicated", NU],

  // understood
  ["got it", U],
  ["Got it!", U],
  ["understood", U],
  ["I understand now", U],
  ["makes sense", U],
  ["that makes sense", U],
  ["clear now", U],
  ["I get it now", U],
  ["ok that helps", U],
  ["thanks, that's clear", U],
  ["oh I see", U],
  ["Ahh got it, thanks a lot", U],
  ["crystal clear", U],

  // null: small talk
  ["thanks", null],
  ["thanks!", null],
  ["ok", null],
  ["hello", null],
  ["hi there", null],
  ["cool", null],

  // null: new questions
  ["Explain recursion", null],
  ["Teach me DFS", null],
  ["what is a base case", null],
  ["how does binary search work", null],
  ["got it, now teach me DFS", null],

  // null: question, ambiguous, or empty
  ["does that make sense?", null],
  ["is it clear now?", null],
  ["", null],
  ["   ", null],
];

for (const [message, expected] of cases) {
  test(`${JSON.stringify(message)} -> ${expected}`, () => {
    assert.equal(detectFeedbackIntent(message, true), expected);
  });
}

test('no previous AI answer always returns null', () => {
  assert.equal(detectFeedbackIntent("I don't understand", false), null);
  assert.equal(detectFeedbackIntent('got it', false), null);
  assert.equal(detectFeedbackIntent('got it', undefined), null);
});

test('messages over 12 words return null', () => {
  const long = "I don't understand why the function calls itself again and again and never seems to stop";
  assert.equal(detectFeedbackIntent(long, true), null);
});

test('non-string input returns null', () => {
  assert.equal(detectFeedbackIntent(null, true), null);
  assert.equal(detectFeedbackIntent(42, true), null);
});
