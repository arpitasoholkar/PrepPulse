import client from './client.js';

export const sendMessage = (data) => client.post('/chat', data);
export const sendFeedback = (data) => client.post('/chat/feedback', data);
