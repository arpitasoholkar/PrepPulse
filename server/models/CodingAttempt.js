import mongoose from 'mongoose';
import { ERROR_TYPES } from '../constants.js';

const codingAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId: { type: String, required: true },
  topic: { type: String, required: true },
  code: { type: String, required: true },
  result: { type: String, enum: ['pass', 'fail', 'error'], required: true },
  errorType: { type: String, enum: ERROR_TYPES, default: 'none' },
  explanation: { type: String, default: '' },
  testsPassed: { type: Number, default: 0 },
  testsTotal: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

codingAttemptSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model('CodingAttempt', codingAttemptSchema, 'coding_attempts');
