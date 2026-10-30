import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
router.use(authenticate);

router.get('/questions', (req, res) => {
  const questionsPath = path.join(__dirname, '../data/questions.json');
  let questions = [];
  try {
    const raw = fs.readFileSync(questionsPath, 'utf-8');
    questions = JSON.parse(raw);
  } catch (e) {
    // fallback
  }

  res.json({
    questions: questions.map(q => ({
      id: q.id,
      title: q.title,
      topic: q.topic,
      difficulty: q.difficulty,
      prompt: q.prompt,
      starterCode: q.starterCode,
      language: q.language || 'javascript',
      recommended: q.id === 'rec_sum_digits',
      recommendedReason: q.id === 'rec_sum_digits' ? 'You missed a base case on recursion before' : null
    }))
  });
});

router.post('/submit', (req, res) => {
  const { questionId, code, language } = req.body;
  res.json({
    attemptId: "att_" + Date.now(),
    result: "fail",
    testsPassed: 2,
    testsTotal: 5,
    errorType: "wrong_base_case",
    explanation: "Your recursion never stops when n is 0...",
    hint: "What should sumDigits(0) return?",
    memoriesSaved: [
      {
        _id: "665f00000000000000000003",
        type: "mistake",
        topic: "recursion",
        content: "Forgets the base case in recursive functions",
        confidence: 0.4,
        status: "active",
        meta: { errorType: "wrong_base_case" }
      }
    ],
    memoriesUpdated: [],
    mastery: { topic: "recursion", before: 45, after: 37 },
    degraded: false
  });
});

export default router;
