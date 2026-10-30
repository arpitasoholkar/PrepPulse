import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/health
 * Returns 200 with { ok: true, db: "connected", time: new Date().toISOString() }
 * Handles both /health and / to ensure compatibility with route mounting.
 */
router.get(['/', '/health'], (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    ok: true,
    db: isConnected ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  });
});

export default router;
