import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Memory from '../models/Memory.js';
import CodingAttempt from '../models/CodingAttempt.js';
import TopicMastery from '../models/TopicMastery.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const masteryDocs = await TopicMastery.find({ userId: req.userId });
    const mastery = masteryDocs.map(doc => {
      let label = 'learning';
      if (doc.masteryScore < 40) label = 'weak';
      else if (doc.masteryScore >= 70) label = 'strong';

      return {
        topic: doc.topic,
        masteryScore: doc.masteryScore,
        label,
        attempts: doc.attempts,
        lastPracticed: doc.lastPracticed ? doc.lastPracticed.toISOString() : null,
        trend: doc.history || []
      };
    });

    const strengths = await Memory.find({
      userId: req.userId,
      status: 'active',
      type: { $in: ['strength', 'concept_understood'] }
    }).limit(10);

    const weaknesses = await Memory.find({
      userId: req.userId,
      status: 'active',
      type: 'weakness'
    }).limit(10);

    const recentMistakes = await Memory.find({
      userId: req.userId,
      status: 'active',
      type: 'mistake'
    }).sort({ updatedAt: -1 }).limit(5);

    const recentAttempts = await CodingAttempt.find({ userId: req.userId })
      .sort({ timestamp: -1 })
      .limit(10);

    const totalAttempts = await CodingAttempt.countDocuments({ userId: req.userId });
    const passedAttempts = await CodingAttempt.countDocuments({ userId: req.userId, result: 'pass' });
    const passRate = totalAttempts > 0 ? Number((passedAttempts / totalAttempts).toFixed(2)) : 0;
    const activeMemories = await Memory.countDocuments({ userId: req.userId, status: 'active' });

    res.json({
      mastery,
      strengths,
      weaknesses,
      recentMistakes,
      recentAttempts: recentAttempts.map(a => ({
        _id: a._id.toString(),
        questionId: a.questionId,
        topic: a.topic,
        result: a.result,
        errorType: a.errorType,
        timestamp: a.timestamp.toISOString()
      })),
      stats: {
        totalAttempts,
        passRate,
        activeMemories
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
