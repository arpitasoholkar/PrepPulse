import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth.js';
import Memory from '../models/Memory.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/memories?type=&topic=&status=active
 * Returns active/filtered memories scoped by req.userId and counts ({ active, superseded, corrected }).
 */
router.get('/', async (req, res, next) => {
  try {
    const { type, topic, status = 'active' } = req.query;
    const filter = { userId: req.userId };

    if (type) {
      filter.type = type;
    }
    if (topic) {
      filter.topic = topic;
    }
    if (status && status !== 'all') {
      filter.status = status;
    }

    const memories = await Memory.find(filter).sort({ updatedAt: -1, createdAt: -1 });

    const [active, superseded, corrected] = await Promise.all([
      Memory.countDocuments({ userId: req.userId, status: 'active' }),
      Memory.countDocuments({ userId: req.userId, status: 'superseded' }),
      Memory.countDocuments({ userId: req.userId, status: 'corrected' })
    ]);

    res.json({
      memories,
      counts: {
        active,
        superseded,
        corrected
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/memories/:id
 * Updates content/topic/type/confidence/expiresAt, sets status to "corrected",
 * appends a manual evidence entry, confidence = 0.95.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found'
        }
      });
    }

    const memory = await Memory.findOne({ _id: id, userId: req.userId });
    if (!memory) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found'
        }
      });
    }

    const { content, topic, type, confidence, expiresAt, evidenceText } = req.body;

    if (content !== undefined) memory.content = content;
    if (topic !== undefined) memory.topic = topic;
    if (type !== undefined) memory.type = type;
    if (expiresAt !== undefined) {
      memory.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    // Set status to "corrected"
    memory.status = 'corrected';

    // Append manual evidence entry
    memory.evidence.push({
      text: evidenceText || 'Manually corrected by user in Memory Vault',
      source: 'manual',
      refId: null,
      at: new Date()
    });

    // Sets confidence = 0.95 (or explicit confidence if provided)
    memory.confidence = confidence !== undefined ? Number(confidence) : 0.95;

    await memory.save();

    res.json({ memory });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/memories/:id
 * Hard deletes the memory document.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found'
        }
      });
    }

    const memory = await Memory.findOneAndDelete({ _id: id, userId: req.userId });
    if (!memory) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found'
        }
      });
    }

    res.json({
      ok: true,
      deleted: true,
      id
    });
  } catch (err) {
    next(err);
  }
});

export default router;
