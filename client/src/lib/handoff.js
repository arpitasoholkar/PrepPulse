// Remembers which mentor chat sent the student to the code editor,
// so the student comes back to that SAME chat (survives a page reload).
const KEY = 'preppulse.mentorHandoff';

export const setHandoff = (data) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...data, at: Date.now() }));
  } catch (e) {
    // storage blocked: the app still works, it just starts a fresh chat on return
  }
};

export const getHandoff = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch (e) {
    return null;
  }
};

export const clearHandoff = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch (e) {
    // ignore
  }
};