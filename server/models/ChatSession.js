// server/models/ChatSession.js  (Owner: C, the only model C owns)
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    id: String, // e.g. "m_123"
    role: { type: String, enum: ['user', 'assistant'] },
    content: String,
    topic: String,
    style: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    messages: { type: [messageSchema], default: [] },
    ladder: {
      topic: { type: String, default: null },
      step: { type: Number, default: 0 },
      stylesTried: { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

chatSessionSchema.index({ userId: 1, sessionId: 1 });

const ChatSession = mongoose.models.ChatSession || mongoose.model('ChatSession', chatSessionSchema, 'chat_sessions');

export default ChatSession;