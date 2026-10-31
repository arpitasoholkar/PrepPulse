import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { seedUser } from '../seed/seed.js';
import Memory from '../models/Memory.js';
import TopicMastery from '../models/TopicMastery.js';
import CodingAttempt from '../models/CodingAttempt.js';
import ChatSession from '../models/ChatSession.js';
import Activity from '../models/Activity.js';

const router = Router();
router.use(authenticate);

/**
 * POST /api/demo/reset
 * Wipes all documents for the logged-in user (req.userId)
 * and triggers the seed function to restore the demo baseline.
 */
router.post('/reset', async (req, res, next) => {
  try {
    const userId = req.userId;

    // Wipe all user documents across all collections
    await Promise.all([
      Memory.deleteMany({ userId }),
      TopicMastery.deleteMany({ userId }),
      CodingAttempt.deleteMany({ userId }),
      ChatSession.deleteMany({ userId }),
      Activity.deleteMany({ userId })
    ]);

    // Restore the baseline demo data via the seed function
    const result = await seedUser(userId);

    res.json({
      ok: true,
      message: 'Demo baseline reset successfully',
      memoriesSeeded: result.memoriesSeeded
    });
  } catch (err) {
    next(err);
  }
});

export default router;
