import { Router } from 'express';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';
import { recordEvent, buildStats, describeBadges } from '../gamification/service.js';
import { addDays, dayKey, weekday } from '../gamification/streak.js';

const router = Router();
router.use(authenticate);

/**
 * POST /api/activity/ping   body: { seconds }
 * Heartbeat from the client while the tab is visible and the user is active.
 * Adds time to today's Hours Activity and may award time/streak badges.
 */
router.post('/ping', async (req, res, next) => {
  try {
    const seconds = Math.max(1, Math.min(120, Math.round(Number(req.body?.seconds) || 0)));
    if (!req.body?.seconds) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'seconds is required' } });
    }
    const { newBadges, streak } = await recordEvent(req.userId, req.tzOffset, { seconds });
    res.json({ ok: true, newBadges, streak });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/activity/summary?month=YYYY-MM
 * Everything the dashboard needs: streak, this week's hours (Sun to Sat) with
 * change vs last week, one month of calendar days, totals and badges.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const today = dayKey(req.tzOffset);
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);

    const weekStart = addDays(today, -weekday(today));
    const prevWeekStart = addDays(weekStart, -7);
    const monthStart = `${month}-01`;
    const nextMonth = new Date(`${monthStart}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10); // exclusive

    const [rows, stats, user] = await Promise.all([
      Activity.find({
        userId: req.userId,
        $or: [
          { day: { $gte: prevWeekStart, $lt: addDays(weekStart, 7) } },
          { day: { $gte: monthStart, $lt: monthEnd } }
        ]
      }).lean(),
      buildStats(req.userId, today),
      User.findById(req.userId).select('badges').lean()
    ]);
    const byDay = new Map(rows.map(r => [r.day, r]));
    const minutesOf = (d) => Math.round(((byDay.get(d)?.seconds) || 0) / 60);

    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const weekDays = labels.map((label, i) => {
      const day = addDays(weekStart, i);
      return { day, label, minutes: minutesOf(day), isToday: day === today, future: day > today };
    });
    const weekTotal = weekDays.reduce((s, d) => s + d.minutes, 0);
    let prevTotal = 0;
    for (let i = 0; i < 7; i++) prevTotal += minutesOf(addDays(prevWeekStart, i));
    const deltaPct = prevTotal > 0 ? Math.round(((weekTotal - prevTotal) / prevTotal) * 100) : (weekTotal > 0 ? 100 : 0);

    const monthDays = rows
      .filter(r => r.day >= monthStart && r.day < monthEnd)
      .map(r => ({
        day: r.day,
        minutes: Math.round((r.seconds || 0) / 60),
        attempts: r.attempts || 0,
        chats: r.chats || 0,
        active: (r.attempts || 0) + (r.chats || 0) > 0 || (r.seconds || 0) >= 300
      }));

    res.json({
      today,
      streak: stats.streak,
      week: { days: weekDays, totalMinutes: weekTotal, prevTotalMinutes: prevTotal, deltaPct },
      month: { month, days: monthDays },
      totals: stats.totals,
      badges: describeBadges(stats.metrics, user?.badges || [])
    });
  } catch (err) {
    next(err);
  }
});

export default router;
