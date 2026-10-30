import client from './client.js';

export const getDashboardData = () => client.get('/dashboard');
export const resetDemo = () => client.post('/demo/reset');
