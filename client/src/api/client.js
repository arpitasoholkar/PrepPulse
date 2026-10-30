import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

client.interceptors.request.use((config) => {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const parsed = JSON.parse(user);
      if (parsed._id) {
        config.headers['x-user-id'] = parsed._id;
      }
    } catch (e) {
      // ignore parsing error
    }
  }
  return config;
});

export default client;
