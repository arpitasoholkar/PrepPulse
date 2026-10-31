import { Router } from 'express';
import User from '../models/User.js';
import CodingAttempt from '../models/CodingAttempt.js';
import { authenticate } from '../middleware/auth.js';
import { buildStats, describeBadges } from '../gamification/service.js';
import { dayKey } from '../gamification/streak.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/profile
 * The user plus streak, learning time, solved counts and every badge.
 */
router.get('/', async (req, res, next) => {
  try {
    const today = dayKey(req.tzOffset);
    const [user, stats, attempts] = await Promise.all([
      User.findById(req.userId).lean(),
      buildStats(req.userId, today),
      CodingAttempt.countDocuments({ userId: req.userId })
    ]);
    const badges = describeBadges(stats.metrics, user.badges || []);
    const passRate = stats.totals.attempts > 0
      ? Math.round((stats.totals.passes / stats.totals.attempts) * 100)
      : 0;

    res.json({
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        targetRole: user.targetRole,
        createdAt: user.createdAt
      },
      streak: stats.streak,
      totals: { ...stats.totals, totalAttempts: Math.max(attempts, stats.totals.attempts), passRate },
      badges,
      badgesEarned: badges.filter(b => b.earned).length,
      badgesTotal: badges.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/profile   body: { name?, targetRole? }
 */
router.patch('/', async (req, res, next) => {
  try {
    const update = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) update.name = req.body.name.trim().slice(0, 60);
    if (typeof req.body?.targetRole === 'string' && req.body.targetRole.trim()) update.targetRole = req.body.targetRole.trim().slice(0, 60);
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Nothing to update' } });
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true }).lean();
    res.json({ user: { _id: user._id.toString(), name: user.name, email: user.email, targetRole: user.targetRole, createdAt: user.createdAt } });
  } catch (err) {
    next(err);
  }
});

export default router;
