import client from './client.js';

export const sendMessage = (data) => client.post('/chat', data);
export const reviewPractice = (data) => client.post('/chat/practice-review', data);
export const sendFeedback = (data) => client.post('/chat/feedback', data);
export const listSessions = () => client.get('/chat/sessions');
export const getSession = (sessionId) => client.get(`/chat/sessions/${encodeURIComponent(sessionId)}`);
export const deleteSession = (sessionId) => client.delete(`/chat/sessions/${encodeURIComponent(sessionId)}`);