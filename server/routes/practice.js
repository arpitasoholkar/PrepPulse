// server/routes/practice.js  (Owner: C)
// GET  /api/practice/questions  -> the 5 questions, with a "recommended" flag
// POST /api/practice/submit     -> Gemini judges the code, we save memories + mastery
// We NEVER run student code on the server.

import express from 'express';
import fs from 'fs';
const router = express.Router();

import { Memory, CodingAttempt, ERROR_TYPES } from '../memory/deps.js';
import { generateJSON } from '../ai/gemini.js';
import { JUDGE_SYSTEM, JUDGE_SCHEMA, buildJudgePrompt } from '../ai/prompts/judge.js';
import * as lifecycle from '../memory/lifecycle.js';
import { updateMastery } from '../memory/mastery.js';
import { getPrereqs } from '../memory/retrieve.js';

const questions = JSON.parse(
  fs.readFileSync(new URL('../data/questions.json', import.meta.url), 'utf-8')
);

// ---------- GET /api/practice/questions ----------
router.get('/practice/questions', async (req, res, next) => {
  try {
    const problems = await Memory.find({
      userId: req.userId,
      type: { $in: ['weakness', 'mistake'] },
      status: { $in: ['active', 'corrected'] },
    })
      .sort({ confidence: -1 })
      .lean();

    const list = questions.map((q) => {
      // direct weakness/mistake on this topic, else a prerequisite topic
      const prereqs = getPrereqs(q.topic);
      const direct = problems.find((m) => m.topic === q.topic);
      const viaPrereq = problems.find((m) => prereqs.includes(m.topic));
      const hit = direct || viaPrereq;

      return {
        id: q.id,
        title: q.title,
        topic: q.topic,
        difficulty: q.difficulty,
        prompt: q.prompt,
        starterCode: q.starterCode,
        language: q.language,
        recommended: Boolean(hit),
        recommendedReason: hit
          ? direct
            ? `You have a ${hit.type} on ${q.topic}: ${hit.content}`
            : `Builds on ${hit.topic}, where you had: ${hit.content}`
          : null,
      };
    });

    // recommended ones first
    list.sort((a, b) => Number(b.recommended) - Number(a.recommended));
    res.json({ questions: list });
  } catch (err) {
    next(err);
  }
});

// Clean up whatever Gemini returned so bad JSON can't break the app
function normaliseVerdict(raw, total) {
  let result = ['pass', 'fail', 'error'].includes(raw.result) ? raw.result : 'fail';
  let testsPassed = Number.isFinite(raw.testsPassed) ? Math.max(0, Math.min(total, raw.testsPassed)) : 0;
  if (result === 'pass') testsPassed = total;
  if (result !== 'pass' && testsPassed === total) result = 'fail';

  let errorType = ERROR_TYPES.includes(raw.errorType) ? raw.errorType : 'logic_error';
  if (result === 'pass') errorType = 'none';
  if (result !== 'pass' && errorType === 'none') errorType = 'logic_error';

  return {
    result,
    testsPassed,
    testsTotal: total,
    errorType,
    explanation: String(raw.explanation || ''),
    hint: String(raw.hint || ''),
  };
}

// ---------- POST /api/practice/submit ----------
router.post('/practice/submit', async (req, res, next) => {
  try {
    const { questionId, code } = req.body || {};
    const question = questions.find((q) => q.id === questionId);

    if (!question) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown questionId' } });
    }
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'code is required' } });
    }

    // 1. Gemini judges the code
    const { data, degraded } = await generateJSON({
      system: JUDGE_SYSTEM,
      prompt: buildJudgePrompt(question, code),
      schema: JUDGE_SCHEMA,
    });

    // If the judge is down we do NOT touch memory or mastery
    if (degraded || !data) {
      return res.json({
        attemptId: null,
        result: 'error',
        testsPassed: 0,
        testsTotal: question.tests.length,
        errorType: 'none',
        explanation: 'The code judge is not available right now. Nothing was saved. Please try again.',
        hint: '',
        memoriesSaved: [],
        memoriesUpdated: [],
        mastery: null,
        degraded: true,
      });
    }

    const verdict = normaliseVerdict(data, question.tests.length);

    // 2. Save the attempt
    const attempt = await CodingAttempt.create({
      userId: req.userId,
      questionId: question.id,
      topic: question.topic,
      code,
      result: verdict.result,
      errorType: verdict.errorType,
      explanation: verdict.explanation,
      testsPassed: verdict.testsPassed,
      testsTotal: verdict.testsTotal,
      timestamp: new Date(),
    });

    // 3. Mastery
    const mastery = await updateMastery({
      userId: req.userId,
      topic: question.topic,
      result: verdict.result,
      difficulty: question.difficulty,
    });

    // 4. Memories
    let memoriesSaved = [];
    let memoriesUpdated = [];
    const collect = (r) => {
      memoriesSaved = memoriesSaved.concat(r.saved);
      memoriesUpdated = memoriesUpdated.concat(r.updated);
    };

    if (verdict.result === 'pass') {
      collect(
        await lifecycle.supersedeWeaknessIfEarned({
          userId: req.userId,
          topic: question.topic,
          attemptId: attempt._id,
        })
      );
    } else {
      collect(
        await lifecycle.recordMistake({
          userId: req.userId,
          topic: question.topic,
          errorType: verdict.errorType,
          text: verdict.explanation || `Failed ${question.title}`,
          attemptId: attempt._id,
        })
      );
      if (mastery.after < 40) {
        collect(
          await lifecycle.createRevisionNeeded({
            userId: req.userId,
            topic: question.topic,
            reason: `Mastery dropped to ${mastery.after} on ${question.topic}`,
          })
        );
      }
    }

    res.json({
      attemptId: attempt._id,
      result: verdict.result,
      testsPassed: verdict.testsPassed,
      testsTotal: verdict.testsTotal,
      errorType: verdict.errorType,
      explanation: verdict.explanation,
      hint: verdict.hint,
      memoriesSaved,
      memoriesUpdated,
      mastery,
      degraded: false,
    });
  } catch (err) {
    next(err);
  }
});

export default router;