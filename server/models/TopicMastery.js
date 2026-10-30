import mongoose from 'mongoose';
import { TOPICS } from '../constants.js';

const topicMasterySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topic: {
    type: String,
    enum: TOPICS,
    required: true
  },
  masteryScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastPracticed: {
    type: Date,
    default: null
  },
  history: [{
    type: Number
  }]
});

// Pre-save middleware to guarantee history maintains at most 10 recent scores
topicMasterySchema.pre('save', function (next) {
  if (Array.isArray(this.history) && this.history.length > 10) {
    this.history = this.history.slice(-10);
  }
  next();
});

topicMasterySchema.index({ userId: 1, topic: 1 }, { unique: true });

export const TopicMastery = mongoose.model('TopicMastery', topicMasterySchema, 'topic_mastery');
export default TopicMastery;
