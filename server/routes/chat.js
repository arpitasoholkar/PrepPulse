import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Mock response matching contract Section 6.2
router.post('/', async (req, res) => {
  const { sessionId, message } = req.body;
  res.json({
    messageId: "m_" + Date.now(),
    reply: "Let's explore recursion step by step.\n\n```\nrec(3) -> rec(2) -> rec(1) -> Base Case (0)\n```\nRecursion solves problems by breaking them down into identical smaller subproblems until a stopping condition is reached.",
    topic: "recursion",
    explanationStyle: "visual",
    ladderStep: 0,
    styleReason: "Started with visual because it worked for you on recursion earlier",
    memoriesUsed: [
      {
        memory: {
          _id: "665f00000000000000000001",
          type: "learning_preference",
          topic: "recursion",
          content: "Prefers visual explanation for recursive call stacks",
          confidence: 0.85,
          status: "active",
          meta: { style: "visual" }
        },
        why: "topic match: recursion; learning preference",
        score: 4.2
      }
    ],
    memoriesSaved: [],
    degraded: false
  });
});

router.post('/feedback', async (req, res) => {
  const { sessionId, messageId, understood } = req.body;
  if (!understood) {
    res.json({
      messageId: "m_" + Date.now(),
      reply: "No worries! Think of recursion like Russian Matryoshka nesting dolls. Each doll opens up to reveal a smaller version of itself until you reach the smallest solid doll (the base case).",
      topic: "recursion",
      explanationStyle: "analogy",
      ladderStep: 1,
      styleReason: "Switched to analogy because the visual explanation needed further clarification",
      memoriesUsed: [],
      memoriesSaved: [],
      memoriesUpdated: [],
      done: false,
      degraded: false
    });
  } else {
    res.json({
      messageId: "m_" + Date.now(),
      reply: "Awesome! Ready to try a quick challenge problem on recursion?",
      topic: "recursion",
      explanationStyle: "visual",
      ladderStep: 0,
      styleReason: "Visual style confirmed",
      memoriesUsed: [],
      memoriesSaved: [
        {
          _id: "665f00000000000000000002",
          type: "learning_preference",
          topic: "recursion",
          content: "Understood recursion with visual call stack diagram",
          confidence: 0.6,
          status: "active",
          meta: { style: "visual" }
        }
      ],
      memoriesUpdated: [],
      done: true,
      degraded: false
    });
  }
});

export default router;
