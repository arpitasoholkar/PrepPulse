import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './db.js';
import { ensureVectorIndex } from './memory/vectorIndex.js';

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  // Atlas Vector Search index for semantic recall. Background, idempotent, never throws.
  ensureVectorIndex().catch(() => {});
}).catch(err => {
  console.error('Failed to start server:', err);
});
