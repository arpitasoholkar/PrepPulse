import client from './client.js';

/**
 * Fetch full dashboard aggregate payload:
 * mastery, strengths, weaknesses, recentMistakes, recentAttempts, stats
 */
export const getDashboardData = () => client.get('/dashboard');

/**
 * Reset demo baseline data for logged in user:
 */
export const resetDemo = () => client.post('/demo/reset');

export default {
  getDashboardData,
  resetDemo,
};
