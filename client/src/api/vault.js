import client from './client.js';

export const getMemories = (params) => client.get('/memories', { params });
export const updateMemory = (id, data) => client.patch(`/memories/${id}`, data);
export const deleteMemory = (id) => client.delete(`/memories/${id}`);
