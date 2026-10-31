// Run with: cd server && node --test memory/understanding.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultUnderstanding,
  initialLevel,
  applyVerdict,
  applyNotUnderstood,
  rememberQuestion,
  buildAdaptation,
  splitCheck,
  heuristicVerdict,
} from './understanding.js';

test('new student starts basic; memory of understanding starts higher; weakness stays basic', () => {
  assert.equal(initialLevel([]), 'basic');
  assert.equal(initialLevel([{ type: 'concept_understood', confidence: 0.7 }]), 'intermediate');
  assert.equal(
    initialLevel([{ type: 'concept_understood', confidence: 0.7 }, { type: 'weakness', status: 'active' }]),
    'basic'
  );
});

test('two correct answers in a row level the student up', () => {
  let s = defaultUnderstanding('basic');
  let out = applyVerdict(s, 'correct', { concept: 'bfs order' });
  assert.equal(out.state.level, 'basic');
  assert.equal(out.state.streakRight, 1);
  assert.equal(out.levelChange, 0);
  out = applyVerdict(out.state, 'correct', { concept: 'queue' });
  assert.equal(out.state.level, 'intermediate');
  assert.equal(out.levelChange, 1);
  assert.equal(out.state.streakRight, 0);
  assert.deepEqual(out.state.strongConcepts, ['bfs order', 'queue']);
});

test('level never goes above advanced or below basic', () => {
  let s = defaultUnderstanding('advanced');
  s = applyVerdict(applyVerdict(s, 'correct').state, 'correct').state;
  assert.equal(s.level, 'advanced');
  s = defaultUnderstanding('basic');
  s = applyVerdict(s, 'wrong').state;
  assert.equal(s.level, 'basic');
});

test('a wrong answer drops one level and marks the concept weak', () => {
  const s = defaultUnderstanding('advanced');
  const out = applyVerdict(s, 'wrong', { concept: 'stack order' });
  assert.equal(out.state.level, 'intermediate');
  assert.equal(out.levelChange, -1);
  assert.deepEqual(out.state.weakConcepts, ['stack order']);
  assert.equal(out.state.streakWrong, 1);
});

test('a partial answer keeps the level and resets the streak', () => {
  let s = applyVerdict(defaultUnderstanding('basic'), 'correct').state;
  const out = applyVerdict(s, 'partial', { concept: 'visited set' });
  assert.equal(out.state.level, 'basic');
  assert.equal(out.state.streakRight, 0);
  assert.deepEqual(out.state.weakConcepts, ['visited set']);
});

test('answering a weak concept correctly removes it from the weak list', () => {
  let s = applyVerdict(defaultUnderstanding('intermediate'), 'wrong', { concept: 'queue' }).state;
  s = applyVerdict(s, 'correct', { concept: 'queue' }).state;
  assert.deepEqual(s.weakConcepts, []);
  assert.deepEqual(s.strongConcepts, ['queue']);
});

test('"I do not understand" drops a level', () => {
  const out = applyNotUnderstood(defaultUnderstanding('intermediate'));
  assert.equal(out.state.level, 'basic');
  assert.equal(out.levelChange, -1);
});

test('questions asked are remembered, capped at 8', () => {
  let s = defaultUnderstanding();
  for (let i = 0; i < 12; i++) s = rememberQuestion(s, `question ${i}`);
  assert.equal(s.questionsAsked.length, 8);
  assert.equal(s.questionsAsked[7], 'question 11');
});

test('adaptation text: wrong answer asks for simple language and an easier question', () => {
  const { state } = applyVerdict(defaultUnderstanding('intermediate'), 'wrong', { concept: 'queue' });
  const text = buildAdaptation({
    state,
    judged: { verdict: 'wrong', misconception: 'thinks BFS uses a stack' },
    levelChange: -1,
  });
  assert.match(text, /BASIC level/);
  assert.match(text, /WRONGLY/);
  assert.match(text, /EASIER question/);
  assert.match(text, /thinks BFS uses a stack/);
  assert.match(text, /weak on: queue/);
});

test('adaptation text: correct answer with level up asks for tougher material', () => {
  const text = buildAdaptation({
    state: defaultUnderstanding('intermediate'),
    judged: { verdict: 'correct', whatRight: 'visit order' },
    levelChange: 1,
  });
  assert.match(text, /INTERMEDIATE level/);
  assert.match(text, /CORRECTLY/);
  assert.match(text, /moved up a level/);
  assert.match(text, /tougher terminology/);
});

test('adaptation text: partial answer names what was right and what was missing', () => {
  const text = buildAdaptation({
    state: defaultUnderstanding('basic'),
    judged: { verdict: 'partial', whatRight: 'uses a queue', whatMissing: 'forgot visited set' },
  });
  assert.match(text, /PARTLY/);
  assert.match(text, /uses a queue/);
  assert.match(text, /forgot visited set/);
});

test('splitCheck removes the hidden block and returns question, answer, concept', () => {
  const raw =
    'Here is BFS.\n\nWhat is the visit order?\n[[CHECK]]{"question":"What is the visit order?","answer":"1 2 3 4","concept":"BFS Order"}[[/CHECK]]';
  const { reply, check } = splitCheck(raw);
  assert.equal(reply, 'Here is BFS.\n\nWhat is the visit order?');
  assert.deepEqual(check, { question: 'What is the visit order?', answer: '1 2 3 4', concept: 'bfs order' });
});

test('splitCheck copes with a missing, broken or half-written block', () => {
  assert.equal(splitCheck('just text').check, null);
  assert.equal(splitCheck('x [[CHECK]]{not json}[[/CHECK]]').check, null);
  assert.equal(splitCheck('x [[CHECK]]{"question":"q"}[[/CHECK]]').check, null);
  const half = splitCheck('text here [[CHECK]]{"question":"q","ans');
  assert.equal(half.check, null);
  assert.equal(half.reply, 'text here');
});

test('heuristicVerdict (AI-down fallback)', () => {
  assert.equal(heuristicVerdict('1 2 4 3', '1 2 4 3'), 'correct');
  assert.equal(heuristicVerdict('the order is 1 2 4 3', '1 2 4 3'), 'correct');
  assert.equal(heuristicVerdict('O(V+E)', 'O(V + E)'), 'correct');
  assert.equal(heuristicVerdict('a queue and visited', 'queue, visited set, level order'), 'partial');
  assert.equal(heuristicVerdict('banana', '1 2 4 3'), 'wrong');
  assert.equal(heuristicVerdict('', '1 2'), null);
});
