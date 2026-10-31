// Records activity and awards badges. Every entry point is wrapped so a
// failure here can never break practice, chat or login.

import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import TopicMastery from '../models/TopicMastery.js';
import { BADGES, BADGE_BY_KEY } from './badges.js';
import { computeStreaks, dayKey, dayQualifies } from './streak.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));

export async function addActivity(userId, day, delta = {}) {
  const inc = {};
  for (const k of ['seconds', 'attempts', 'passes', 'chats']) {
    inc[k] = Math.max(0, Math.round(delta[k] || 0));
  }
  // userId and day come from the filter on insert, $inc creates the counters
  return Activity.findOneAndUpdate(
    { userId: oid(userId), day },
    { $inc: inc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Totals, streak and the numbers each badge is measured against. */
export async function buildStats(userId, today) {
  const [rows, strongTopics, user] = await Promise.all([
    Activity.find({ userId: oid(userId) }).lean(),
    TopicMastery.countDocuments({ userId: oid(userId), masteryScore: { $gte: 70 } }),
    User.findById(userId).select('longestStreak').lean()
  ]);

  let seconds = 0, attempts = 0, passes = 0, chats = 0;
  const days = new Set();
  for (const r of rows) {
    seconds += r.seconds || 0;
    attempts += r.attempts || 0;
    passes += r.passes || 0;
    chats += r.chats || 0;
    if (dayQualifies(r)) days.add(r.day);
  }
  const streak = computeStreaks(days, today);
  const bestStreak = Math.max(streak.longest, (user && user.longestStreak) || 0);

  return {
    streak: { ...streak, longest: bestStreak },
    totals: { seconds, minutes: Math.floor(seconds / 60), attempts, passes, chats, strongTopics },
    metrics: { attempts, passes, chats, strongTopics, minutes: Math.floor(seconds / 60), bestStreak }
  };
}

/** Full badge list for the UI: earned flag, date and progress. */
export function describeBadges(metrics, earned = []) {
  const earnedMap = new Map(earned.map(b => [b.key, b.earnedAt]));
  return BADGES.map(b => {
    const value = metrics[b.metric] || 0;
    return {
      key: b.key, name: b.name, description: b.description, icon: b.icon, tier: b.tier,
      target: b.target,
      progress: Math.min(value, b.target),
      earned: earnedMap.has(b.key),
      earnedAt: earnedMap.get(b.key) || null
    };
  });
}

/** Awards any newly reached badges and remembers the longest streak. */
export async function evaluateBadges(userId, today) {
  const { streak, totals, metrics } = await buildStats(userId, today);
  const user = await User.findById(userId).select('badges longestStreak');
  if (!user) return { newBadges: [], streak, totals, metrics, earned: [] };

  const have = new Set((user.badges || []).map(b => b.key));
  const now = new Date();
  const newBadges = [];
  for (const b of BADGES) {
    if (!have.has(b.key) && (metrics[b.metric] || 0) >= b.target) {
      // The $ne guard makes a double award impossible if two requests race.
      const res = await User.updateOne(
        { _id: user._id, 'badges.key': { $ne: b.key } },
        { $push: { badges: { key: b.key, earnedAt: now } } }
      );
      if (res.modifiedCount) newBadges.push({ key: b.key, name: b.name, description: b.description, icon: b.icon, tier: b.tier });
    }
  }
  if (streak.longest > (user.longestStreak || 0)) {
    await User.updateOne({ _id: user._id }, { $set: { longestStreak: streak.longest } });
  }
  const fresh = await User.findById(userId).select('badges').lean();
  return { newBadges, streak, totals, metrics, earned: fresh.badges || [] };
}

/**
 * Called after something real happens (attempt, chat) or on a heartbeat.
 * Never throws.
 */
export async function recordEvent(userId, tzOffset, delta) {
  try {
    const today = dayKey(tzOffset);
    await addActivity(userId, today, delta);
    const { newBadges, streak } = await evaluateBadges(userId, today);
    return { newBadges, streak };
  } catch (err) {
    console.error('Gamification error:', err.message);
    return { newBadges: [], streak: null };
  }
}

export { BADGE_BY_KEY };
