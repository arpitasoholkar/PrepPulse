import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getActivitySummary, pingActivity } from '../api/activity.js';
import { useUser } from './UserContext.jsx';

const ActivityContext = createContext(null);

const PING_SECONDS = 30;
const IDLE_MS = 60 * 1000; // no mouse, key or touch for a minute = not counted

/**
 * Holds the activity summary (streak, week hours, current month, badges),
 * sends the usage heartbeat and queues "badge unlocked" toasts.
 */
export function ActivityProvider({ children }) {
  const { user } = useUser() || {};
  const [summary, setSummary] = useState(null);
  const [toasts, setToasts] = useState([]);
  const lastInput = useRef(Date.now());
  const pings = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await getActivitySummary();
      setSummary(res.data);
    } catch (e) {
      // The dashboard still works without activity data
    }
  }, []);

  const pushBadges = useCallback((badges) => {
    if (!badges || !badges.length) return;
    const stamped = badges.map((b) => ({ ...b, toastId: `${b.key}-${Date.now()}` }));
    setToasts((prev) => [...prev, ...stamped]);
    stamped.forEach((b) => {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.toastId !== b.toastId)), 6000);
    });
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  // First load
  useEffect(() => {
    setSummary(null); // never show the previous user's numbers
    if (user) refresh();
  }, [user?._id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Practice or chat finished, or a ping awarded something
  useEffect(() => {
    const onChange = (e) => {
      pushBadges(e.detail?.newBadges);
      refresh();
    };
    window.addEventListener('activity:changed', onChange);
    return () => window.removeEventListener('activity:changed', onChange);
  }, [pushBadges, refresh]);

  // Heartbeat while the tab is visible and the user is doing something
  useEffect(() => {
    if (!user) return undefined;
    const mark = () => { lastInput.current = Date.now(); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, mark, { passive: true }));

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInput.current > IDLE_MS) return;
      try {
        const res = await pingActivity(PING_SECONDS);
        pings.current += 1;
        pushBadges(res.data?.newBadges);
        if (pings.current % 4 === 0 || res.data?.newBadges?.length) refresh();
      } catch (e) {
        // ignore, the next beat tries again
      }
    }, PING_SECONDS * 1000);

    return () => {
      clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, mark));
    };
  }, [user, pushBadges, refresh]);

  return (
    <ActivityContext.Provider value={{ summary, refresh, toasts, dismissToast }}>
      {children}
    </ActivityContext.Provider>
  );
}

export const useActivity = () => useContext(ActivityContext) || { summary: null, refresh: () => {}, toasts: [], dismissToast: () => {} };
