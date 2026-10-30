import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  targetRole: { type: String, default: 'SDE' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema, 'users');
