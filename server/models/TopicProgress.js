import mongoose from 'mongoose';
import { TOPICS } from '../constants.js';

// Teaching progress per topic, separate from practice mastery.
// "learned" is set when the student says they understood a lesson on that topic.
const topicProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, enum: TOPICS, required: true },
  status: { type: String, enum: ['learning', 'learned'], default: 'learning' },
  learnedAt: { type: Date, default: null },
  lastTaughtAt: { type: Date, default: null },
}, { timestamps: true });

topicProgressSchema.index({ userId: 1, topic: 1 }, { unique: true });

export const TopicProgress = mongoose.model('TopicProgress', topicProgressSchema, 'topic_progress');
export default TopicProgress;
