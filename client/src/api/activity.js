import client from './client.js';

/** Heartbeat: adds `seconds` of active time to today. */
export const pingActivity = (seconds = 30) => client.post('/activity/ping', { seconds });

/** Streak, this week's hours, one month of calendar days, totals and badges. */
export const getActivitySummary = (month) =>
  client.get('/activity/summary', { params: month ? { month } : {} });

export const getProfile = () => client.get('/profile');
export const updateProfile = (data) => client.patch('/profile', data);
