import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    ok: true,
    db: isConnected ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  });
});

export default router;
