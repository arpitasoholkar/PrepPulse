import mongoose from 'mongoose';

/**
 * One document per user per local calendar day.
 * Feeds the Hours Activity chart, the activity calendar, streaks and badges.
 */
const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Local calendar day of the user, "YYYY-MM-DD"
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  // Seconds the app was open and in use (sent by the client heartbeat)
  seconds: { type: Number, default: 0, min: 0 },
  attempts: { type: Number, default: 0, min: 0 },
  passes: { type: Number, default: 0, min: 0 },
  chats: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

activitySchema.index({ userId: 1, day: 1 }, { unique: true });

export const Activity = mongoose.model('Activity', activitySchema, 'activities');
export default Activity;
