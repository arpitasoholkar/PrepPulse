import mongoose from 'mongoose';
import { TOPICS } from '../constants.js';

const topicMasterySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, enum: TOPICS, required: true },
  masteryScore: { type: Number, default: 0, min: 0, max: 100 },
  attempts: { type: Number, default: 0 },
  lastPracticed: { type: Date, default: null },
  history: [{ type: Number }]
});

topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });

export default mongoose.model('TopicMastery', topicMasterySchema, 'topic_mastery');
