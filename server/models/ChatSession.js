import mongoose from 'mongoose';
import { EXPLANATION_STYLES } from '../constants.js';

const messageSchema = new mongoose.Schema({
  id: { type: String },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  topic: { type: String, default: null },
  style: { type: String, default: null },
  explanationStyle: { type: String, enum: EXPLANATION_STYLES, default: null },
  memoriesUsed: [{ type: Object }],
  // Everything the UI needs to redraw this reply later (style reason, ladder, level, grading...)
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
  degraded: { type: Boolean, default: false },
  feedback: { type: String, enum: ['understood', 'not_understood', null], default: null },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  title: { type: String, default: '' },
  messages: [messageSchema],
  // Per-topic understanding profile: { [topic]: { level, streakRight, weakConcepts, ... } }
  understanding: { type: mongoose.Schema.Types.Mixed, default: {} },
  // The check question the mentor asked last and is waiting for an answer to:
  // { question, answer, concept, topic, messageId, askedAt }  (or null)
  pending: { type: mongoose.Schema.Types.Mixed, default: null },
  // The student's latest code-editor attempt for this chat (so follow-up questions can use the code)
  practice: { type: mongoose.Schema.Types.Mixed, default: null },
  ladder: {
    topic: { type: String, default: null },
    step: { type: Number, default: 0 },
    stylesTried: [{ type: String }],
    tried: [{
      style: { type: String },
      outcome: { type: String, enum: ['pending', 'failed', 'worked'], default: 'pending' },
      _id: false
    }],
    exhausted: { type: Boolean, default: false }
  }
}, { timestamps: true });

chatSessionSchema.index({ userId: 1, sessionId: 1 });
chatSessionSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model('ChatSession', chatSessionSchema, 'chat_sessions');