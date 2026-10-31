import client from './client.js';

export const sendMessage = (data) => client.post('/chat', data);
export const sendFeedback = (data) => client.post('/chat/feedback', data);
export const getSessions = () => client.get('/chat/sessions');
export const getSession = (sessionId) => client.get(`/chat/sessions/${sessionId}`);
export const deleteSession = (sessionId) => client.delete(`/chat/sessions/${sessionId}`);
export const getCurriculum = () => client.get('/chat/curriculum');
export const continueLearning = (sessionId) => client.post('/chat/next', { sessionId });
