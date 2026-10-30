import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import Memory from '../models/Memory.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { type, topic, status = 'active' } = req.query;
    const filter = { userId: req.userId };
    if (type) filter.type = type;
    if (topic) filter.topic = topic;
    if (status && status !== 'all') filter.status = status;

    const memories = await Memory.find(filter).sort({ updatedAt: -1 });

    const activeCount = await Memory.countDocuments({ userId: req.userId, status: 'active' });
    const supersededCount = await Memory.countDocuments({ userId: req.userId, status: 'superseded' });
    const correctedCount = await Memory.countDocuments({ userId: req.userId, status: 'corrected' });

    res.json({
      memories,
      counts: {
        active: activeCount,
        superseded: supersededCount,
        corrected: correctedCount
      }
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { content, topic, type, confidence, expiresAt } = req.body;
    const memory = await Memory.findOne({ _id: req.params.id, userId: req.userId });
    if (!memory) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Memory not found' } });
    }

    if (content !== undefined) memory.content = content;
    if (topic !== undefined) memory.topic = topic;
    if (type !== undefined) memory.type = type;
    if (confidence !== undefined) memory.confidence = confidence;
    if (expiresAt !== undefined) memory.expiresAt = expiresAt;

    memory.status = 'corrected';
    memory.evidence.push({
      text: 'Manually corrected by user in Memory Vault',
      source: 'manual',
      at: new Date()
    });

    await memory.save();
    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const memory = await Memory.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!memory) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Memory not found' } });
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;
