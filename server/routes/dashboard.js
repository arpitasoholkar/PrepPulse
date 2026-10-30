import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Memory from '../models/Memory.js';
import CodingAttempt from '../models/CodingAttempt.js';
import TopicMastery from '../models/TopicMastery.js';
import { TOPICS } from '../constants.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/dashboard
 * Returns aggregate dashboard payload:
 * - mastery: array of topic mastery objects with score, label ("weak" <40, "learning" 40-69, "strong" >=70), attempts, lastPracticed, trend
 * - strengths: active strength & concept_understood memories
 * - weaknesses: active weakness memories
 * - recentMistakes: last 5 active mistake memories
 * - recentAttempts: last coding attempts
 * - stats: totalAttempts, passRate, activeMemories
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;

    // Fetch topic mastery records
    const masteryDocs = await TopicMastery.find({ userId });
    const masteryMap = new Map(masteryDocs.map(doc => [doc.topic, doc]));

    const mastery = TOPICS.map(topic => {
      const doc = masteryMap.get(topic);
      const score = doc ? doc.masteryScore : 0;
      let label = 'learning';
      if (score < 40) label = 'weak';
      else if (score >= 70) label = 'strong';

      return {
        topic,
        score,
        masteryScore: score,
        label,
        attempts: doc ? doc.attempts : 0,
        lastPracticed: doc && doc.lastPracticed ? doc.lastPracticed.toISOString() : null,
        trend: doc && Array.isArray(doc.history) ? doc.history.slice(-10) : []
      };
    });

    // Fetch active strengths and concepts understood
    const strengths = await Memory.find({
      userId,
      status: 'active',
      type: { $in: ['strength', 'concept_understood'] }
    }).sort({ updatedAt: -1 });

    // Fetch active weaknesses
    const weaknesses = await Memory.find({
      userId,
      status: 'active',
      type: 'weakness'
    }).sort({ updatedAt: -1 });

    // Fetch last 5 active mistakes
    const recentMistakes = await Memory.find({
      userId,
      status: 'active',
      type: 'mistake'
    }).sort({ updatedAt: -1 }).limit(5);

    // Fetch recent coding attempts
    const recentAttempts = await CodingAttempt.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    // Calculate aggregated statistics
    const [totalAttempts, passedAttempts, activeMemories] = await Promise.all([
      CodingAttempt.countDocuments({ userId }),
      CodingAttempt.countDocuments({ userId, result: 'pass' }),
      Memory.countDocuments({ userId, status: 'active' })
    ]);

    const passRate = totalAttempts > 0 
      ? Number((passedAttempts / totalAttempts).toFixed(2)) 
      : 0;

    res.json({
      mastery,
      strengths,
      weaknesses,
      recentMistakes,
      recentAttempts: recentAttempts.map(a => ({
        _id: a._id.toString(),
        questionId: a.questionId,
        topic: a.topic,
        code: a.code,
        result: a.result,
        errorType: a.errorType,
        explanation: a.explanation,
        testsPassed: a.testsPassed,
        testsTotal: a.testsTotal,
        timestamp: a.timestamp ? a.timestamp.toISOString() : null
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
