import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext.jsx';
import Login from './pages/Login/index.jsx';
import Mentor from './pages/Mentor/index.jsx';
import Practice from './pages/Practice/index.jsx';
import Vault from './pages/Vault/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Profile from './pages/Profile/index.jsx';
import { ActivityProvider } from './context/ActivityContext.jsx';

export default function App() {
  return (
    <UserProvider>
      <ActivityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/mentor" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
      </ActivityProvider>
    </UserProvider>
  );
}
