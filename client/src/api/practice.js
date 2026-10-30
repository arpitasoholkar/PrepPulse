import client from './client.js';

export const getQuestions = () => client.get('/practice/questions');
export const submitSolution = (data) => client.post('/practice/submit', data);
