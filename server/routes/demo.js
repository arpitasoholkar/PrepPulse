import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { runSeedForUser } from '../seed/seed.js';

const router = Router();
router.use(authenticate);

router.post('/reset', async (req, res, next) => {
  try {
    const result = await runSeedForUser(req.userId);
    res.json({ ok: true, memoriesSeeded: result.memoriesSeeded });
  } catch (err) {
    next(err);
  }
});

export default router;
