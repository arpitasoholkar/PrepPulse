import React, { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import NotFound from '../components/NotFound.jsx';

const UserContext = createContext(null);

// Every path App.jsx defines. Anything else renders the 404 page.
// App.jsx is frozen, so the catch-all lives here (UserProvider wraps the router).
const KNOWN_PATHS = ['/', '/login', '/mentor', '/practice', '/vault', '/dashboard', '/profile'];

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const saveUser = (userData) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user');
    }
  };

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isKnown = KNOWN_PATHS.includes(path);

  return (
    <UserContext.Provider value={{ user, setUser: saveUser }}>
      {isKnown ? children : <NotFound />}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

// Wrap protected content. With no user, bounce to /login.
// Layout uses this, so Mentor, Practice, Vault and Dashboard are all covered.
export function RequireUser({ children }) {
  const { user } = useUser() || {};
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
