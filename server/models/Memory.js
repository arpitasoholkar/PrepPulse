import mongoose from 'mongoose';
import { TOPICS, MEMORY_TYPES, MEMORY_STATUS, MEMORY_SOURCE } from '../constants.js';

const evidenceSchema = new mongoose.Schema({
  text: { type: String, required: true },
  source: { type: String, enum: MEMORY_SOURCE, required: true },
  refId: { type: String, default: null },
  at: { type: Date, default: Date.now }
}, { _id: false });

const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: MEMORY_TYPES, required: true },
  topic: { type: String, required: true },
  content: { type: String, required: true },
  evidence: [evidenceSchema],
  confidence: { type: Number, default: 0.5 },
  status: { type: String, enum: MEMORY_STATUS, default: 'active' },
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Memory', default: null },
  meta: {
    style: { type: String, default: null },
    errorType: { type: String, default: null }
  },
  source: { type: String, enum: MEMORY_SOURCE, default: 'chat' },
  useCount: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: null },
  lastVerified: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

memorySchema.index({ userId: 1, status: 1, topic: 1 });
memorySchema.index({ userId: 1, type: 1 });
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Memory', memorySchema, 'student_memories');
