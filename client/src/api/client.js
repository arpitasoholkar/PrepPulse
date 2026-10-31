import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Read the message from the API error shape { error: { code, message } }.
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const apiMessage = err?.response?.data?.error?.message;
  if (apiMessage) return apiMessage;
  if (err?.response) return fallback;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  return 'Could not reach the server. Check your connection and try again.';
}

// Tracks in-flight requests so the UI can show a Render cold-start notice.
const SLOW_AFTER_MS = 4000;
let pending = 0;
let slow = false;
let timer = null;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(slow));
const setSlow = (value) => {
  if (slow !== value) {
    slow = value;
    emit();
  }
};
const start = () => {
  pending += 1;
  if (pending === 1) timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
};
const finish = () => {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    clearTimeout(timer);
    setSlow(false);
  }
};

export function subscribeSlowRequests(fn) {
  listeners.add(fn);
  fn(slow);
  return () => listeners.delete(fn);
}

client.interceptors.request.use((config) => {
  start();
  // Lets the server work out "today" in the user's own time zone
  config.headers['x-tz-offset'] = String(new Date().getTimezoneOffset());
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
}, (err) => {
  finish();
  return Promise.reject(err);
});

client.interceptors.response.use(
  (res) => {
    finish();
    // Practice and chat replies can carry newly earned badges and the streak.
    const url = res?.config?.url || '';
    if (/\/practice\/submit|\/chat$/.test(url) || res?.data?.newBadges?.length) {
      window.dispatchEvent(new CustomEvent('activity:changed', { detail: res.data || {} }));
    }
    return res;
  },
  (err) => {
    finish();
    // Stored user no longer valid: clear it and go back to the login page.
    const isLogin = err?.config?.url?.includes('/auth/login');
    if (err?.response?.status === 401 && !isLogin) {
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default client;
