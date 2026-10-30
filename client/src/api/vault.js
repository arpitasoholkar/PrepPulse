import client from './client.js';

/**
 * Fetch memories scoped to current user with optional query filters:
 * @param {Object} params - { type, topic, status }
 */
export const getMemories = (params) => client.get('/memories', { params });

/**
 * Correct or update a specific memory item:
 * @param {string} id - Memory ID
 * @param {Object} data - { content, topic, type, expiresAt, confidence, evidenceText }
 */
export const updateMemory = (id, data) => client.patch(`/memories/${id}`, data);

/**
 * Hard delete a specific memory item from the vault:
 * @param {string} id - Memory ID
 */
export const deleteMemory = (id) => client.delete(`/memories/${id}`);

export default {
  getMemories,
  updateMemory,
  deleteMemory,
};
