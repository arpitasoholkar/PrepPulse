import mongoose from 'mongoose';
import { EXPLANATION_STYLES } from '../constants.js';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  explanationStyle: { type: String, enum: EXPLANATION_STYLES, default: null },
  memoriesUsed: [{ type: Object }],
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const chatSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String, required: true },
  messages: [messageSchema],
  ladder: {
    topic: { type: String, default: null },
    step: { type: Number, default: 0 },
    stylesTried: [{ type: String }]
  }
}, { timestamps: true });

chatSessionSchema.index({ userId: 1, sessionId: 1 });

export default mongoose.model('ChatSession', chatSessionSchema, 'chat_sessions');
