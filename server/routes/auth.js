import { Router } from 'express';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/login
 * Accepts { name, email }.
 * Finds or creates user by email.
 * Returns { user }.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Email is required'
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });
    let isNew = false;

    if (!user) {
      const displayName = name && name.trim() ? name.trim() : normalizedEmail.split('@')[0];
      user = await User.create({
        name: displayName,
        email: normalizedEmail,
        targetRole: 'SDE'
      });
      isNew = true;
    }

    res.json({
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        targetRole: user.targetRole,
        createdAt: user.createdAt,
        isNew
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({
    user: {
      _id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
      targetRole: req.user.targetRole,
      createdAt: req.user.createdAt
    }
  });
});

export default router;
