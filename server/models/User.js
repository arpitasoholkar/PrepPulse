import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  targetRole: {
    type: String,
    default: 'SDE',
    trim: true
  },
  // Badges earned through activity (see gamification/badges.js)
  badges: {
    type: [new mongoose.Schema({
      key: { type: String, required: true },
      earnedAt: { type: Date, default: Date.now }
    }, { _id: false })],
    default: []
  },
  // Best streak ever reached, kept so it survives a broken streak
  longestStreak: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export const User = mongoose.model('User', userSchema, 'users');
export default User;
