import { Router } from 'express';
import User from '../models/User.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!email) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Email is required' } });
    }

    let user = await User.findOne({ email });
    let isNew = false;
    if (!user) {
      user = await User.create({ name: name || email.split('@')[0], email, targetRole: 'SDE' });
      isNew = true;
    }

    res.json({
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        targetRole: user.targetRole,
        isNew
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
