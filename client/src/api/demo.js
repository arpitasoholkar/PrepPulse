import client from './client.js';

// mode: "seed" (demo data) or "blank" (empty account). Server default is seed.
export const resetAccount = (mode = 'seed') => client.post('/demo/reset', null, { params: { mode } });
