import mongoose from 'mongoose';
import { MEMORY_TYPES, MEMORY_STATUS, MEMORY_SOURCE } from '../constants.js';

const evidenceSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: MEMORY_SOURCE,
    required: true
  },
  refId: {
    type: String,
    default: null
  },
  at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: MEMORY_TYPES,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  evidence: [evidenceSchema],
  confidence: {
    type: Number,
    default: 0.5
  },
  status: {
    type: String,
    enum: MEMORY_STATUS,
    default: 'active'
  },
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Memory',
    default: null
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  source: {
    type: String,
    enum: MEMORY_SOURCE,
    default: 'chat'
  },
  useCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  lastVerified: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  // Semantic vector for MongoDB Vector Search. Written by memory/vectorIndex.js (native driver),
  // hidden from normal queries so API responses and the Memory Vault never ship 768 floats.
  embedding: {
    type: [Number],
    select: false,
    default: undefined
  },
  embeddedAt: {
    type: Date,
    select: false,
    default: undefined
  }
}, {
  timestamps: true
});

// Compound indexes
memorySchema.index({ userId: 1, status: 1, topic: 1 });
memorySchema.index({ userId: 1, type: 1 });

// TTL index to automatically purge expired memories
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
memorySchema.index({ userId: 1, type: 1, topic: 1, 'meta.style': 1 });
export const Memory = mongoose.model('Memory', memorySchema, 'student_memories');
export default Memory;
